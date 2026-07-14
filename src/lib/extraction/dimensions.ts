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
// "Ø 70 x h. 75 cm" (prodotto tondo: diametro × altezza) — il diametro diventa la larghezza,
// la profondità resta assente (una quota diagonale uguale alla larghezza sarebbe ridondante).
const DIAMETRO = new RegExp(String.raw`[Øø⌀]\s*${NUM}\s*x\s*h?\.?\s*${NUM}\s*cm`, 'i')
// "Misure: 70 x h. 75 cm" — stesso caso tondo, ma il feed omette il simbolo Ø (18 prodotti
// reali nel feed usano questa forma). Stessa interpretazione di DIAMETRO (2 numeri →
// larghezza/altezza, profondità assente); richiede il prefisso "Misure" per non intercettare
// per sbaglio una coppia di numeri "N x M cm" non dimensionale altrove nel testo.
const MISURE_SENZA_DIAMETRO = new RegExp(String.raw`Misure\s*:?\s*${NUM}\s*x\s*h?\.?\s*${NUM}\s*cm`, 'i')

function toNum(s: string): number {
  return Number.parseFloat(s.replace(',', '.'))
}

export function parseDimensions(notaTecnica: string[]): Dimensioni | null {
  for (const line of notaTecnica) {
    const m = LABELED.exec(line) ?? COMPACT.exec(line)
    if (m) return { larghezza: toNum(m[1]), profondita: toNum(m[2]), altezza: toNum(m[3]) }
    const tondo = DIAMETRO.exec(line) ?? MISURE_SENZA_DIAMETRO.exec(line)
    if (tondo) return { larghezza: toNum(tondo[1]), profondita: null, altezza: toNum(tondo[2]) }
  }
  return null
}
