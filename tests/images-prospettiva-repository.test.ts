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
})
