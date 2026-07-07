import { describe, it, expect } from 'vitest'
import { resolveRenderBundle } from '@/lib/render/bundle'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

const scene: Scene = {
  version: SCENE_VERSION,
  sku: 'X1',
  templateId: 'colonna-sinistra',
  canvas: { width: 1000, height: 1000 },
  elements: [
    { type: 'icona-label', id: 'f0', chiave: 'k_ok', etichetta: 'A', x: 60, y: 160, verificata: true },
    { type: 'icona-label', id: 'f1', chiave: 'k_no', etichetta: 'B', x: 60, y: 256, verificata: false },
    { type: 'foto', id: 'ph', imageHash: 'abc', x: 480, y: 140, width: 400, height: 400 },
  ],
}

const deps = {
  getIcon: async (k: string) =>
    k === 'k_ok' ? { svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></svg>' } : null,
  readImage: (h: string) => (h === 'abc' ? { bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), ext: 'png' } : null),
}

describe('resolveRenderBundle', () => {
  it('mappa solo le icone approvate, estraendone l\'inner SVG', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(Object.keys(b.iconMap)).toEqual(['k_ok'])
    expect(b.iconMap.k_ok).toContain('M1 1')
    expect(b.iconMap.k_ok).not.toMatch(/<svg/i) // solo inner
  })

  it('costruisce il data URI della foto dai byte in cache', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(b.imageDataUri).toMatch(/^data:image\/png;base64,/)
  })

  it('imageDataUri null se la foto non è in cache', async () => {
    const b = await resolveRenderBundle(scene, { ...deps, readImage: () => null })
    expect(b.imageDataUri).toBeNull()
  })

  it('renderSceneServer produce l\'SVG canonico usando il bundle', async () => {
    const { renderSceneServer } = await import('@/lib/render/bundle')
    const svg = await renderSceneServer(parseScene(scene), deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('M1 1') // icona approvata inserita
    expect(svg).toContain('data:image/png;base64,') // foto incorporata
  })
})
