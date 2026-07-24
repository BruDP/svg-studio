import { normalizzaBrand } from './marchio'
import { rilevaLinea } from './linea'

/**
 * Selezione dei prodotti "ad alto valore" su cui vale la pena generare la scheda (scelta utente:
 * Kooper, Kooper X, garden, fitness). Il feed non ha un campo categoria/linea, quindi il gruppo si
 * ricava SENZA Gemini da marchio + linea (ultimo segmento della descrizione). Serve a costruire la
 * lista dei target per la generazione in batch, evitando di estrarre tutti i ~7000 prodotti.
 */
export type GruppoAltoValore = 'kooper' | 'garden' | 'fitness'

export function gruppoAltoValore(descrizioneBreve: string, marchio: string): GruppoAltoValore | null {
  const m = normalizzaBrand(marchio)
  // Kooper (marchio) copre la linea Kooper, Kooper X, Kooper Klima, ecc. — tutti elettrodomestici.
  if (m === 'kooper') return 'kooper'
  const linea = rilevaLinea(descrizioneBreve)
  if (linea === 'FitLover') return 'fitness'
  if (linea === 'Esté' || linea === 'BestBQ') return 'garden'
  return null
}

/** True se il prodotto è nello scope ad alto valore (uno dei gruppi sopra). */
export function inScopeAltoValore(descrizioneBreve: string, marchio: string): boolean {
  return gruppoAltoValore(descrizioneBreve, marchio) !== null
}
