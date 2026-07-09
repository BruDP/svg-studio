import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Dictionary } from '@/lib/dictionary/types'
import type { IconifyCandidate } from '@/lib/icons/iconify'

/** Attivo quando SVG_STUDIO_FAKE=1: rende la pipeline deterministica e offline (E2E). */
export function isFake(): boolean {
  return process.env.SVG_STUDIO_FAKE === '1'
}

/** Generatore Gemini finto: restituisce l'estrazione canned di fixture (ignora il prompt). */
export function fakeGenerate(): (prompt: string, dict: Dictionary) => Promise<string> {
  return async () => readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/estrazione-2137070.json'), 'utf8')
}

/** Download immagine finto: restituisce il PNG di fixture per qualunque URL. */
export function fakeDownload(): (url: string) => Promise<Buffer> {
  return async () => readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/foto-test.png'))
}

/** Ricerca Iconify finta: restituisce 1 candidata canned (ignora la query). */
export function fakeSearchIconify(): (q: string) => Promise<IconifyCandidate[]> {
  return async () => [{ id: 'tabler:star', set: 'tabler', name: 'star' }]
}

/** Download SVG Iconify finto: restituisce un'icona line-art canned per qualunque id. */
export function fakeFetchIconifySvg(): (id: string) => Promise<string> {
  return async () =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>'
}
