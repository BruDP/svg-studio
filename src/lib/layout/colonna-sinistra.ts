import type { SchedaProposal } from '@/lib/extraction/engine'
import type { Scene, SceneElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { colonnaPositions, fitFoto, quoteFromBBox } from './engine'

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
const FOTO_BOX = {
  x: 460,
  y: 95,
  width: 400,
  height: 780,
}

export function composeColonnaSinistra(input: {
  proposal: SchedaProposal
  imageHash: string
  bbox: { width: number; height: number } | null
}): Scene {
  const { proposal, imageHash, bbox } = input
  const elements: SceneElement[] = []

  // Nessun titolo: le schede di riferimento non hanno intestazione (la chiave categoria
  // grezza non è adatta come titolo). Le icone partono dall'alto della colonna.

  // Icone in colonna, nell'ordine del ranking
  const posizioni = colonnaPositions(proposal.features.length, 160)
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
    quoteFromBBox(fitted, proposal.dimensioni).forEach((q, i) => {
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
