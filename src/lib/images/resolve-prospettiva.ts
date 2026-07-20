import { isFake } from '@/lib/testing/fake'
import { askProspettivaDefault, parseProspettiva, type Prospettiva } from './vision-prospettiva'
import { loadProspettiva, saveProspettiva } from './prospettiva-repository'

export interface ResolveProspettivaDeps {
  askProspettiva?: (imageBytes: Buffer, mime: string) => Promise<string>
  loadProspettiva?: (hash: string) => Promise<{ prospettiva: Prospettiva | null } | undefined>
  saveProspettiva?: (hash: string, prospettiva: Prospettiva | null) => Promise<void>
  mime?: string
}

/** Orchestratore prospettiva: cache per hash immagine → (se assente) Vision → parse → cache.
 *  Mirror di resolveBBox (vedi resolve-bbox.ts), ma senza il gate "sfondo uniforme": qui si va
 *  sempre in cache/Vision quando non si è in modalità fake. Mai lancia: su errore di rete o di
 *  lettura/scrittura cache degrada al default (null → nessuna prospettiva, il layout userà il
 *  default), senza cache-are gli errori (riprovabili). */
export async function resolveProspettiva(
  imageBytes: Buffer,
  hash: string,
  deps: ResolveProspettivaDeps = {},
): Promise<Prospettiva | null> {
  // Modalità fake/offline (SVG_STUDIO_FAKE=1): default deterministico, nessun accesso a DB/rete.
  if (isFake()) return null

  const load = deps.loadProspettiva ?? loadProspettiva
  const save = deps.saveProspettiva ?? saveProspettiva
  const ask = deps.askProspettiva ?? askProspettivaDefault

  let cached: { prospettiva: Prospettiva | null } | undefined
  try {
    cached = await load(hash)
  } catch (e) {
    // errore cache DB (lock/connessione): degrada al default, NON cacha (riprovabile)
    console.warn('[resolveProspettiva] lettura cache VisionProspettiva fallita, uso il default:', e)
    return null
  }
  if (cached) return cached.prospettiva // include "frontale" (null) → non richiama Vision

  let prospettiva: Prospettiva | null
  try {
    const json = await ask(imageBytes, deps.mime ?? 'image/png')
    prospettiva = parseProspettiva(json)
  } catch (e) {
    // errore Vision (rete/quota/chiave): degrada al default, NON cacha (riprovabile)
    console.warn('[resolveProspettiva] chiamata Vision fallita, uso il default:', e)
    return null
  }

  try {
    await save(hash, prospettiva) // cacha anche "frontale" (prospettiva null) → non ripete Vision
  } catch (e) {
    // errore di scrittura cache: la prospettiva ottenuta da Vision resta valida e va comunque
    // usata; si tenterà di nuovo di cacharla alla prossima chiamata.
    console.warn('[resolveProspettiva] scrittura cache VisionProspettiva fallita, uso comunque il risultato:', e)
  }
  return prospettiva
}
