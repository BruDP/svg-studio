'use server'

import sharp from 'sharp'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct, searchProducts } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal, type SchedaProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from '../../scripts/compose-lib'
import { resolveRenderBundle, resolveIconsForKeys, resolveEditorIcons, renderSceneServer, innerSvg } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import type { ProductRecord } from '@/lib/feed/types'
import type { Dictionary } from '@/lib/dictionary/types'
import type { ProposeResult } from '@/lib/ui/types'
import { isFake, fakeGenerate, fakeDownload, fakeSearchIconify, fakeFetchIconifySvg } from '@/lib/testing/fake'
import { cacheImage, readCachedImage, writeImageBytes } from '@/lib/images/cache'
import { extToMime } from '@/lib/ui/mime'
import { resolveBBox } from '@/lib/images/resolve-bbox'
import { resolveProspettiva } from '@/lib/images/resolve-prospettiva'
import { valutaQualita, type Qualita } from '@/lib/quality/valuta'
import { prospettivaDaQuotaDiagonale } from '@/lib/images/vision-prospettiva'
import { saveProspettiva } from '@/lib/images/prospettiva-repository'
import { fitFoto, quoteFromBBox, celleProdotti, type QuotaSpec } from '@/lib/layout/engine'
import { FOTO_BOX_X, FOTO_BOX_Y, FOTO_BOX_WIDTH, fotoBoxHeight, CANVAS, TEMPLATE_ID } from '@/lib/layout/colonna-sinistra'
import { parseDimensions, parseSetDimensions, type Dimensioni } from '@/lib/extraction/dimensions'
import { db } from '@/lib/db'
import { searchIconify, fetchIconifySvg, ICONIFY_SETS } from '@/lib/icons/iconify'
import { saveIcon, approveIcon, getIcon, listIcons } from '@/lib/icons/repository'
import { normalizeIconSvg } from '@/lib/icons/normalize'

/**
 * Pipeline condivisa propose→scena: refresh feed, prodotto, estrazione (rispetta `isFake()`),
 * composizione. Usata sia dal flusso interattivo (`proposeSceneAction`) sia dalla generazione
 * headless in blocco (`generaSchedaAction`).
 */
async function costruisciScena(
  sku: string,
  dict: Dictionary,
): Promise<{ product: ProductRecord; proposal: SchedaProposal; scene: Scene }> {
  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(sku)
  if (!product) throw new Error(`SKU ${sku} non trovato nel feed`)

  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, dict, generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

  return { product, proposal, scene }
}

export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  const dict = loadDictionary()
  const { product, proposal, scene } = await costruisciScena(s, dict)

  // icone per TUTTE le feature applicabili alla categoria (così "aggiungi" ha già l'icona)
  const applicabili = Object.entries(dict.features)
    .filter(([, def]) => def.categorie.includes(proposal.categoria))
    .map(([chiave, def]) => ({ chiave, etichetta: def.label.replace('{valore}', '').trim() }))
  const bundle = await resolveRenderBundle(scene) // resta per imageMap
  const chiaviScena = scene.elements.filter((e) => e.type === 'icona-label').map((e) => e.chiave)
  const editor = await resolveEditorIcons(applicabili.map((f) => f.chiave).concat(chiaviScena))
  const iconMap = editor.iconMap

  const salvata = await db.scene.findUnique({ where: { sku: s } })
  return {
    scene,
    iconMap,
    imageMap: bundle.imageMap,
    prodotto: { sku: product.sku, descrizioneBreve: product.descrizioneBreve },
    categoriaFeatures: applicabili,
    salvataDisponibile: salvata !== null,
    immagini: product.images,
    iconeNonApprovate: editor.inRevisione,
  }
}

export async function cercaSkuAction(q: string): Promise<{ sku: string; descrizioneBreve: string }[]> {
  const s = (q ?? '').trim()
  if (s.length < 2) return []
  return searchProducts(s)
}

/**
 * Generazione headless di una scheda per il banco batch: stessa pipeline di `proposeSceneAction`
 * ma senza il bundle pesante per l'editor (icone/immagini), pensata per girare in sequenza su
 * più SKU. Non propaga mai un'eccezione al chiamante: un errore su uno SKU non deve interrompere
 * il ciclo del client (vedi vincolo batch sequenziale in StudioClient/Banco).
 */
export async function generaSchedaAction(
  sku: string,
): Promise<{ sku: string; ok: boolean; path?: string; errore?: string; qualita?: Qualita }> {
  const s = (sku ?? '').trim()
  try {
    if (!s) throw new Error('SKU mancante')
    const dict = loadDictionary()
    const { scene } = await costruisciScena(s, dict)
    const svg = await renderSceneServer(scene)
    const { path } = await exportScene({ svg, sku: scene.sku })
    return { sku: s, ok: true, path, qualita: valutaQualita(scene) }
  } catch (e) {
    return { sku: s, ok: false, errore: descriviErrore(e) }
  }
}

/**
 * Messaggio d'errore leggibile per il banco. Il caso più comune è il download di un'immagine
 * prodotto con URL non risolvibile (es. record con host placeholder `esempio.local`): undici
 * lancia un opaco "fetch failed" con la causa reale (ENOTFOUND + hostname) annidata in `cause`.
 * La srotoliamo così l'operatore capisce che è l'immagine irraggiungibile, non un bug.
 */
function descriviErrore(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const cause = (e as { cause?: { code?: string; hostname?: string } }).cause
  if (e.message === 'fetch failed' && cause?.hostname) {
    return `download non riuscito: host ${cause.hostname} non raggiungibile${cause.code ? ` (${cause.code})` : ''}`
  }
  return e.message
}

export async function cambiaFotoAction(
  sku: string,
  url: string,
  // `nBadge`: numero di badge della scena corrente (solo ramo prodotto singolo, senza `gruppo`) —
  // dev'essere lo stesso usato al compose iniziale, altrimenti il riquadro-foto (fotoBoxHeight)
  // cambierebbe dimensione tra compose e cambio-foto senza motivo. Passato dal client (StudioClient
  // ha già la scena in memoria); assente/0 se non fornito.
  opts?: { forzaVision?: boolean; gruppo?: string; nBadge?: number },
): Promise<{
  imageHash: string
  imageDataUri: string
  foto: { x: number; y: number; width: number; height: number }
  quote: QuotaSpec[]
  ritagliata: boolean
  gruppo?: string
}> {
  const product = await getProduct((sku ?? '').trim())
  if (!product) throw new Error('Prodotto non trovato')
  if (!product.images.includes(url)) throw new Error('URL immagine non appartenente al prodotto')

  const deps: { download?: (url: string) => Promise<Buffer>; dir?: string } | undefined = isFake()
    ? { download: fakeDownload() }
    : undefined
  const cached = await cacheImage(url, deps)
  const bytes = readCachedImage(cached.hash, cached.ext)
  const mime = extToMime(cached.ext)
  const box = await resolveBBox(bytes, cached.hash, { ...deps, mime, forzaVision: opts?.forzaVision })

  let imageHash = cached.hash
  let bytesUsati = bytes
  let bbox: { width: number; height: number } | null = null
  if (box) {
    const cropped = await sharp(bytes)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .png()
      .toBuffer()
    imageHash = writeImageBytes(cropped, deps?.dir).hash
    bytesUsati = cropped
    bbox = { width: box.width, height: box.height }
  }

  // Con `gruppo`: la scheda è un template "set" — dimensioni e cella-foto vanno ri-derivate dal
  // sotto-prodotto giusto (non dal prodotto-singolo). Senza `gruppo`: comportamento odierno
  // (colonna-sinistra, fotoBoxHeight, parseDimensions).
  let cella: { x: number; y: number; width: number; height: number } = {
    x: FOTO_BOX_X,
    y: FOTO_BOX_Y,
    width: FOTO_BOX_WIDTH,
    height: fotoBoxHeight(opts?.nBadge ?? 0, CANVAS.height),
  }
  let dim: Dimensioni | null
  if (opts?.gruppo) {
    const sottoProdotti = parseSetDimensions(product.notaTecnica)
    const indice = sottoProdotti.findIndex((sp) => sp.gruppo === opts.gruppo)
    if (indice < 0) throw new Error(`Gruppo ${opts.gruppo} non trovato nel prodotto ${sku}`)
    cella = celleProdotti(sottoProdotti.length)[indice]
    dim = sottoProdotti[indice].dimensioni
  } else {
    dim = parseDimensions(product.notaTecnica)
  }

  // Prospettiva della NUOVA foto (solo ramo prodotto singolo, cioè senza `gruppo`, e solo se la
  // quota di profondità serve davvero): la linea di profondità resta parallela allo spigolo del
  // prodotto anche dopo il cambio immagine. Stessi bytes/hash già letti sopra (pre-ritaglio).
  const prospettiva =
    !opts?.gruppo && dim?.profondita != null ? await resolveProspettiva(bytes, cached.hash, { mime }) : null

  const fitted = fitFoto(bbox ?? { width: cella.width, height: cella.height }, cella)
  const quote = opts?.gruppo ? [] : dim ? quoteFromBBox(fitted, dim, prospettiva) : []
  const extUsato = box ? 'png' : cached.ext
  const imageDataUri = `data:${extToMime(extUsato)};base64,${bytesUsati.toString('base64')}`

  return {
    imageHash,
    imageDataUri,
    foto: fitted,
    quote,
    ritagliata: box !== null,
    ...(opts?.gruppo ? { gruppo: opts.gruppo } : {}),
  }
}

/**
 * Livello 1 "memoria correzioni": se l'operatore ha corretto a mano la quota diagonale
 * (profondità) in editor, deduce la Prospettiva da quella correzione e la salva come override
 * `origine='manuale'` — Vision non la sovrascriverà più (vedi `saveProspettiva`). Solo per
 * prodotto singolo (`colonna-sinistra`): i template "set" non hanno quota profondità.
 * Non deve mai far fallire il salvataggio scena: logga e prosegue in caso di errore.
 */
async function catturaCorrezioneProspettiva(scene: Scene): Promise<void> {
  try {
    if (scene.templateId !== TEMPLATE_ID) return
    const diagonale = scene.elements.find(
      (e): e is Extract<typeof e, { type: 'quota' }> => e.type === 'quota' && e.orientamento === 'diagonale',
    )
    const foto = scene.elements.find((e) => e.type === 'foto')
    if (!diagonale || !foto) return

    const product = await getProduct(scene.sku)
    const url = product?.images[0]
    if (!url) return

    // Hash dell'immagine ORIGINALE (pre-ritaglio bbox): è quello usato da resolveProspettiva/compose,
    // NON l'imageHash della scena (quello è il ritaglio). Se non combaciano l'override non verrebbe
    // mai riletto. cacheImage legge/scrive solo il file locale già scaricato: nessuna rete extra.
    const downloadDeps = isFake() ? { download: fakeDownload() } : undefined
    const { hash } = await cacheImage(url, downloadDeps)

    const prospettiva = prospettivaDaQuotaDiagonale(diagonale)
    await saveProspettiva(hash, prospettiva, 'manuale')
  } catch (e) {
    console.warn('[saveSceneAction] cattura correzione prospettiva fallita, scena salvata comunque:', e)
  }
}

export async function saveSceneAction(sceneJson: string): Promise<void> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  await catturaCorrezioneProspettiva(scene)
  await db.scene.upsert({
    where: { sku: scene.sku },
    create: { sku: scene.sku, sceneJson: JSON.stringify(scene) },
    update: { sceneJson: JSON.stringify(scene) },
  })
}

export async function loadSceneAction(sku: string): Promise<{
  scene: Scene
  iconMap: Record<string, string>
  imageMap: Record<string, string>
  iconeNonApprovate: string[]
} | null> {
  const s = (sku ?? '').trim()
  if (!/^[A-Za-z0-9._-]+$/.test(s)) throw new Error('SKU non valido')
  const row = await db.scene.findUnique({ where: { sku: s } })
  if (!row) return null
  const scene: Scene = parseScene(JSON.parse(row.sceneJson))
  const dict = loadDictionary()
  const bundle = await resolveRenderBundle(scene)
  const editor = await resolveEditorIcons(Object.keys(dict.features))
  return {
    scene,
    iconMap: editor.iconMap,
    imageMap: bundle.imageMap,
    iconeNonApprovate: editor.inRevisione,
  }
}

export async function exportSceneAction(
  sceneJson: string,
): Promise<{ path: string; svgText: string; jpegDataUri: string; iconeNonApprovate: string[] }> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  const svg = await renderSceneServer(scene)
  // `jpeg` è già il raster completo (2000px, stesso file scritto su disco): usato sia per
  // l'anteprima in editor sia per il download — niente ri-lettura da disco né ridimensionamento
  // separato per una miniatura (formato unico, scelta dell'operatore tra SVG e JPEG).
  const { path, jpeg } = await exportScene({ svg, sku: scene.sku })
  const chiaviScena = [...new Set(scene.elements.filter((e) => e.type === 'icona-label').map((e) => e.chiave))]
  const approvate = await resolveIconsForKeys(chiaviScena)
  const iconeNonApprovate = chiaviScena.filter((k) => !(k in approvate))
  return {
    path,
    svgText: svg,
    jpegDataUri: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    iconeNonApprovate,
  }
}

export async function cercaIconeAction(q: string): Promise<{ id: string; innerSvg: string }[]> {
  const s = (q ?? '').trim()
  if (s.length < 2) return []
  const search = isFake() ? { fetchJson: undefined } : {}
  const candidati = isFake() ? await fakeSearchIconify()(s) : await searchIconify(s, search)
  const fetchSvg = isFake() ? fakeFetchIconifySvg() : (id: string) => fetchIconifySvg(id)
  const out: { id: string; innerSvg: string }[] = []
  for (const c of candidati.slice(0, 12)) {
    try {
      const raw = await fetchSvg(c.id)
      out.push({ id: c.id, innerSvg: innerSvg(normalizeIconSvg(raw)) })
    } catch {
      // salta le candidate non scaricabili
    }
  }
  return out
}

export async function scegliIconaAction(chiave: string, iconifyId: string): Promise<{ innerSvg: string }> {
  const dict = loadDictionary()
  if (!(chiave in dict.features)) throw new Error('Chiave non nel dizionario')
  const [set, name] = iconifyId.split(':')
  if (!name || !(ICONIFY_SETS as readonly string[]).includes(set)) throw new Error('Id icona non valido')
  const raw = isFake() ? await fakeFetchIconifySvg()(iconifyId) : await fetchIconifySvg(iconifyId)
  const rec = await saveIcon({ key: chiave, rawSvg: raw, source: `iconify:${set}`, license: 'iconify-permissive' })
  return { innerSvg: innerSvg(rec.svg) }
}

export async function approveIconAction(chiave: string): Promise<void> {
  await approveIcon(chiave)
}

export async function listIconeAction(): Promise<{ key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }[]> {
  const icone = await listIcons()
  return icone.map((i) => ({ key: i.key, innerSvg: innerSvg(i.svg), status: i.status }))
}

export async function seedIconeAction(): Promise<{ create: number; salta: number }> {
  const dict = loadDictionary()
  let create = 0
  let salta = 0
  for (const chiave of Object.keys(dict.features)) {
    if (await getIcon(chiave)) {
      salta++
      continue
    }
    try {
      const cand = isFake() ? await fakeSearchIconify()(chiave) : await searchIconify(chiave.replace(/_/g, ' '))
      const id = dict.features[chiave].icona.includes(':') ? dict.features[chiave].icona : cand[0]?.id
      if (!id) {
        continue
      }
      const raw = isFake() ? await fakeFetchIconifySvg()(id) : await fetchIconifySvg(id)
      await saveIcon({ key: chiave, rawSvg: raw, source: `iconify:${id.split(':')[0]}`, license: 'iconify-permissive' })
      create++
    } catch {
      // salta la chiave in errore
    }
  }
  return { create, salta }
}
