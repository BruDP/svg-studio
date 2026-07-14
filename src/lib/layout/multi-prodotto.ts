import type { SchedaProposal } from '@/lib/extraction/engine'
import type { Scene, SceneElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { celleProdotti, fitFoto, grigliaPositions, quoteFromBBox } from './engine'

export const TEMPLATE_ID = 'multi-prodotto'
export const CANVAS = { width: 1000, height: 1000 }

/**
 * Larghezza massima (px) di wrap per le etichette della griglia icone condivisa.
 * `GRIGLIA_COL_GAP` (engine.ts) lascia ~196px reali tra il bordo destro di un'etichetta e
 * l'inizio della colonna successiva (300 − diametro cerchio 84 − labelGap 20). Il default
 * globale `theme.margini.labelMaxLarghezza` (290) è calibrato per `colonna-sinistra` (colonna
 * singola, molto più spazio orizzontale) e invaderebbe la colonna successiva qui. Margine di
 * sicurezza sotto i 196px reali.
 */
const GRIGLIA_LABEL_MAX_LARGHEZZA = 190

export function composeMultiProdotto(input: {
  proposal: SchedaProposal
  fotoPerGruppo: { gruppo: string; imageHash: string; bbox: { width: number; height: number } | null }[]
}): Scene {
  const { proposal, fotoPerGruppo } = input
  const sottoProdotti = proposal.sottoProdotti ?? []
  const elements: SceneElement[] = []

  const fotoByGruppo = new Map(fotoPerGruppo.map((f) => [f.gruppo, f]))
  const celle = celleProdotti(sottoProdotti.length)

  sottoProdotti.forEach((pezzo, i) => {
    const cella = celle[i]
    const foto = fotoByGruppo.get(pezzo.gruppo)
    const bbox = foto?.bbox ?? { width: cella.width, height: cella.height }
    const fitted = fitFoto(bbox, cella)

    elements.push({
      type: 'foto',
      id: `ph-g${i}`,
      imageHash: foto?.imageHash ?? '',
      x: fitted.x,
      y: fitted.y,
      width: fitted.width,
      height: fitted.height,
      gruppo: pezzo.gruppo,
    })

    quoteFromBBox(fitted, pezzo.dimensioni).forEach((q, j) => {
      elements.push({ type: 'quota', id: `q-g${i}-${j}`, gruppo: pezzo.gruppo, ...q })
    })

    // Badge del pezzo (es. capacità), impilati sopra la foto (stack verso l'alto per j
    // crescente, simmetrico a come colonna-sinistra li impila sotto la foto).
    const badgeGap = theme.freccia.testa + 16
    pezzo.badges.forEach((b, j) => {
      elements.push({
        type: 'badge',
        id: `bg-g${i}-${j}`,
        gruppo: pezzo.gruppo,
        testo: b.etichetta,
        x: fitted.x,
        y: fitted.y - badgeGap - theme.badge.altezza - j * (theme.badge.altezza + 8),
      })
    })
  })

  // Icone condivise (feature comuni al set) in griglia, sotto la riga di celle-foto.
  const posizioni = grigliaPositions(proposal.features.length)
  proposal.features.forEach((f, k) => {
    elements.push({
      type: 'icona-label',
      id: `f${k}`,
      chiave: f.chiave,
      etichetta: f.etichetta,
      x: posizioni[k].x,
      y: posizioni[k].y,
      verificata: f.verificata,
      maxLarghezzaEtichetta: GRIGLIA_LABEL_MAX_LARGHEZZA,
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
