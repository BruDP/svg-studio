import type { SottoProdotto } from './engine'

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

// "Misure <etichetta>: l. N x p. N x h. N cm" — blocco misure di un pezzo del set (caso pulito,
// es. "Misure valigia piccola: l. 36 x p. 22 x h. 55 cm"). Cattura etichetta + i tre numeri.
const MISURE_ETICHETTATE = new RegExp(
  String.raw`Misure\s+(.+?)\s*:\s*(l\.?\s*${NUM}\s*x\s*p\.?\s*${NUM}\s*x\s*h\.?\s*${NUM}\s*cm)`,
  'i',
)
// "Capacità <etichetta>: N L" — corrobora un blocco Misure con la stessa etichetta (match esatto,
// trim/lowercase). Solo il caso pulito (set valigie); il giardino usa "Portata ... Kg", non gestito qui.
const CAPACITA = new RegExp(String.raw`Capacità\s+(.+?)\s*:\s*${NUM}\s*L`, 'i')

// Riconosce un "set" nel testo prodotto SOLO nel caso pulito: righe "Misure <etichetta>" accoppiate a
// righe "Capacità <etichetta>" per la STESSA etichetta. Conservativo: ritorna [] (non è un set) se
// trova meno di 2 blocchi corroborati, per non "sparare" su prodotti singoli o su set sporchi
// (badge di portata, righe-accessorio) — quel caso è di un piano futuro, non gestito qui.
export function parseSetDimensions(notaTecnica: string[]): SottoProdotto[] {
  const blocchi: { etichetta: string; dimensioni: Dimensioni }[] = []
  for (const line of notaTecnica) {
    const m = MISURE_ETICHETTATE.exec(line)
    if (m) {
      blocchi.push({
        etichetta: m[1].trim().toLowerCase(),
        dimensioni: { larghezza: toNum(m[3]), profondita: toNum(m[4]), altezza: toNum(m[5]) },
      })
    }
  }

  const capacitaPerEtichetta = new Map<string, string>()
  for (const line of notaTecnica) {
    const m = CAPACITA.exec(line)
    if (m) capacitaPerEtichetta.set(m[1].trim().toLowerCase(), m[2])
  }

  const corroborati = blocchi.filter((b) => capacitaPerEtichetta.has(b.etichetta))
  if (corroborati.length < 2) return []

  return corroborati.map((b, i) => {
    const litri = capacitaPerEtichetta.get(b.etichetta)!
    return {
      gruppo: `g${i}`,
      etichetta: b.etichetta,
      dimensioni: b.dimensioni,
      badges: [
        {
          chiave: 'capacita',
          etichetta: `${litri} L`,
          valore: litri,
          verificata: true,
          priorita: 0,
          badge: true,
        },
      ],
    }
  })
}
