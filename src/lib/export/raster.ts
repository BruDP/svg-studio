import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { theme } from '@/lib/theme'
import { FONT_FILES } from '@/lib/fonts'

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

/**
 * Esporta la scheda in DUE file nella cartella `dir`:
 * - `<sku>.png` — raster ad alta risoluzione (default 2000px): nitido su righe/testo/icone
 *   (niente artefatti JPEG attorno alle linee sottili), pronto per presentazione/marketplace.
 * - `<sku>.svg` — sorgente vettoriale scalabile a qualsiasi dimensione, self-contained (foto
 *   prodotto e icone incorporate come data URI): apribile e ristampabile senza perdita.
 * Ritorna il percorso del PNG (formato primario).
 */
export async function exportScene(input: {
  svg: string
  sku: string
  size?: number
  dir?: string
}): Promise<string> {
  const dir = input.dir ?? 'output'
  const size = input.size ?? 2000
  const png = renderSvgToPng(input.svg, size)
  mkdirSync(dir, { recursive: true })
  const pngPath = path.join(dir, `${input.sku}.png`)
  writeFileSync(pngPath, png)
  writeFileSync(path.join(dir, `${input.sku}.svg`), input.svg)
  return pngPath
}
