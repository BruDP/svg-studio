import { theme } from './theme'

/**
 * Palette "famiglia" Satur per reparto — campionata a livello di pixel dagli swatch "I colori
 * secondari" del Brand Book 2025 (non stimata a occhio). Ogni scheda prodotto prende il colore
 * del SUO reparto invece dell'accento unico: le schede restano identiche nella struttura (stesso
 * layout, stessa tipografia, stessi chip) ma ognuna ha la propria tinta "di famiglia", come i
 * reparti fisici del punto vendita — sorprendente da categoria a categoria, coerente dentro ogni
 * singola scheda.
 *
 * Le chiavi corrispondono ai nomi reparto del brand book quando esiste un'attribuzione diretta;
 * `accentoPerCategoria` mappa poi le nostre chiavi categoria (`dictionary/categories.yaml`) su
 * queste, con un fallback ragionato quando il reparto Satur non ha un equivalente ovvio.
 */
export const PALETTE_REPARTO = {
  kooper: '#A6213F', // Pantone 188 C — grandi elettrodomestici (marchio Kooper stampato sul prodotto)
  garden: '#6DBE4B', // Pantone 1205 C
  bagno: '#24A4AA', // Pantone 320 C (valore del capitolo "colori secondari", leggermente più chiaro del 320C usato come accento primario)
  riassetto: '#4DC1BD', // Pantone 3252 C
  accessori: '#A7779C', // Pantone 7654 C
  brico: '#A3A9AD', // Pantone 429 C
} as const

/**
 * Attribuzione categoria→colore-reparto. Ragionamento per le categorie senza un reparto Satur
 * a corrispondenza diretta:
 * - grandi/piccoli elettrodomestici → "kooper" (è letteralmente il marchio stampato su questi
 *   prodotti nel feed, es. il frigorifero SKU 5926226 ha marchio="Kooper").
 * - arredo_esterno/ombrellone/barbecue → "garden" (corrispondenza diretta col nome reparto).
 * - valigie → "accessori" (nessun reparto "viaggio" nel brand book; l'accessorio da viaggio è
 *   l'accostamento più onesto).
 * - arredo_interno/sedia_ufficio_gaming → "riassetto" (mobili/arredo interno, reparto più vicino
 *   nello spirito anche se non è una corrispondenza letterale).
 * - illuminazione → "brico" (le lampade convivono spesso con l'elettricistica/fai-da-te).
 * - bagno_doccia → "bagno" (corrispondenza diretta; categoria oggi senza chiavi nel dizionario,
 *   presente per completezza).
 * - categorie non elencate/"altro" → fallback sull'accento di default (teal, Pantone 320 C).
 */
const CATEGORIA_REPARTO: Record<string, keyof typeof PALETTE_REPARTO> = {
  frigorifero: 'kooper',
  congelatore: 'kooper',
  lavatrice: 'kooper',
  forno: 'kooper',
  condizionatore: 'kooper',
  condizionatore_portatile: 'kooper',
  ventilatore: 'kooper',
  deumidificatore: 'kooper',
  aspirapolvere: 'kooper',
  piccoli_elettrodomestici: 'kooper',
  arredo_esterno: 'garden',
  ombrellone: 'garden',
  barbecue: 'garden',
  valigie: 'accessori',
  arredo_interno: 'riassetto',
  sedia_ufficio_gaming: 'riassetto',
  illuminazione: 'brico',
  bagno_doccia: 'bagno',
}

/** Colore-accento della scheda per una data categoria. Fallback = accento di default (teal). */
export function accentoPerCategoria(categoria: string): string {
  const reparto = CATEGORIA_REPARTO[categoria]
  return reparto ? PALETTE_REPARTO[reparto] : theme.colors.accento
}
