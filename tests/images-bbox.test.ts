import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { detectBBox } from '@/lib/images/bbox'

/** Genera un PNG bianco 100×100 con un rettangolo nero da (20,30) a (70,80). */
async function makeSample(): Promise<Buffer> {
  const w = 100
  const h = 100
  const px = Buffer.alloc(w * h * 3, 255) // sfondo bianco
  for (let y = 30; y < 80; y++) {
    for (let x = 20; x < 70; x++) {
      const i = (y * w + x) * 3
      px[i] = 0
      px[i + 1] = 0
      px[i + 2] = 0
    }
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

describe('detectBBox', () => {
  it('trova il rettangolo del prodotto su sfondo uniforme', async () => {
    const bbox = await detectBBox(await makeSample())
    expect(bbox).not.toBeNull()
    expect(bbox!.left).toBe(20)
    expect(bbox!.top).toBe(30)
    expect(bbox!.width).toBe(50)
    expect(bbox!.height).toBe(50)
  })

  it('restituisce null su immagine uniforme (nessun prodotto)', async () => {
    const white = await sharp(Buffer.alloc(100 * 100 * 3, 255), { raw: { width: 100, height: 100, channels: 3 } })
      .png()
      .toBuffer()
    expect(await detectBBox(white)).toBeNull()
  })
})
