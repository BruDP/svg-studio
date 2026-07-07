import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { FONT_FILES, theme } from '@/lib/theme'

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

export async function exportScene(input: {
  svg: string
  sku: string
  size?: number
  dir?: string
}): Promise<string> {
  const dir = input.dir ?? 'output'
  const size = input.size ?? 1000
  const png = renderSvgToPng(input.svg, size)
  const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer()
  mkdirSync(dir, { recursive: true })
  const outPath = path.join(dir, `${input.sku}.jpg`)
  writeFileSync(outPath, jpeg)
  return outPath
}
