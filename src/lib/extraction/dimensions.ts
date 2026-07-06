export interface Dimensioni {
  larghezza: number | null
  profondita: number | null
  altezza: number | null
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
// "l. 51 x p. 63 x h. 84,5 cm" (etichettato) — provato per primo
const LABELED = new RegExp(String.raw`l\.?\s*${NUM}\s*x\s*p\.?\s*${NUM}\s*x\s*h\.?\s*${NUM}\s*cm`, 'i')
// "83,3x65,3x177,5 cm" (compatto, interpretato come L x P x H)
const COMPACT = new RegExp(String.raw`${NUM}\s*x\s*${NUM}\s*x\s*h?\.?\s*${NUM}\s*cm`, 'i')

function toNum(s: string): number {
  return Number.parseFloat(s.replace(',', '.'))
}

export function parseDimensions(notaTecnica: string[]): Dimensioni | null {
  for (const line of notaTecnica) {
    const m = LABELED.exec(line) ?? COMPACT.exec(line)
    if (m) return { larghezza: toNum(m[1]), profondita: toNum(m[2]), altezza: toNum(m[3]) }
  }
  return null
}
