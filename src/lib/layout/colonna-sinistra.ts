import type { SchedaProposal } from '@/lib/extraction/engine'
import type { Prospettiva } from '@/lib/images/vision-prospettiva'
import type { Scene, SceneElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { colonnaPositions, fitFoto, quoteFromBBox } from './engine'
import { estraiTitolo } from './titolo'
import { accentoPerCategoria } from '@/lib/theme-satur'
import { brandDaMostrare } from '@/lib/branding/linea'

export const TEMPLATE_ID = 'colonna-sinistra'
export const CANVAS = { width: 1000, height: 1000 }

/**
 * Riquadro destinato alla foto (metà destra del canvas). Il prodotto è ritagliato sul suo
 * bounding box (compose-lib) e riempie il riquadro senza margini bianchi → grande e dominante.
 * `x` resta a destra della colonna icone+etichette (che finisce ~x=340: cerchio a x=60..120 +
 * labelMaxLarghezza 204), con un piccolo margine dall'hairline del pannello (PANEL_WIDTH in
 * svg.ts, 360). `width` è il massimo che lascia comunque spazio, a destra, alla freccia-quota
 * verticale (altezza) e alla sua etichetta accostata (es. "177,5 cm") senza uscire dal canvas —
 * vedi il test di bounds in layout-colonna-sinistra.test.ts. Colonna icone ristretta (rispetto
 * alla versione precedente) apposta per dare alla foto la parte larga del canvas: la foto
 * prodotto deve restare la protagonista visiva della scheda.
 */
export const FOTO_BOX_X = 412
export const FOTO_BOX_Y = 60
export const FOTO_BOX_WIDTH = 460

/**
 * Altezza del riquadro foto: il massimo che lascia comunque spazio, in basso, agli N badge
 * impilati sotto la foto (ognuno `theme.badge.altezza` + 8px di distacco, più il gap fisso prima
 * del primo) senza uscire dal canvas — replica la formula di posizionamento badge più sotto in
 * questa stessa funzione. Con 0 badge il riquadro arriva quasi al bordo inferiore del canvas.
 */
export function fotoBoxHeight(nBadge: number, canvasHeight: number): number {
  const primoBadgeGap = theme.freccia.testa + theme.freccia.labelGap + theme.testo.etichetta + 16
  const riservaBadge = nBadge === 0 ? 0 : primoBadgeGap + (nBadge - 1) * (theme.badge.altezza + 8) + theme.badge.altezza
  return canvasHeight - riservaBadge - FOTO_BOX_Y
}

export function composeColonnaSinistra(input: {
  proposal: SchedaProposal
  imageHash: string
  bbox: { width: number; height: number } | null
  // Prospettiva rilevata via Vision sulla foto (spigolo di profondità): opzionale, risolta a
  // monte in compose-lib.ts. Se assente/null la quota di profondità usa l'inclinazione di
  // default (nessuna prospettiva rilevata o foto frontale).
  prospettiva?: Prospettiva | null
  // Nome prodotto (descrizioneBreve) e marchio per l'intestazione editoriale in alto a sinistra.
  // Opzionali/retrocompatibili: senza nome, niente titolo e le icone partono più in alto.
  nome?: string
  marchio?: string
}): Scene {
  const { proposal, imageHash, bbox, prospettiva, nome, marchio } = input
  const elements: SceneElement[] = []

  // Intestazione (design clean): logo/eyebrow marchio in alto al margine, poi il titolo prodotto
  // grande. Niente più lockup Satur sopra, quindi l'intestazione parte dal margine alto.
  let iconStartY = 160
  if (nome) {
    if (marchio) {
      // Eyebrow = LINEA se riconosciuta dalla descrizione (es. BestBQ/Esté/FitLover/Kooper X),
      // altrimenti il marchio del feed. Il renderer ci mette il LOGO (assets/loghi/<slug>) se il
      // file esiste, altrimenti il wordmark. Vedi branding/linea.ts.
      const brand = brandDaMostrare(nome, marchio)
      elements.push({ type: 'testo', id: 'eyebrow', testo: brand, x: theme.margini.colonnaX, y: 76, ruolo: 'sottotitolo' })
    }
    const titolo = estraiTitolo(nome, marchio)
    elements.push({ type: 'testo', id: 'titolo', testo: titolo, x: theme.margini.colonnaX, y: 158, ruolo: 'titolo' })
    iconStartY = 308 // sotto l'intestazione (logo/eyebrow + titolo grande fino a 2 righe)
  }

  // Icone in colonna, nell'ordine del ranking. Il blocco viene CENTRATO verticalmente nello spazio
  // del pannello sotto l'intestazione [iconStartY .. bordo-basso]: così le schede con poche feature
  // (es. barbecue con 2 icone, testo feed scarno) non restano sbilanciate in alto con un grande
  // vuoto sotto — lo spazio bianco resta simmetrico e intenzionale. Con molte feature il blocco è
  // già quasi pieno, quindi lo start resta ≈ iconStartY (offset ~0).
  // Se c'è un "hero stat" (capacità/portata) va in basso a sinistra: la zona di centratura delle
  // feature si ferma prima, per non sovrapporsi.
  const conHero = proposal.badges.length > 0
  const nFeature = proposal.features.length
  const gap = theme.margini.colonnaGap
  const zonaBasso = conHero ? 820 : CANVAS.height - theme.margini.canvas
  const altezzaBlocco = nFeature > 0 ? (nFeature - 1) * gap + theme.icona.raggio * 2 : 0
  const offsetCentratura = Math.max(0, (zonaBasso - iconStartY - altezzaBlocco) / 2)
  const posizioni = colonnaPositions(nFeature, iconStartY + offsetCentratura)
  proposal.features.forEach((f, i) => {
    elements.push({
      type: 'icona-label',
      id: `f${i}`,
      chiave: f.chiave,
      etichetta: f.etichetta,
      x: posizioni[i].x,
      y: posizioni[i].y,
      verificata: f.verificata,
    })
  })

  // Foto scalata dentro il riquadro (aspect ratio dal bbox, o riquadro pieno se assente).
  // I badge ora sono "hero stat" nella colonna sinistra (non più sotto la foto), quindi il riquadro
  // foto usa l'altezza piena a prescindere dai badge.
  const fotoBox = {
    x: FOTO_BOX_X,
    y: FOTO_BOX_Y,
    width: FOTO_BOX_WIDTH,
    height: fotoBoxHeight(0, CANVAS.height),
  }
  const fitted = fitFoto(bbox ?? { width: fotoBox.width, height: fotoBox.height }, fotoBox)
  elements.push({
    type: 'foto',
    id: 'ph',
    imageHash,
    x: fitted.x,
    y: fitted.y,
    width: fitted.width,
    height: fitted.height,
  })

  // Quote ancorate alla foto
  if (proposal.dimensioni) {
    quoteFromBBox(fitted, proposal.dimensioni, prospettiva).forEach((q, i) => {
      elements.push({ type: 'quota', id: `q${i}`, ...q })
    })
  }

  // "Hero stat" in basso a sinistra: numero grande (es. "515 L") + etichetta piccola sopra
  // (es. "Capienza"). Split della etichetta dizionario ("Capienza {valore} L") sul valore: prima
  // del valore = etichetta piccola, dal valore in poi = numero+unità grande. Ancorato a colonnaX.
  const heroLabelBaseline = 862
  proposal.badges.forEach((b, i) => {
    const v = b.valore ?? ''
    const idx = v ? b.etichetta.indexOf(v) : -1
    const heroValore = idx >= 0 ? b.etichetta.slice(idx).trim() : b.etichetta
    const heroEtichetta = idx > 0 ? b.etichetta.slice(0, idx).trim() : ''
    elements.push({
      type: 'badge',
      id: `bg${i}`,
      testo: b.etichetta,
      heroValore,
      heroEtichetta,
      x: theme.margini.colonnaX,
      y: heroLabelBaseline - (proposal.badges.length - 1 - i) * 88,
    })
  })

  return {
    version: SCENE_VERSION,
    sku: proposal.sku,
    templateId: TEMPLATE_ID,
    canvas: CANVAS,
    elements,
    accento: accentoPerCategoria(proposal.categoria),
  }
}
