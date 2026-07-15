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

// "Misure <etichetta>: l. N x p. N [x] h. N cm" — blocco misure di un pezzo del set (es.
// "Misure valigia piccola: l. 36 x p. 22 x h. 55 cm"). Cattura etichetta + i tre numeri. Il
// separatore `x` tra profondità e altezza è TOLLERATO come opzionale: nel set giardino reale
// (SKU 2188908, pezzo "tavolinetto") il feed lo omette ("p. 64,5 h. 40,5 cm").
const MISURE_ETICHETTATE = new RegExp(
  String.raw`Misure\s+(.+?)\s*:\s*(l\.?\s*${NUM}\s*x\s*p\.?\s*${NUM}\s*x?\s*h\.?\s*${NUM}\s*cm)`,
  'i',
)
// "Capacità <etichetta>: N L" — corrobora un blocco Misure con la stessa etichetta (match esatto,
// trim/lowercase). Caso pulito (set valigie).
const CAPACITA = new RegExp(String.raw`Capacità\s+(.+?)\s*:\s*${NUM}\s*L`, 'i')
// "Portata massima <etichetta>: N Kg" — corrobora un blocco Misure con la stessa etichetta (match
// esatto, trim/lowercase). Caso sporco (set giardino/mobili: pezzi con portata invece di capacità).
const PORTATA = new RegExp(String.raw`Portata\s+massima\s+(.+?)\s*:\s*${NUM}\s*Kg`, 'i')

// Etichette di accessori noti (cuscini, sedute, schienali) che NON sono mai pezzi di un set, anche
// se comparissero in un blocco "Misure <etichetta>" nel formato completo l./p./h. Il gate badge
// (sotto) le esclude già di norma, non avendo un badge di capacità/portata corrispondente; questo
// set è una difesa in profondità esplicita, documentata come richiesto dal piano. Confronto per
// PAROLA INTERA dell'etichetta (mai substring/fuzzy), per non colpire per errore un'etichetta reale.
const ETICHETTE_ACCESSORIO = new Set(['seduta', 'cuscino', 'cuscini', 'schienale'])

function eAccessorio(etichetta: string): boolean {
  return etichetta.split(/\s+/).some((parola) => ETICHETTE_ACCESSORIO.has(parola))
}

interface BadgePezzo {
  chiave: string
  etichetta: string
  valore: string
}

// Riconosce un "set" nel testo prodotto: righe "Misure <etichetta>" accoppiate a un badge di pezzo
// per la STESSA etichetta — "Capacità <etichetta>" (set valigie) OPPURE "Portata massima
// <etichetta>" (set giardino/mobili). Le righe-accessorio (seduta/cuscini/schienale) hanno la
// stessa forma "Misure <etichetta>" ma NON hanno un badge corrispondente, quindi il gate le
// esclude da solo; la blacklist sopra è una difesa in profondità aggiuntiva. Conservativo: ritorna
// [] se trova meno di 2 blocchi corroborati, per non "sparare" su prodotti singoli.
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

  const badgePerEtichetta = new Map<string, BadgePezzo>()
  for (const line of notaTecnica) {
    const capacita = CAPACITA.exec(line)
    if (capacita) {
      const etichetta = capacita[1].trim().toLowerCase()
      badgePerEtichetta.set(etichetta, { chiave: 'capacita', etichetta: `${capacita[2]} L`, valore: capacita[2] })
      continue
    }
    const portata = PORTATA.exec(line)
    if (portata) {
      const etichetta = portata[1].trim().toLowerCase()
      badgePerEtichetta.set(etichetta, { chiave: 'portata', etichetta: `${portata[2]} Kg`, valore: portata[2] })
    }
  }

  const corroborati = blocchi.filter(
    (b) => badgePerEtichetta.has(b.etichetta) && !eAccessorio(b.etichetta),
  )
  if (corroborati.length < 2) return []

  return corroborati.map((b, i) => {
    const datiBadge = badgePerEtichetta.get(b.etichetta)!
    return {
      gruppo: `g${i}`,
      etichetta: b.etichetta,
      dimensioni: b.dimensioni,
      badges: [{ ...datiBadge, verificata: true, priorita: 0, badge: true }],
    }
  })
}
