import sharp from 'sharp'

export interface BBox {
  left: number
  top: number
  width: number
  height: number
}

export async function detectBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<BBox | null> {
  const soglia = deps.soglia ?? 24
  const { data, info } = await sharp(imageBytes).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }

  // colore di sfondo = media dei 4 angoli
  const angoli = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
  const bg: [number, number, number] = [
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

  if (maxX < 0) return null
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
