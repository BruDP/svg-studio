import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { resolveBBox } from '@/lib/images/resolve-bbox'
import type { BBox } from '@/lib/images/bbox'

/** Genera un PNG bianco 100×100 con un rettangolo nero da (20,30) a (70,80): sfondo uniforme. */
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

/** PNG bianco 100×100 con un puntino nero 2×2 (sfondo uniforme, bbox troppo piccolo per essere plausibile). */
async function makeSampleImplausibile(): Promise<Buffer> {
  const w = 100
  const h = 100
  const px = Buffer.alloc(w * h * 3, 255) // sfondo bianco
  for (let y = 49; y < 51; y++) {
    for (let x = 49; x < 51; x++) {
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

describe('resolveBBox', () => {
  it('sfondo uniforme: usa la scansione, NON chiama Vision', async () => {
    let chiamateVision = 0
    const box = await resolveBBox(await makeSample(), 'h1', {
      askVision: async () => { chiamateVision++; return '' },
    })
    expect(chiamateVision).toBe(0)
    expect(box).toEqual({ left: 20, top: 30, width: 50, height: 50 })
  })

  it('sfondo uniforme ma bbox implausibile (troppo piccolo): immagine intera, NON chiama Vision', async () => {
    let chiamateVision = 0
    const box = await resolveBBox(await makeSampleImplausibile(), 'h7', {
      askVision: async () => { chiamateVision++; return '' },
    })
    expect(chiamateVision).toBe(0)
    expect(box).toBeNull()
  })

  it('sfondo non uniforme: chiama Vision e usa il suo bbox plausibile', async () => {
    const store = new Map<string, { trovato: boolean; box: BBox | null }>()
    const box = await resolveBBox(await makeAngoliDiscordi(), 'h2', {
      askVision: async () => JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }),
      loadCachedBBox: async (h) => store.get(h),
      saveCachedBBox: async (h, b) => { store.set(h, { trovato: !!b, box: b }) },
    })
    expect(box).toEqual({ left: 20, top: 20, width: 50, height: 50 })
  })

  it('errore scrittura cache (saveCachedBBox lancia): usa comunque il bbox valido ottenuto da Vision', async () => {
    const box = await resolveBBox(await makeAngoliDiscordi(), 'h8', {
      askVision: async () => JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }),
      loadCachedBBox: async () => undefined,
      saveCachedBBox: async () => { throw new Error('SQLITE_BUSY: database is locked') },
    })
    expect(box).toEqual({ left: 20, top: 20, width: 50, height: 50 })
  })

  it('cache: seconda chiamata non richiama Vision', async () => {
    const store = new Map<string, { trovato: boolean; box: BBox | null }>()
    let chiamate = 0
    const deps = {
      askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }) },
      loadCachedBBox: async (h: string) => store.get(h),
      saveCachedBBox: async (h: string, b: BBox | null) => { store.set(h, { trovato: !!b, box: b }) },
    }
    await resolveBBox(await makeAngoliDiscordi(), 'h3', deps)
    await resolveBBox(await makeAngoliDiscordi(), 'h3', deps)
    expect(chiamate).toBe(1)
  })

  it('errore Vision: degrada a immagine intera (null) e NON cacha', async () => {
    const store = new Map<string, { trovato: boolean; box: BBox | null } | undefined>()
    const box = await resolveBBox(await makeAngoliDiscordi(), 'h4', {
      askVision: async () => { throw new Error('rete giù') },
      loadCachedBBox: async (h) => store.get(h),
      saveCachedBBox: async (h, b) => { store.set(h, { trovato: !!b, box: b }) },
    })
    expect(box).toBeNull()
    expect(store.has('h4')).toBe(false) // errore non cachato → riprovabile
  })

  it('errore lettura cache (loadCachedBBox lancia): degrada a immagine intera (null) e NON chiama Vision né cacha', async () => {
    let chiamateVision = 0
    let chiamateSave = 0
    const box = await resolveBBox(await makeAngoliDiscordi(), 'h6', {
      loadCachedBBox: async () => { throw new Error('SQLITE_BUSY: database is locked') },
      askVision: async () => { chiamateVision++; return JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }) },
      saveCachedBBox: async () => { chiamateSave++ },
    })
    expect(box).toBeNull()
    expect(chiamateVision).toBe(0) // errore cache non deve innescare una chiamata Vision
    expect(chiamateSave).toBe(0) // errore transitorio non va cachato
  })

  it('Vision trovato=false: null cachato, seconda chiamata non richiama Vision', async () => {
    const store = new Map<string, { trovato: boolean; box: BBox | null }>()
    let chiamate = 0
    const deps = {
      askVision: async () => { chiamate++; return JSON.stringify({ trovato: false, x: 0, y: 0, width: 0, height: 0 }) },
      loadCachedBBox: async (h: string) => store.get(h),
      saveCachedBBox: async (h: string, b: BBox | null) => { store.set(h, { trovato: !!b, box: b }) },
    }
    expect(await resolveBBox(await makeAngoliDiscordi(), 'h5', deps)).toBeNull()
    expect(await resolveBBox(await makeAngoliDiscordi(), 'h5', deps)).toBeNull()
    expect(chiamate).toBe(1)
  })

  it('forzaVision: chiama Vision anche su sfondo uniforme', async () => {
    let chiamate = 0
    const box = await resolveBBox(await makeSample(), 'hf1', {
      forzaVision: true,
      askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.1, y: 0.1, width: 0.5, height: 0.5 }) },
      loadCachedBBox: async () => undefined,
      saveCachedBBox: async () => {},
    })
    expect(chiamate).toBe(1)
    expect(box).toEqual({ left: 10, top: 10, width: 50, height: 50 })
  })

  it('forzaVision: bypassa la cache in lettura (ignora un vecchio "non trovato")', async () => {
    let chiamate = 0
    const salvati: Array<{ trovato: boolean; box: BBox | null }> = []
    const box = await resolveBBox(await makeAngoliDiscordi(), 'hf2', {
      forzaVision: true,
      loadCachedBBox: async () => ({ trovato: false, box: null }), // cache "non trovato" preesistente
      askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }) },
      saveCachedBBox: async (_h, b) => { salvati.push({ trovato: !!b, box: b }) },
    })
    expect(chiamate).toBe(1)                 // ha chiamato Vision nonostante la cache
    expect(box).toEqual({ left: 20, top: 20, width: 50, height: 50 })
    expect(salvati).toHaveLength(1)          // e ha scritto il nuovo risultato in cache
    expect(salvati[0].trovato).toBe(true)
  })

  it('forzaVision assente: comportamento invariato (sfondo uniforme → nessuna Vision)', async () => {
    let chiamate = 0
    await resolveBBox(await makeSample(), 'hf3', { askVision: async () => { chiamate++; return '' } })
    expect(chiamate).toBe(0)
  })
})
