import { db } from '@/lib/db'
import type { Prospettiva } from './vision-prospettiva'

/** Cache DB pura del risultato Vision prospettiva, keyed su hash immagine.
 *
 *  Rappresentazione del caso "frontale/nessuna prospettiva rilevata": una riga viene comunque
 *  scritta, con `direzione='nessuna'` (angoloDeg=0, verso='nessuno'), invece di non scrivere
 *  nulla. Così `loadProspettiva` può distinguere:
 *  - "mai chiesto" → nessuna riga → ritorna `undefined` (il chiamante deve interrogare Vision)
 *  - "chiesto, risultato: frontale" → riga con direzione='nessuna' → ritorna `{ prospettiva: null }`
 *    (nessuna chiamata Vision ripetuta per le foto frontali)
 *  - "chiesto, risultato: tre_quarti" → riga con direzione='destra'|'sinistra' → ritorna
 *    `{ prospettiva: {...} }`
 */
export async function loadProspettiva(
  hash: string,
): Promise<{ prospettiva: Prospettiva | null } | undefined> {
  const row = await db.visionProspettiva.findUnique({ where: { hash } })
  if (!row) return undefined
  if (row.direzione !== 'destra' && row.direzione !== 'sinistra') return { prospettiva: null }
  return {
    prospettiva: {
      direzione: row.direzione,
      angoloDeg: row.angoloDeg,
      verso: row.verso === 'su' ? 'su' : 'giu',
    },
  }
}

/**
 * Salva la prospettiva risolta per `hash`. `origine`:
 * - `'vision'` (default): scrittura automatica di `resolveProspettiva`. Se la riga esistente è
 *   `origine='manuale'` (correzione dell'operatore), NON viene sovrascritta: la correzione manuale
 *   vince sempre su Vision.
 * - `'manuale'`: correzione dell'operatore in editor (vedi `saveSceneAction`). Sovrascrive sempre,
 *   qualunque fosse la riga precedente.
 */
export async function saveProspettiva(
  hash: string,
  prospettiva: Prospettiva | null,
  origine: 'vision' | 'manuale' = 'vision',
): Promise<void> {
  if (origine === 'vision') {
    const esistente = await db.visionProspettiva.findUnique({ where: { hash } })
    if (esistente?.origine === 'manuale') return // il manuale vince sempre su Vision
  }
  const data = prospettiva
    ? { direzione: prospettiva.direzione, angoloDeg: prospettiva.angoloDeg, verso: prospettiva.verso, origine }
    : { direzione: 'nessuna', angoloDeg: 0, verso: 'nessuno', origine }
  await db.visionProspettiva.upsert({ where: { hash }, create: { hash, ...data }, update: data })
}
