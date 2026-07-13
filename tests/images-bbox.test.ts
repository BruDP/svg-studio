import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { detectBBox, analizzaBBox, bboxPlausibile, SOGLIA_ANGOLI } from '@/lib/images/bbox'

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

/** PNG con 4 angoli di colori molto diversi (sfondo non uniforme). */
async function makeAngoliDiscordi(): Promise<Buffer> {
  const w = 100, h = 100
  const px = Buffer.alloc(w * h * 3, 128)
  const setPx = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * w + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b
  }
  setPx(0, 0, 255, 0, 0); setPx(w - 1, 0, 0, 255, 0)
  setPx(0, h - 1, 0, 0, 255); setPx(w - 1, h - 1, 0, 0, 0)
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

describe('analizzaBBox / bboxPlausibile', () => {
  it('scartoAngoli è ~0 su sfondo uniforme e alto su angoli discordi', async () => {
    const { scartoAngoli: uniforme } = await analizzaBBox(await makeSample())
    expect(uniforme).toBeLessThanOrEqual(SOGLIA_ANGOLI)
    const { scartoAngoli: discorde } = await analizzaBBox(await makeAngoliDiscordi())
    expect(discorde).toBeGreaterThan(SOGLIA_ANGOLI)
  })

  it('bboxPlausibile scarta box degeneri (troppo piccoli o quasi-interi)', () => {
    expect(bboxPlausibile({ left: 20, top: 30, width: 50, height: 50 }, 100, 100)).toBe(true)
    expect(bboxPlausibile({ left: 0, top: 0, width: 2, height: 2 }, 100, 100)).toBe(false)       // troppo piccolo
    expect(bboxPlausibile({ left: 0, top: 0, width: 100, height: 100 }, 100, 100)).toBe(false)   // quasi-intero
    expect(bboxPlausibile({ left: 44, top: 0, width: 4, height: 100 }, 100, 100)).toBe(false)    // sliver (larghezza 4 < 5% di 100)
  })
})
