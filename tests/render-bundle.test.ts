import { describe, it, expect } from 'vitest'
import { resolveRenderBundle, isValidImageHash } from '@/lib/render/bundle'
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

// Scena "set": due elementi foto con imageHash DIVERSI in due gruppi diversi (Task 6-7:
// l'operatore assegna una foto diversa a un singolo pezzo). Regressione per il bug Task 9:
// il bundle deve produrre una mappa hash→dataURI con ENTRAMBE le entry, non collassare
// sulla prima foto trovata.
const sceneMultiFoto: Scene = {
  version: SCENE_VERSION,
  sku: 'X2',
  templateId: 'multi-prodotto',
  canvas: { width: 1000, height: 1000 },
  elements: [
    { type: 'foto', id: 'ph0', imageHash: 'abc', x: 0, y: 0, width: 200, height: 200, gruppo: 'g0' },
    { type: 'foto', id: 'ph1', imageHash: 'def', x: 200, y: 0, width: 200, height: 200, gruppo: 'g1' },
  ],
}

const depsMultiFoto = {
  readImage: (h: string) => {
    if (h === 'abc') return { bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), ext: 'png' as const }
    if (h === 'def') return { bytes: Buffer.from([0xff, 0xd8, 0xff, 0xdb]), ext: 'jpg' as const }
    return null
  },
}

describe('resolveRenderBundle', () => {
  it('mappa solo le icone approvate, estraendone l\'inner SVG', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(Object.keys(b.iconMap)).toEqual(['k_ok'])
    expect(b.iconMap.k_ok).toContain('M1 1')
    expect(b.iconMap.k_ok).not.toMatch(/<svg/i) // solo inner
  })

  it('costruisce imageMap[hash] = data URI dai byte in cache', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(b.imageMap.abc).toMatch(/^data:image\/png;base64,/)
  })

  it('hash assente da imageMap se la foto non è in cache', async () => {
    const b = await resolveRenderBundle(scene, { ...deps, readImage: () => null })
    expect(b.imageMap.abc).toBeUndefined()
  })

  it('renderSceneServer produce l\'SVG canonico usando il bundle', async () => {
    const { renderSceneServer } = await import('@/lib/render/bundle')
    const svg = await renderSceneServer(parseScene(scene), deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('M1 1') // icona approvata inserita
    expect(svg).toContain('data:image/png;base64,') // foto incorporata
  })

  it('REGRESSIONE: due foto con hash diversi producono un imageMap con ENTRAMBE le entry', async () => {
    const b = await resolveRenderBundle(sceneMultiFoto, depsMultiFoto)
    expect(Object.keys(b.imageMap).sort()).toEqual(['abc', 'def'])
    expect(b.imageMap.abc).toMatch(/^data:image\/png;base64,/)
    expect(b.imageMap.def).toMatch(/^data:image\/jpeg;base64,/)
    expect(b.imageMap.abc).not.toEqual(b.imageMap.def)
  })

  it('REGRESSIONE: renderSceneServer incorpora CIASCUNA foto con il proprio data URI corretto (non la stessa per entrambe)', async () => {
    const { renderSceneServer } = await import('@/lib/render/bundle')
    const svg = await renderSceneServer(parseScene(sceneMultiFoto), depsMultiFoto)
    const b64Abc = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
    const b64Def = Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString('base64')
    expect(svg).toContain(`data:image/png;base64,${b64Abc}`)
    expect(svg).toContain(`data:image/jpeg;base64,${b64Def}`)
  })
})

describe('resolveIconsForKeys', () => {
  it('mappa solo le chiavi con icona approvata, inner SVG', async () => {
    const { resolveIconsForKeys } = await import('@/lib/render/bundle')
    const getIcon = async (k: string) =>
      k === 'ok' ? { svg: '<svg viewBox="0 0 24 24"><path d="M9 9"/></svg>' } : null
    const map = await resolveIconsForKeys(['ok', 'no', 'ok'], { getIcon })
    expect(Object.keys(map)).toEqual(['ok'])
    expect(map.ok).toContain('M9 9')
    expect(map.ok).not.toMatch(/<svg/i)
  })
})

describe('resolveEditorIcons', () => {
  const getIcon = async (k: string) => {
    if (k === 'appr') return { svg: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>', status: 'approvata' as const }
    if (k === 'rev') return { svg: '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>', status: 'in-revisione' as const }
    return null
  }

  it('include approvate e in-revisione nella iconMap, elenca solo le in-revisione', async () => {
    const { resolveEditorIcons } = await import('@/lib/render/bundle')
    const r = await resolveEditorIcons(['appr', 'rev', 'assente'], { getIcon })
    expect(Object.keys(r.iconMap).sort()).toEqual(['appr', 'rev'])
    expect(r.iconMap.appr).toContain('M1 1')
    expect(r.iconMap.rev).toContain('M2 2')
    expect(r.iconMap.appr).not.toMatch(/<svg/i) // inner
    expect(r.inRevisione).toEqual(['rev'])
  })

  it('chiave senza icona non entra né in map né in inRevisione', async () => {
    const { resolveEditorIcons } = await import('@/lib/render/bundle')
    const r = await resolveEditorIcons(['assente'], { getIcon })
    expect(r.iconMap).toEqual({})
    expect(r.inRevisione).toEqual([])
  })
})

describe('isValidImageHash', () => {
  it('accetta un hash sha256 esadecimale minuscolo di 64 caratteri', () => {
    const validHash = 'a'.repeat(64)
    expect(isValidImageHash(validHash)).toBe(true)
  })

  it('rifiuta hash non validi (corti, non-hex, path traversal)', () => {
    expect(isValidImageHash('not-a-hash')).toBe(false)
    expect(isValidImageHash('abc')).toBe(false)
    expect(isValidImageHash('A'.repeat(64))).toBe(false) // maiuscole non ammesse
    expect(isValidImageHash('../../etc/passwd')).toBe(false)
    expect(isValidImageHash('f'.repeat(63))).toBe(false) // lunghezza errata
  })
})
