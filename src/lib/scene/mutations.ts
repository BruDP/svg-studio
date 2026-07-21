import type { Scene, SceneElement, IconLabelElement } from '@/lib/scene/types'
import { colonnaPositions } from '@/lib/layout/engine'

export type SceneAction =
  | { type: 'sposta-feature'; id: string; direzione: 'su' | 'giu' }
  | { type: 'rimuovi'; id: string }
  | { type: 'toggle-profondita' }
  | { type: 'aggiungi-feature'; chiave: string; etichetta: string }
  | { type: 'modifica-etichetta'; id: string; etichetta: string }
  | { type: 'sposta-quota'; id: string; estremo: 'inizio' | 'fine'; x: number; y: number }
  | {
      type: 'imposta-foto'
      imageHash: string
      foto?: { x: number; y: number; width: number; height: number }
      quote?: { orientamento: 'verticale' | 'orizzontale' | 'diagonale'; valore: string; x1: number; y1: number; x2: number; y2: number }[]
      /**
       * Sotto-prodotto target (scheda "set"). Se presente, l'aggiornamento tocca SOLO la foto e le
       * quote con `el.gruppo === gruppo`; il resto della scena (altri gruppi, icone, badge, testo)
       * resta invariato. Senza `gruppo`: comportamento odierno (agisce su tutte le foto/quote).
       */
      gruppo?: string
    }

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
    case 'toggle-profondita': {
      // Mostra/nascondi SOLO la quota di profondità (diagonale): utile per prodotti sferici/irregolari.
      // Non la elimina — flippa `nascosta` così ripremendo il tasto riappare identica. Altezza
      // (verticale) e larghezza (orizzontale) restano SEMPRE visibili.
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          el.type === 'quota' && el.orientamento === 'diagonale' ? { ...el, nascosta: !el.nascosta } : el,
        ),
      }
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
      const nuoveQuote = action.quote
      const gruppo = action.gruppo
      // senza `gruppo`: ogni foto/quota è "del gruppo giusto" (comportamento odierno invariato).
      // con `gruppo`: solo gli elementi con el.gruppo === gruppo vengono toccati; gli altri
      // (altri gruppi, icone, badge, testo) passano invariati nel ramo else.
      const inTarget = (el: { gruppo?: string }) => gruppo === undefined || el.gruppo === gruppo
      let qi = 0
      const elements: SceneElement[] = []
      for (const el of scene.elements) {
        if (el.type === 'foto' && inTarget(el)) {
          elements.push(
            action.foto
              ? { ...el, imageHash: action.imageHash, x: action.foto.x, y: action.foto.y, width: action.foto.width, height: action.foto.height }
              : { ...el, imageHash: action.imageHash },
          )
        } else if (el.type === 'quota' && nuoveQuote && inTarget(el)) {
          // sostituzione posizionale (ristretta alle quote del gruppo target): preserva id e
          // ordine; scarta le quote in eccesso
          if (qi < nuoveQuote.length) {
            elements.push({ ...el, ...nuoveQuote[qi] })
            qi++
          }
          // se qi >= nuoveQuote.length: quota in eccesso → non ripushata (rimossa)
        } else {
          elements.push(el)
        }
      }
      // quote nuove oltre quelle esistenti (nel gruppo target) → append con id progressivi
      // (`q-<gruppo>-<qi>` con gruppo, `q<qi>` senza — coerente con gli id generati da compose)
      if (nuoveQuote) {
        for (; qi < nuoveQuote.length; qi++) {
          elements.push({
            type: 'quota',
            id: gruppo !== undefined ? `q-${gruppo}-${qi}` : `q${qi}`,
            ...(gruppo !== undefined ? { gruppo } : {}),
            ...nuoveQuote[qi],
          })
        }
      }
      return { ...scene, elements }
    }
  }
}
