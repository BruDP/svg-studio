import type { Scene, SceneElement, IconLabelElement } from '@/lib/scene/types'
import { colonnaPositions } from '@/lib/layout/engine'

export type SceneAction =
  | { type: 'sposta-feature'; id: string; direzione: 'su' | 'giu' }
  | { type: 'rimuovi'; id: string }
  | { type: 'aggiungi-feature'; chiave: string; etichetta: string }
  | { type: 'modifica-etichetta'; id: string; etichetta: string }
  | { type: 'sposta-quota'; id: string; estremo: 'inizio' | 'fine'; x: number; y: number }
  | { type: 'imposta-foto'; imageHash: string }

function isIcona(el: SceneElement): el is IconLabelElement {
  return el.type === 'icona-label'
}

/** Ricostruisce le posizioni della colonna icone nell'ordine dato, preservando lo startY corrente. */
function riflow(icone: IconLabelElement[], startY: number): IconLabelElement[] {
  const pos = colonnaPositions(icone.length, startY)
  return icone.map((el, i) => ({ ...el, x: pos[i].x, y: pos[i].y }))
}

/** Ricompone gli elementi sostituendo le icone-label (in ordine) e tenendo gli altri al loro posto. */
function conIcone(scene: Scene, nuoveIcone: IconLabelElement[]): Scene {
  let k = 0
  const elements = scene.elements.map((el) => (isIcona(el) ? nuoveIcone[k++] : el))
  // se sono state aggiunte icone oltre a quelle esistenti, appendile in coda
  while (k < nuoveIcone.length) {
    elements.push(nuoveIcone[k++])
  }
  return { ...scene, elements }
}

function startYCorrente(scene: Scene): number {
  const prima = scene.elements.find(isIcona)
  return prima ? prima.y : 160
}

function nuovoId(scene: Scene): string {
  let n = scene.elements.filter(isIcona).length
  const usati = new Set(scene.elements.map((e) => e.id))
  while (usati.has(`f-${n}`)) n++
  return `f-${n}`
}

export function applyMutation(scene: Scene, action: SceneAction): Scene {
  const startY = startYCorrente(scene)
  const icone = scene.elements.filter(isIcona)

  switch (action.type) {
    case 'sposta-feature': {
      const i = icone.findIndex((e) => e.id === action.id)
      if (i < 0) return scene
      const j = action.direzione === 'su' ? i - 1 : i + 1
      if (j < 0 || j >= icone.length) return scene
      const arr = [...icone]
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return conIcone(scene, riflow(arr, startY))
    }
    case 'rimuovi': {
      if (!icone.some((e) => e.id === action.id)) return scene
      // ricostruisci senza l'elemento rimosso
      const elements = scene.elements.filter((e) => e.id !== action.id)
      const riflowate = riflow(elements.filter(isIcona), startY)
      let k = 0
      return { ...scene, elements: elements.map((el) => (isIcona(el) ? riflowate[k++] : el)) }
    }
    case 'aggiungi-feature': {
      const nuova: IconLabelElement = {
        type: 'icona-label',
        id: nuovoId(scene),
        chiave: action.chiave,
        etichetta: action.etichetta,
        x: 0,
        y: 0,
        verificata: false,
      }
      return conIcone(scene, riflow([...icone, nuova], startY))
    }
    case 'modifica-etichetta': {
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          isIcona(el) && el.id === action.id ? { ...el, etichetta: action.etichetta } : el,
        ),
      }
    }
    case 'sposta-quota': {
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
      const x = clamp(action.x, scene.canvas.width)
      const y = clamp(action.y, scene.canvas.height)
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          el.type === 'quota' && el.id === action.id
            ? action.estremo === 'inizio'
              ? { ...el, x1: x, y1: y }
              : { ...el, x2: x, y2: y }
            : el,
        ),
      }
    }
    case 'imposta-foto': {
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          el.type === 'foto' ? { ...el, imageHash: action.imageHash } : el,
        ),
      }
    }
  }
}
