'use server'

import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct, searchProducts } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from '../../scripts/compose-lib'
import { resolveRenderBundle, resolveIconsForKeys, resolveEditorIcons, renderSceneServer, innerSvg } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import type { ProposeResult } from '@/lib/ui/types'
import { isFake, fakeGenerate, fakeDownload, fakeSearchIconify, fakeFetchIconifySvg } from '@/lib/testing/fake'
import { cacheImage, readCachedImage, writeImageBytes } from '@/lib/images/cache'
import { extToMime } from '@/lib/ui/mime'
import { resolveBBox } from '@/lib/images/resolve-bbox'
import { fitFoto, quoteFromBBox, celleProdotti, type QuotaSpec } from '@/lib/layout/engine'
import { FOTO_BOX } from '@/lib/layout/colonna-sinistra'
import { parseDimensions, parseSetDimensions, type Dimensioni } from '@/lib/extraction/dimensions'
import { db } from '@/lib/db'
import { searchIconify, fetchIconifySvg, ICONIFY_SETS } from '@/lib/icons/iconify'
import { saveIcon, approveIcon, getIcon, listIcons } from '@/lib/icons/repository'
import { normalizeIconSvg } from '@/lib/icons/normalize'

export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(s)
  if (!product) throw new Error(`SKU ${s} non trovato nel feed`)

  const dict = loadDictionary()
  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, dict, generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

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

export async function cambiaFotoAction(
  sku: string,
  url: string,
  opts?: { forzaVision?: boolean; gruppo?: string },
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
  // (colonna-sinistra, FOTO_BOX, parseDimensions).
  let cella: { x: number; y: number; width: number; height: number } = FOTO_BOX
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

  const fitted = fitFoto(bbox ?? { width: cella.width, height: cella.height }, cella)
  const quote = dim ? quoteFromBBox(fitted, dim) : []
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

export async function saveSceneAction(sceneJson: string): Promise<void> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
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
): Promise<{ path: string; thumbDataUri: string; iconeNonApprovate: string[] }> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  const svg = await renderSceneServer(scene)
  const path = await exportScene({ svg, sku: scene.sku })
  // Miniatura da Buffer (non da path): su Windows sharp/libvips mmappa il file di input e,
  // nel processo server long-lived, l'handle resta appeso impedendo una successiva
  // sovrascrittura di output/{sku}.jpg (ri-export dello stesso SKU). Leggere i byte evita l'mmap.
  const thumb = await sharp(readFileSync(path)).resize(240, 240).jpeg({ quality: 80 }).toBuffer()
  const chiaviScena = [...new Set(scene.elements.filter((e) => e.type === 'icona-label').map((e) => e.chiave))]
  const approvate = await resolveIconsForKeys(chiaviScena)
  const iconeNonApprovate = chiaviScena.filter((k) => !(k in approvate))
  return {
    path,
    thumbDataUri: `data:image/jpeg;base64,${thumb.toString('base64')}`,
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
