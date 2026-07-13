import { analizzaBBox, bboxPlausibile, SOGLIA_ANGOLI, type BBox } from './bbox'
import { askVisionDefault, parseVisionBBox } from './vision-bbox'
import { loadCachedBBox, saveCachedBBox } from './vision-repository'

export interface ResolveBBoxDeps {
  askVision?: (imageBytes: Buffer, mime: string) => Promise<string>
  loadCachedBBox?: (imageHash: string) => Promise<{ trovato: boolean; box: BBox | null } | undefined>
  saveCachedBBox?: (imageHash: string, box: BBox | null) => Promise<void>
  sogliaAngoli?: number
  mime?: string
}

/** Orchestratore bbox: scansione pixel → (se sfondo non uniforme) Vision con cache → immagine intera.
 *  Vedi spec §4 (Fallback Gemini Vision per bbox). */
export async function resolveBBox(
  imageBytes: Buffer,
  imageHash: string,
  deps: ResolveBBoxDeps = {},
): Promise<BBox | null> {
  const sogliaAngoli = deps.sogliaAngoli ?? SOGLIA_ANGOLI
  const { box, scartoAngoli, width, height } = await analizzaBBox(imageBytes)

  // Ramo sfondo UNIFORME: comportamento identico a oggi, nessuna Vision, nessun DB.
  if (scartoAngoli <= sogliaAngoli) {
    return box && bboxPlausibile(box, width, height) ? box : null
  }

  // Ramo sfondo NON UNIFORME: fallback Vision, con cache per hash immagine.
  const load = deps.loadCachedBBox ?? loadCachedBBox
  const save = deps.saveCachedBBox ?? saveCachedBBox
  const ask = deps.askVision ?? askVisionDefault

  try {
    const cached = await load(imageHash)
    if (cached) return cached.box // include "non trovato" → null, senza richiamare Vision

    const json = await ask(imageBytes, deps.mime ?? 'image/png')
    const visionBox = parseVisionBBox(json, width, height)
    await save(imageHash, visionBox) // cacha anche il "non trovato" (visionBox null) → non ripete Vision
    return visionBox
  } catch {
    // errore cache DB (lock/connessione) o errore Vision (rete/quota/chiave):
    // degrada a immagine intera, NON cacha (riprovabile)
    return null
  }
}
