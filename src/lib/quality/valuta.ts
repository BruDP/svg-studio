import type { Scene } from '@/lib/scene/types'

/** Numero minimo di icone-caratteristica desiderato per scheda (vedi padding in rankFeatures). */
export const MIN_ICONE = 6

export interface Qualita {
  icone: number
  daVerificare: number
  problemi: string[]
  daRivedere: boolean
}

/** Valuta la qualità di una scena (pura): conta icone e feature da verificare e produce messaggi. */
export function valutaQualita(scene: Scene): Qualita {
  const icone = scene.elements.filter((e) => e.type === 'icona-label')
  const daVerificare = icone.filter((e) => e.type === 'icona-label' && e.verificata === false).length
  const problemi: string[] = []
  if (icone.length < MIN_ICONE) problemi.push(`solo ${icone.length} icone (min ${MIN_ICONE})`)
  if (daVerificare > 0) problemi.push(`${daVerificare} caratteristiche da verificare`)
  return { icone: icone.length, daVerificare, problemi, daRivedere: problemi.length > 0 }
}
