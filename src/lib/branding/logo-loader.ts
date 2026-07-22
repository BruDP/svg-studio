import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { marchioInfo } from './marchio'

const LOGHI_DIR = path.resolve(process.cwd(), 'assets/loghi')

// Formati raster supportati (in ordine di preferenza). PNG trasparente è l'ideale per un logo su
// fondo crema; resvg-js rasterizza <image> solo da formati raster, quindi NON supportiamo SVG qui
// (un logo SVG andrebbe inlineato a parte — vedi README in assets/loghi).
const ESTENSIONI: Array<{ ext: string; mime: string }> = [
  { ext: 'png', mime: 'image/png' },
  { ext: 'webp', mime: 'image/webp' },
  { ext: 'jpg', mime: 'image/jpeg' },
]

/**
 * Restituisce il data URI del file logo per un marchio, se presente in `assets/loghi/<slug>.<ext>`.
 * `null` se non esiste alcun file: in quel caso il renderer disegna il wordmark di ripiego.
 * `dir` override per i test.
 */
export function caricaLogoMarchio(marchio: string, dir: string = LOGHI_DIR): string | null {
  const { slug } = marchioInfo(marchio)
  for (const { ext, mime } of ESTENSIONI) {
    const file = path.join(dir, `${slug}.${ext}`)
    if (existsSync(file)) {
      const bytes = readFileSync(file)
      return `data:${mime};base64,${bytes.toString('base64')}`
    }
  }
  return null
}
