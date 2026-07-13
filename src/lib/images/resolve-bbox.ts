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

  let cached: { trovato: boolean; box: BBox | null } | undefined
  try {
    cached = await load(imageHash)
  } catch (e) {
    // errore cache DB (lock/connessione): degrada a immagine intera, NON cacha (riprovabile)
    console.warn('[resolveBBox] lettura cache VisionBBox fallita, degrado a immagine intera:', e)
    return null
  }
  if (cached) return cached.box // include "non trovato" → null, senza richiamare Vision

  let visionBox: BBox | null
  try {
    const json = await ask(imageBytes, deps.mime ?? 'image/png')
    visionBox = parseVisionBBox(json, width, height)
  } catch (e) {
    // errore Vision (rete/quota/chiave): degrada a immagine intera, NON cacha (riprovabile)
    console.warn('[resolveBBox] chiamata Vision fallita, degrado a immagine intera:', e)
    return null
  }

  try {
    await save(imageHash, visionBox) // cacha anche il "non trovato" (visionBox null) → non ripete Vision
  } catch (e) {
    // errore di scrittura cache: il bbox ottenuto da Vision resta valido e va comunque usato,
    // si tenterà di nuovo di cacharlo alla prossima chiamata.
    console.warn('[resolveBBox] scrittura cache VisionBBox fallita, uso comunque il bbox ottenuto:', e)
  }
  return visionBox
}
