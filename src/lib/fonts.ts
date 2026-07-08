import path from 'node:path'

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')

/** Percorsi dei file font per resvg-js (embedding nel raster). Server-only (usa node:path). */
export const FONT_FILES: string[] = [
  path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
]
