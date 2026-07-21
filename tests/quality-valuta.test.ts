import { describe, it, expect } from 'vitest'
import { valutaQualita } from '@/lib/quality/valuta'
import type { Scene } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

function scena(icone: { verificata: boolean }[]): Scene {
  return {
    version: SCENE_VERSION, sku: 'X', templateId: 'colonna-sinistra',
    canvas: { width: 1000, height: 1000 },
    elements: icone.map((ic, i) => ({
      type: 'icona-label' as const, id: `f${i}`, chiave: `k${i}`, etichetta: 'E', x: 0, y: 0, verificata: ic.verificata,
    })),
  }
}

describe('valutaQualita', () => {
  it('meno di 6 icone → problema "solo N icone"', () => {
    const q = valutaQualita(scena([{ verificata: true }, { verificata: true }, { verificata: true }]))
    expect(q.icone).toBe(3)
    expect(q.problemi.some((p) => p.includes('3') && /icone/.test(p))).toBe(true)
    expect(q.daRivedere).toBe(true)
  })
  it('feature da verificare → problema "N da verificare"', () => {
    const q = valutaQualita(scena([...Array(6)].map((_, i) => ({ verificata: i < 4 }))))
    expect(q.icone).toBe(6)
    expect(q.daVerificare).toBe(2)
    expect(q.problemi.some((p) => /da verificare/.test(p))).toBe(true)
    expect(q.daRivedere).toBe(true)
  })
  it('6 icone tutte verificate → nessun problema', () => {
    const q = valutaQualita(scena([...Array(6)].map(() => ({ verificata: true }))))
    expect(q.problemi).toEqual([])
    expect(q.daRivedere).toBe(false)
  })
})
