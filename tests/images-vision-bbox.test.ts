import { describe, it, expect } from 'vitest'
import { buildVisionPrompt, buildVisionSchema, parseVisionBBox } from '@/lib/images/vision-bbox'

describe('buildVisionPrompt / buildVisionSchema', () => {
  it('il prompt istruisce a ignorare sfondo e a impostare trovato=false se non c è un prodotto unico', () => {
    const prompt = buildVisionPrompt()
    expect(prompt).toContain('Ignora sfondo')
    expect(prompt).toContain('trovato=false')
  })

  it('lo schema vincola i campi richiesti', () => {
    const s = buildVisionSchema() as any
    expect(s.required).toEqual(['trovato', 'x', 'y', 'width', 'height'])
  })
})

describe('parseVisionBBox', () => {
  it('parsa un box plausibile in frazioni → px', () => {
    const json = JSON.stringify({ trovato: true, x: 0.25, y: 0.1, width: 0.5, height: 0.6 })
    expect(parseVisionBBox(json, 1000, 1000)).toEqual({ left: 250, top: 100, width: 500, height: 600 })
  })

  it('trovato=false → null', () => {
    expect(parseVisionBBox(JSON.stringify({ trovato: false, x: 0, y: 0, width: 0, height: 0 }), 1000, 1000)).toBeNull()
  })

  it('JSON vuoto o invalido → null (non lancia)', () => {
    expect(parseVisionBBox('', 100, 100)).toBeNull()
    expect(parseVisionBBox('non-json', 100, 100)).toBeNull()
  })

  it('JSON sintatticamente valido ma non-oggetto → null (non lancia)', () => {
    // JSON.parse('null') restituisce il valore null, non un errore: senza guard su typeof
    // l'accesso a r.trovato lancerebbe un TypeError.
    expect(() => parseVisionBBox('null', 100, 100)).not.toThrow()
    expect(parseVisionBBox('null', 100, 100)).toBeNull()
    expect(parseVisionBBox('42', 100, 100)).toBeNull()
    expect(parseVisionBBox('[]', 100, 100)).toBeNull()
    expect(parseVisionBBox('"stringa"', 100, 100)).toBeNull()
    expect(parseVisionBBox('true', 100, 100)).toBeNull()
  })

  it('box implausibile (sliver / quasi-intero) → null', () => {
    expect(parseVisionBBox(JSON.stringify({ trovato: true, x: 0, y: 0, width: 1, height: 1 }), 1000, 1000)).toBeNull()
    expect(
      parseVisionBBox(JSON.stringify({ trovato: true, x: 0.4, y: 0, width: 0.02, height: 1 }), 1000, 1000),
    ).toBeNull()
  })

  it('box che eccede i bordi viene clampato e resta plausibile', () => {
    const json = JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 1.0, height: 1.0 })
    const box = parseVisionBBox(json, 1000, 1000)
    expect(box).not.toBeNull()
    expect(box!.left + box!.width).toBeLessThanOrEqual(1000)
    expect(box!.top + box!.height).toBeLessThanOrEqual(1000)
  })
})
