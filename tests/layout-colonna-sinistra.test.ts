import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { composeColonnaSinistra, TEMPLATE_ID, CANVAS } from '@/lib/layout/colonna-sinistra'
import { parseScene } from '@/lib/scene/schema'
import type { SchedaProposal } from '@/lib/extraction/engine'

const proposal: SchedaProposal = {
  sku: '2137070',
  categoria: 'barbecue',
  features: [
    { chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false },
    { chiave: 'montaggio_facile', etichetta: 'Montaggio facile', valore: null, verificata: false, priorita: 30, badge: false },
  ],
  badges: [
    { chiave: 'capacita', etichetta: '99 L', valore: '99', verificata: true, priorita: 90, badge: true },
  ],
  dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 },
}

describe('composeColonnaSinistra', () => {
  it('produce una scena valida con canvas 1000×1000 e templateId corretto', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe(TEMPLATE_ID)
    expect(scene.canvas).toEqual(CANVAS)
    expect(scene.sku).toBe('2137070')
  })

  it('crea un icona-label per feature, un badge per badge, una foto, quote dalle dimensioni', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const per = (t: string) => scene.elements.filter((e) => e.type === t)
    expect(per('icona-label')).toHaveLength(2)
    expect(per('badge')).toHaveLength(1)
    expect(per('foto')).toHaveLength(1)
    expect(per('quota')).toHaveLength(3) // larghezza+profondita+altezza
    expect(per('testo')).toHaveLength(0) // nessun titolo (rimosso: chiave categoria non adatta)
  })

  it('preserva l\'ordine del ranking nelle icone in colonna', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const labels = scene.elements.filter((e) => e.type === 'icona-label').map((e) => (e as { chiave: string }).chiave)
    expect(labels).toEqual(['materiale_acciaio', 'montaggio_facile'])
  })

  it('è deterministico: due chiamate producono scene identiche', () => {
    const a = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const b = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('corrisponde al golden committato', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const goldenPath = 'tests/fixtures/scene-2137070.json'
    if (!existsSync(goldenPath)) return // il golden viene generato allo Step 5
    expect(JSON.stringify(scene, null, 2) + '\n').toBe(readFileSync(goldenPath, 'utf8'))
  })
})
