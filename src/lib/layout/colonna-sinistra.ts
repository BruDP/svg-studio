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
 * `x` resta a destra della colonna icone+etichette (che finisce ~x=454: cerchio a x=60..144 +
 * labelMaxLarghezza 290). Larghezza contenuta (400) per lasciare a destra spazio alla
 * freccia-quota verticale e alla sua etichetta accostata (es. "84,5 cm"); l'altezza è ampia
 * (il guadagno di dimensione viene soprattutto dal riempimento del ritaglio).
 */
export const FOTO_BOX = {
  x: 460,
  y: 95,
  width: 400,
  height: 780,
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

  // Foto scalata dentro il riquadro (aspect ratio dal bbox, o riquadro pieno se assente)
  const fitted = fitFoto(bbox ?? { width: FOTO_BOX.width, height: FOTO_BOX.height }, FOTO_BOX)
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
