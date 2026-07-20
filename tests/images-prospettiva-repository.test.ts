import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { loadProspettiva, saveProspettiva } from '@/lib/images/prospettiva-repository'

beforeEach(async () => {
  await db.visionProspettiva.deleteMany()
})
afterAll(async () => {
  await db.visionProspettiva.deleteMany()
  await db.$disconnect()
})

describe('cache Vision prospettiva', () => {
  it('round-trip: salva e rilegge una prospettiva rilevata', async () => {
    const h = 'a'.repeat(64)
    await saveProspettiva(h, { direzione: 'destra', angoloDeg: 18, verso: 'su' })
    expect(await loadProspettiva(h)).toEqual({
      prospettiva: { direzione: 'destra', angoloDeg: 18, verso: 'su' },
    })
  })

  it('round-trip: salva e rilegge un "frontale" (null) distinto da "mai chiesto"', async () => {
    const h = 'b'.repeat(64)
    await saveProspettiva(h, null)
    expect(await loadProspettiva(h)).toEqual({ prospettiva: null })
  })

  it('hash sconosciuto (mai chiesto) → undefined', async () => {
    expect(await loadProspettiva('c'.repeat(64))).toBeUndefined()
  })

  it('saveProspettiva su hash esistente aggiorna (upsert) invece di duplicare', async () => {
    const h = 'd'.repeat(64)
    await saveProspettiva(h, { direzione: 'sinistra', angoloDeg: 10, verso: 'giu' })
    await saveProspettiva(h, { direzione: 'destra', angoloDeg: 30, verso: 'su' })
    expect(await loadProspettiva(h)).toEqual({
      prospettiva: { direzione: 'destra', angoloDeg: 30, verso: 'su' },
    })
    expect(await db.visionProspettiva.count()).toBe(1)
  })

  it('override manuale: un salvataggio "vision" successivo NON sovrascrive una riga "manuale"', async () => {
    const h = 'e'.repeat(64)
    await saveProspettiva(h, { direzione: 'destra', angoloDeg: 12, verso: 'su' }, 'manuale')
    await saveProspettiva(h, { direzione: 'sinistra', angoloDeg: 40, verso: 'giu' }, 'vision')
    expect(await loadProspettiva(h)).toEqual({
      prospettiva: { direzione: 'destra', angoloDeg: 12, verso: 'su' },
    })
  })

  it('un salvataggio "manuale" sovrascrive sempre (anche un\'altra riga manuale precedente)', async () => {
    const h = 'f'.repeat(64)
    await saveProspettiva(h, { direzione: 'destra', angoloDeg: 12, verso: 'su' }, 'manuale')
    await saveProspettiva(h, { direzione: 'sinistra', angoloDeg: 40, verso: 'giu' }, 'manuale')
    expect(await loadProspettiva(h)).toEqual({
      prospettiva: { direzione: 'sinistra', angoloDeg: 40, verso: 'giu' },
    })
  })

  it('"vision" scrive normalmente quando non c\'è ancora una riga (o è "vision")', async () => {
    const h = 'a1'.repeat(32)
    await saveProspettiva(h, { direzione: 'destra', angoloDeg: 5, verso: 'giu' }, 'vision')
    await saveProspettiva(h, { direzione: 'sinistra', angoloDeg: 8, verso: 'su' }, 'vision')
    expect(await loadProspettiva(h)).toEqual({
      prospettiva: { direzione: 'sinistra', angoloDeg: 8, verso: 'su' },
    })
  })
})
