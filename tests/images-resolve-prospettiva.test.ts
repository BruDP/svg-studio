import { describe, it, expect, afterEach } from 'vitest'
import { resolveProspettiva } from '@/lib/images/resolve-prospettiva'
import type { Prospettiva } from '@/lib/images/vision-prospettiva'

const bytesFinti = Buffer.from('finto')

afterEach(() => {
  delete process.env.SVG_STUDIO_FAKE
})

describe('resolveProspettiva', () => {
  it('modalità fake (SVG_STUDIO_FAKE=1): ritorna null e non tocca cache/Vision', async () => {
    process.env.SVG_STUDIO_FAKE = '1'
    let chiamateVision = 0
    let chiamateCache = 0
    const p = await resolveProspettiva(bytesFinti, 'h0', {
      askProspettiva: async () => { chiamateVision++; return '' },
      loadProspettiva: async () => { chiamateCache++; return undefined },
    })
    expect(p).toBeNull()
    expect(chiamateVision).toBe(0)
    expect(chiamateCache).toBe(0)
  })

  it('nessuna cache: chiama Vision e usa il risultato', async () => {
    const store = new Map<string, { prospettiva: Prospettiva | null }>()
    const p = await resolveProspettiva(bytesFinti, 'h1', {
      askProspettiva: async () =>
        JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'destra', angoloProfonditaGradi: 18, verso: 'su' }),
      loadProspettiva: async (h) => store.get(h),
      saveProspettiva: async (h, prospettiva) => { store.set(h, { prospettiva }) },
    })
    expect(p).toEqual({ direzione: 'destra', angoloDeg: 18, verso: 'su' })
  })

  it('cache presente: seconda chiamata non richiama Vision', async () => {
    const store = new Map<string, { prospettiva: Prospettiva | null }>()
    let chiamate = 0
    const deps = {
      askProspettiva: async () => {
        chiamate++
        return JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'sinistra', angoloProfonditaGradi: 24, verso: 'giu' })
      },
      loadProspettiva: async (h: string) => store.get(h),
      saveProspettiva: async (h: string, prospettiva: Prospettiva | null) => { store.set(h, { prospettiva }) },
    }
    await resolveProspettiva(bytesFinti, 'h2', deps)
    await resolveProspettiva(bytesFinti, 'h2', deps)
    expect(chiamate).toBe(1)
  })

  it('Vision "frontale": null viene cachato, seconda chiamata non richiama Vision', async () => {
    const store = new Map<string, { prospettiva: Prospettiva | null }>()
    let chiamate = 0
    const deps = {
      askProspettiva: async () => {
        chiamate++
        return JSON.stringify({ prospettiva: 'frontale', direzioneProfondita: 'nessuna', angoloProfonditaGradi: 0, verso: 'nessuno' })
      },
      loadProspettiva: async (h: string) => store.get(h),
      saveProspettiva: async (h: string, prospettiva: Prospettiva | null) => { store.set(h, { prospettiva }) },
    }
    expect(await resolveProspettiva(bytesFinti, 'h3', deps)).toBeNull()
    expect(await resolveProspettiva(bytesFinti, 'h3', deps)).toBeNull()
    expect(chiamate).toBe(1)
  })

  it('errore Vision: degrada a null e NON cacha (riprovabile)', async () => {
    const store = new Map<string, { prospettiva: Prospettiva | null }>()
    const p = await resolveProspettiva(bytesFinti, 'h4', {
      askProspettiva: async () => { throw new Error('rete giù') },
      loadProspettiva: async (h) => store.get(h),
      saveProspettiva: async (h, prospettiva) => { store.set(h, { prospettiva }) },
    })
    expect(p).toBeNull()
    expect(store.has('h4')).toBe(false)
  })

  it('errore lettura cache: degrada a null e NON chiama Vision né cacha', async () => {
    let chiamateVision = 0
    let chiamateSave = 0
    const p = await resolveProspettiva(bytesFinti, 'h5', {
      loadProspettiva: async () => { throw new Error('SQLITE_BUSY: database is locked') },
      askProspettiva: async () => {
        chiamateVision++
        return JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'destra', angoloProfonditaGradi: 20, verso: 'su' })
      },
      saveProspettiva: async () => { chiamateSave++ },
    })
    expect(p).toBeNull()
    expect(chiamateVision).toBe(0)
    expect(chiamateSave).toBe(0)
  })

  it('errore scrittura cache: usa comunque la prospettiva ottenuta da Vision', async () => {
    const p = await resolveProspettiva(bytesFinti, 'h6', {
      askProspettiva: async () =>
        JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'destra', angoloProfonditaGradi: 15, verso: 'giu' }),
      loadProspettiva: async () => undefined,
      saveProspettiva: async () => { throw new Error('SQLITE_BUSY: database is locked') },
    })
    expect(p).toEqual({ direzione: 'destra', angoloDeg: 15, verso: 'giu' })
  })
})
