import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { loadCachedBBox, saveCachedBBox } from '@/lib/images/vision-repository'

beforeEach(async () => {
  await db.visionBBox.deleteMany()
})
afterAll(async () => {
  await db.visionBBox.deleteMany()
  await db.$disconnect()
})

describe('cache Vision bbox', () => {
  it('round-trip: salva e rilegge un bbox trovato', async () => {
    const h = 'a'.repeat(64)
    await saveCachedBBox(h, { left: 10, top: 20, width: 30, height: 40 })
    expect(await loadCachedBBox(h)).toEqual({
      trovato: true,
      box: { left: 10, top: 20, width: 30, height: 40 },
    })
  })

  it('round-trip: salva e rilegge un "non trovato"', async () => {
    const h = 'b'.repeat(64)
    await saveCachedBBox(h, null)
    expect(await loadCachedBBox(h)).toEqual({ trovato: false, box: null })
  })

  it('hash sconosciuto → undefined', async () => {
    expect(await loadCachedBBox('c'.repeat(64))).toBeUndefined()
  })

  it('saveCachedBBox su hash esistente aggiorna (upsert) invece di duplicare', async () => {
    const h = 'd'.repeat(64)
    await saveCachedBBox(h, { left: 1, top: 2, width: 3, height: 4 })
    await saveCachedBBox(h, { left: 5, top: 6, width: 7, height: 8 })
    expect(await loadCachedBBox(h)).toEqual({
      trovato: true,
      box: { left: 5, top: 6, width: 7, height: 8 },
    })
    expect(await db.visionBBox.count()).toBe(1)
  })
})
