import { describe, it, expect } from 'vitest'
import { rankFeatures } from '@/lib/extraction/ranking'
import { loadDictionary } from '@/lib/dictionary/loader'
import type { ValidatedFeature } from '@/lib/extraction/validator'

const dict = loadDictionary()

describe('rankFeatures padding min 6', () => {
  it('categoria ricca con poche feature reali → riempie fino a 6, il resto verificata=false', () => {
    const validated = [
      { chiave: 'specchio_figura_intera', valore: null, verificata: true, testoSorgente: 'specchio' },
      { chiave: 'cornice_legno', valore: null, verificata: true, testoSorgente: 'cornice' },
    ] as ValidatedFeature[]
    const { features } = rankFeatures(validated, 'arredo_interno', dict)
    expect(features.length).toBe(6)
    expect(features.filter((f) => f.verificata).length).toBe(2)
    expect(features.filter((f) => !f.verificata).length).toBe(4)
    // il padding non contiene badge né feature con valore obbligatorio (label senza {valore})
    for (const f of features.filter((x) => !x.verificata)) {
      expect(f.badge).toBe(false)
      expect(dict.features[f.chiave].label.includes('{valore}')).toBe(false)
    }
    // le reali restano in testa
    expect(features.slice(0, 2).map((f) => f.chiave)).toEqual(['specchio_figura_intera', 'cornice_legno'])
    // nessun duplicato
    expect(new Set(features.map((f) => f.chiave)).size).toBe(features.length)
  })

  it('categoria povera (barbecue: 3 feature totali) → non supera il catalogo di categoria', () => {
    const validated = [
      { chiave: 'alimentazione_carbonella', valore: null, verificata: true, testoSorgente: 'carbonella' },
    ] as ValidatedFeature[]
    const { features } = rankFeatures(validated, 'barbecue', dict)
    expect(features.length).toBeGreaterThanOrEqual(1)
    expect(features.length).toBeLessThanOrEqual(3) // barbecue ha solo 3 feature: niente invenzioni oltre
    expect(features.filter((f) => f.verificata).length).toBe(1) // la reale
  })

  it('già 6+ feature reali → nessun padding aggiunto', () => {
    const chiavi = ['struttura_ferro', 'cornice_legno', 'specchio_figura_intera', 'ripiani_regolabili', 'design_moderno', 'piedini_antiscivolo']
    const validated = chiavi.map((c) => ({ chiave: c, valore: null, verificata: true, testoSorgente: 't' })) as ValidatedFeature[]
    const { features } = rankFeatures(validated, 'arredo_interno', dict)
    expect(features.every((f) => f.verificata)).toBe(true) // nessuna feature verificata=false (nessun padding)
  })
})
