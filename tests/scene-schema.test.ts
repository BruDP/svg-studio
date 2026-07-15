import { describe, it, expect } from 'vitest'
import { parseScene } from '@/lib/scene/schema'
import { SCENE_VERSION, type Scene } from '@/lib/scene/types'

const validScene: Scene = {
  version: SCENE_VERSION,
  sku: '2137070',
  templateId: 'colonna-sinistra',
  canvas: { width: 1000, height: 1000 },
  elements: [
    { type: 'icona-label', id: 'f1', chiave: 'materiale_acciaio', etichetta: 'Acciaio', x: 60, y: 120, verificata: true },
    { type: 'foto', id: 'ph', imageHash: 'abc123', x: 400, y: 100, width: 520, height: 520 },
    { type: 'quota', id: 'q1', orientamento: 'verticale', valore: '84,5 cm', x1: 940, y1: 100, x2: 940, y2: 620 },
    { type: 'badge', id: 'b1', testo: '120 KG', x: 420, y: 640 },
    { type: 'testo', id: 't1', testo: 'Barbecue a carbone', x: 60, y: 60, ruolo: 'titolo' },
  ],
}

describe('parseScene', () => {
  it('accetta una scena valida e restituisce lo stesso oggetto', () => {
    expect(parseScene(validScene)).toEqual(validScene)
  })

  it('rifiuta un elemento con type sconosciuto', () => {
    const bad = { ...validScene, elements: [{ type: 'sconosciuto', id: 'x' }] }
    expect(() => parseScene(bad)).toThrow()
  })

  it('rifiuta una quota senza estremi numerici', () => {
    const bad = {
      ...validScene,
      elements: [{ type: 'quota', id: 'q', orientamento: 'verticale', valore: '1 cm', x1: 0, y1: 0, x2: 0, y2: null }],
    }
    expect(() => parseScene(bad)).toThrow()
  })

  it('rifiuta un orientamento quota non ammesso', () => {
    const bad = {
      ...validScene,
      elements: [{ type: 'quota', id: 'q', orientamento: 'obliqua', valore: '1', x1: 0, y1: 0, x2: 1, y2: 1 }],
    }
    expect(() => parseScene(bad)).toThrow()
  })

  it('accetta e conserva il campo gruppo su foto/quota/badge (per i set multi-prodotto)', () => {
    const withGruppo: Scene = {
      ...validScene,
      elements: [
        { type: 'icona-label', id: 'f1', chiave: 'materiale_acciaio', etichetta: 'Acciaio', x: 60, y: 120, verificata: true },
        { type: 'foto', id: 'ph', imageHash: 'abc123', x: 400, y: 100, width: 520, height: 520, gruppo: 'g0' },
        { type: 'quota', id: 'q1', orientamento: 'verticale', valore: '84,5 cm', x1: 940, y1: 100, x2: 940, y2: 620, gruppo: 'g0' },
        { type: 'badge', id: 'b1', testo: '120 KG', x: 420, y: 640, gruppo: 'g0' },
        { type: 'testo', id: 't1', testo: 'Barbecue a carbone', x: 60, y: 60, ruolo: 'titolo' },
      ],
    }
    expect(parseScene(withGruppo)).toEqual(withGruppo)
  })

  it('accetta una scena esistente senza gruppo (retrocompatibilita)', () => {
    expect(parseScene(validScene)).toEqual(validScene)
  })

  it('rifiuta un gruppo di tipo errato (numero anziche stringa)', () => {
    const bad = {
      ...validScene,
      elements: [{ type: 'foto', id: 'ph', imageHash: 'abc123', x: 400, y: 100, width: 520, height: 520, gruppo: 42 }],
    }
    expect(() => parseScene(bad)).toThrow()
  })
})
