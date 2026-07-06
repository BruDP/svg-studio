import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { rmSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { cacheImage, readCachedImage } from '@/lib/images/cache'

const DIR = 'tests/tmp/images'
const fakePng = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex') // header PNG minimale

beforeEach(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
})
afterAll(() => {
  rmSync('tests/tmp', { recursive: true, force: true })
})

describe('cacheImage', () => {
  it('scarica e salva l\'immagine, restituendo hash e path', async () => {
    let calls = 0
    const download = async () => {
      calls++
      return fakePng
    }
    const res = await cacheImage('https://x/y.png', { download, dir: DIR })
    expect(res.hash).toHaveLength(64)
    expect(existsSync(res.path)).toBe(true)
    expect(calls).toBe(1)
  })

  it('dedup su hash di contenuto: due URL diversi con stessi byte producono un solo file', async () => {
    let calls = 0
    const download = async () => {
      calls++
      return fakePng
    }
    const a = await cacheImage('https://x/a.png', { download, dir: DIR })
    const b = await cacheImage('https://y/b.png', { download, dir: DIR })
    expect(calls).toBe(2)
    expect(a.hash).toBe(b.hash)
    expect(readdirSync(DIR).length).toBe(1)
  })

  it('readCachedImage rilegge gli stessi byte', async () => {
    const res = await cacheImage('https://x/y.png', { download: async () => fakePng, dir: DIR })
    expect(readCachedImage(res.hash, res.ext, DIR).equals(fakePng)).toBe(true)
  })
})
