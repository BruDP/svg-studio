import { db } from '@/lib/db'
import type { BBox } from './bbox'

/** Cache DB pura del risultato Vision, keyed su hash immagine (nessuna colonna di stato:
 *  un bbox è per-immagine e viene già rivisto dall'operatore nell'editor). */
export async function loadCachedBBox(
  imageHash: string,
): Promise<{ trovato: boolean; box: BBox | null } | undefined> {
  const row = await db.visionBBox.findUnique({ where: { imageHash } })
  if (!row) return undefined
  if (!row.trovato) return { trovato: false, box: null }
  return {
    trovato: true,
    box: { left: row.left!, top: row.top!, width: row.width!, height: row.height! },
  }
}

export async function saveCachedBBox(imageHash: string, box: BBox | null): Promise<void> {
  const data = box
    ? { trovato: true, left: box.left, top: box.top, width: box.width, height: box.height }
    : { trovato: false, left: null, top: null, width: null, height: null }
  await db.visionBBox.upsert({ where: { imageHash }, create: { imageHash, ...data }, update: data })
}
