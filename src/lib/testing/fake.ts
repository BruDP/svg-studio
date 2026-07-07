import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Dictionary } from '@/lib/dictionary/types'

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
