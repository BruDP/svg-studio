import sharp from 'sharp'

export interface BBox {
  left: number
  top: number
  width: number
  height: number
}

/** Soglia di dispersione tra i 4 angoli oltre cui lo sfondo NON è a tinta unita
 *  (2× la `soglia` per-pixel di default): innesca il fallback Vision. */
export const SOGLIA_ANGOLI = 48

type RGB = [number, number, number]
const distL1 = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

export async function analizzaBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<{ box: BBox | null; scartoAngoli: number; width: number; height: number }> {
  const soglia = deps.soglia ?? 24
  const { data, info } = await sharp(imageBytes).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const at = (x: number, y: number): RGB => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }

  // colore di sfondo = media dei 4 angoli
  const angoli: RGB[] = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
  let scartoAngoli = 0
  for (let i = 0; i < angoli.length; i++)
    for (let j = i + 1; j < angoli.length; j++)
      scartoAngoli = Math.max(scartoAngoli, distL1(angoli[i], angoli[j]))

  const bg: RGB = [
    Math.round(angoli.reduce((s, c) => s + c[0], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[1], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[2], 0) / 4),
  ]

  const differisce = (x: number, y: number): boolean => {
    const [r, g, b] = at(x, y)
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > soglia
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (differisce(x, y)) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  const box = maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  return { box, scartoAngoli, width, height }
}

/** API pubblica invariata: comportamento identico a prima. */
export async function detectBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<BBox | null> {
  return (await analizzaBBox(imageBytes, deps)).box
}

/** Guardia di plausibilità: scarta box degeneri (sliver, quasi-interi, minuscoli).
 *  Un box quasi-intero equivale a "nessun ritaglio utile" → trattato come implausibile. */
export function bboxPlausibile(box: BBox, width: number, height: number): boolean {
  const ratio = (box.width * box.height) / (width * height)
  if (ratio < 0.03 || ratio > 0.985) return false
  if (box.width < width * 0.05 || box.height < height * 0.05) return false
  return true
}
