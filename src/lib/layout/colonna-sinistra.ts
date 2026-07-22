import type { SchedaProposal } from '@/lib/extraction/engine'
import type { Prospettiva } from '@/lib/images/vision-prospettiva'
import type { Scene, SceneElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { colonnaPositions, fitFoto, quoteFromBBox } from './engine'
import { estraiTitolo } from './titolo'

export const TEMPLATE_ID = 'colonna-sinistra'
export const CANVAS = { width: 1000, height: 1000 }

/**
 * Riquadro destinato alla foto (metà destra del canvas). Il prodotto è ritagliato sul suo
 * bounding box (compose-lib) e riempie il riquadro senza margini bianchi → grande e dominante.
 * `x` resta a destra della colonna icone+etichette (che finisce ~x=422: cerchio a x=60..144 +
 * labelMaxLarghezza 258), con un piccolo margine dall'hairline del pannello (PANEL_WIDTH in
 * svg.ts, 430). `width` è il massimo che lascia comunque spazio, a destra, alla freccia-quota
 * verticale (altezza) e alla sua etichetta accostata (es. "177,5 cm") senza uscire dal canvas —
 * vedi il test di bounds in layout-colonna-sinistra.test.ts.
 */
export const FOTO_BOX_X = 438
export const FOTO_BOX_Y = 60
export const FOTO_BOX_WIDTH = 427

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

  // Intestazione: eyebrow (marchio, maiuscoletto) + titolo (nome prodotto, prima parte prima della
  // virgola per togliere misure/varianti dalla riga-titolo). Ancora editoriale nella colonna sx.
  let iconStartY = 160
  if (nome) {
    if (marchio) {
      elements.push({ type: 'testo', id: 'eyebrow', testo: marchio, x: theme.margini.colonnaX, y: 52, ruolo: 'sottotitolo' })
    }
    const titolo = estraiTitolo(nome, marchio)
    elements.push({ type: 'testo', id: 'titolo', testo: titolo, x: theme.margini.colonnaX, y: 80, ruolo: 'titolo' })
    iconStartY = 232 // sotto l'intestazione (eyebrow + titolo fino a 2 righe)
  }

  // Icone in colonna, nell'ordine del ranking
  const posizioni = colonnaPositions(proposal.features.length, iconStartY)
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
  // L'altezza del riquadro dipende dal numero di badge di QUESTA proposta (vedi fotoBoxHeight):
  // con meno badge il riquadro (e quindi la foto) può essere più grande.
  const fotoBox = {
    x: FOTO_BOX_X,
    y: FOTO_BOX_Y,
    width: FOTO_BOX_WIDTH,
    height: fotoBoxHeight(proposal.badges.length, CANVAS.height),
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

  // Badge sotto la foto. Deve restare sotto l'etichetta della quota orizzontale (se presente),
  // che nello stile "premium" è staccata dalla linea di labelGap+fontSize (non più centrata
  // sulla linea come nello stile precedente) — senza questo margine badge e quota si toccano.
  const badgeStartY =
    fitted.y + fitted.height + theme.freccia.testa + theme.freccia.labelGap + theme.testo.etichetta + 16
  proposal.badges.forEach((b, i) => {
    elements.push({
      type: 'badge',
      id: `bg${i}`,
      testo: b.etichetta,
      x: fitted.x,
      y: badgeStartY + i * 60,
    })
  })

  return {
    version: SCENE_VERSION,
    sku: proposal.sku,
    templateId: TEMPLATE_ID,
    canvas: CANVAS,
    elements,
  }
}
