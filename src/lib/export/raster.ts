import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { theme } from '@/lib/theme'
import { FONT_FILES } from '@/lib/fonts'

// Qualità JPEG: 90 è indistinguibile a occhio da PNG su questo tipo di contenuto (testo/icone a
// tinta piatta + foto prodotto), a una frazione del peso (~280KB contro ~1,5MB a 2000px) — verificato
// visivamente prima di scegliere il valore. Adatta al caricamento su un catalogo ecommerce (il
// master Magento del feed di origine è JPEG 1000×1000; 2000px dà margine senza pesare troppo).
const JPEG_QUALITY = 90

export function renderSvgToPng(svg: string, size = 1000): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: theme.fontFamily,
    },
    // background opaco: resvg-js non può emettere trasparenza in questo percorso di rendering.
    background: theme.colors.sfondo,
  })
  return resvg.render().asPng()
}

export async function renderSvgToJpeg(svg: string, size = 1000, quality = JPEG_QUALITY): Promise<Buffer> {
  return sharp(renderSvgToPng(svg, size)).jpeg({ quality }).toBuffer()
}

/**
 * Esporta la scheda in DUE file nella cartella `dir`:
 * - `<sku>.jpg` — raster ad alta risoluzione (default 2000px), pronto per il caricamento su un
 *   catalogo ecommerce (stesso formato del master Magento di origine, peso contenuto).
 * - `<sku>.svg` — sorgente vettoriale scalabile a qualsiasi dimensione, self-contained (foto
 *   prodotto e icone incorporate come data URI): apribile e ristampabile senza perdita.
 * Ritorna anche il Buffer del JPEG (oltre al percorso su disco) così il chiamante può costruire
 * subito un data URI per il download in editor senza ri-leggere il file da disco.
 */
export async function exportScene(input: {
  svg: string
  sku: string
  size?: number
  dir?: string
}): Promise<{ path: string; jpeg: Buffer }> {
  const dir = input.dir ?? 'output'
  const size = input.size ?? 2000
  const jpeg = await renderSvgToJpeg(input.svg, size)
  mkdirSync(dir, { recursive: true })
  const jpegPath = path.join(dir, `${input.sku}.jpg`)
  writeFileSync(jpegPath, jpeg)
  writeFileSync(path.join(dir, `${input.sku}.svg`), input.svg)
  return { path: jpegPath, jpeg }
}
