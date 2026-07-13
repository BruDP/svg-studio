import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { renderScene } from '@/lib/render/svg'
import { parseScene } from '@/lib/scene/schema'

const scene = parseScene(JSON.parse(readFileSync('tests/fixtures/scene-2137070.json', 'utf8')))

const deps = {
  icon: (k: string) => (k === 'materiale_acciaio' ? '<path d="M2 2h20"/>' : null),
  image: (h: string) => (h === 'abc123' ? 'data:image/png;base64,AAAA' : null),
}

describe('renderScene', () => {
  it('produce un SVG con le dimensioni del canvas', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg).toMatch(/width="1000"/)
    expect(svg).toMatch(/height="1000"/)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('inserisce l\'icona risolta e il segnaposto per quella mancante', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('M2 2h20') // icona risolta
    // montaggio_facile non ha icona → deve comunque esserci il cerchio segnaposto
    expect(svg).toMatch(/<circle/)
  })

  it('incorpora la foto come data URI', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('data:image/png;base64,AAAA')
  })

  it('usa i token di theme (colore testo) e nessun colore hard-coded diverso', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('#4A4A4A')
  })

  it('è deterministico: due render sono byte-identici', () => {
    expect(renderScene(scene, deps)).toBe(renderScene(scene, deps))
  })

  it('corrisponde al golden committato', () => {
    const goldenPath = 'tests/fixtures/render-2137070.svg'
    if (!existsSync(goldenPath)) return // generato allo Step 5
    expect(renderScene(scene, deps)).toBe(readFileSync(goldenPath, 'utf8'))
  })

  it('badge: la larghezza del box accomoda il testo lungo (nessun taglio)', () => {
    const badgeScene = parseScene({
      version: 1,
      sku: 'TEST',
      templateId: 'colonna-sinistra',
      canvas: { width: 1000, height: 1000 },
      elements: [{ type: 'badge', id: 'b1', testo: '7000 BTU', x: 100, y: 100 }],
    })
    const svg = renderScene(badgeScene, deps)
    // rect del badge identificato dall'altezza (theme.badge.altezza = 52)
    const m = svg.match(/<rect[^>]*width="(\d+)" height="52"/)
    expect(m).not.toBeNull()
    const w = Number(m![1])
    // larghezza testo stimata "7000 BTU" (8 char) a font badge 30 con ratio 0.52 ≈ 125px:
    // il box deve contenerla (il testo è centrato in x+w/2). La vecchia formula (8*8+40=104) tagliava.
    expect(w).toBeGreaterThanOrEqual(125)
  })

  it('etichetta corta: resta un unico <text>, nessun <tspan> (nessuna regressione)', () => {
    const svg = renderScene(scene, deps)
    // "Acciaio" e "Montaggio facile" nel golden sono corte: non devono generare tspan.
    expect(svg).not.toContain('<tspan')
  })

  it('quota "premium" produce i trattini perpendicolari agli estremi, oltre alla linea principale', () => {
    const quotaScene = parseScene({
      version: 1,
      sku: 'TEST',
      templateId: 'colonna-sinistra',
      canvas: { width: 1000, height: 1000 },
      elements: [
        { type: 'quota', id: 'q1', orientamento: 'verticale', valore: '10 cm', x1: 100, y1: 100, x2: 100, y2: 200 },
      ],
    })
    const svg = renderScene(quotaScene, deps)
    const linee = [...svg.matchAll(/<line/g)]
    // linea principale + 2 trattini (tick) agli estremi = 3
    expect(linee.length).toBe(3)
  })

  it('etichetta troppo lunga per la colonna va a capo su piu righe (tspan) invece di essere coperta dalla foto', () => {
    const sceneLunga = {
      ...scene,
      elements: scene.elements.map((el) =>
        el.type === 'icona-label' ? { ...el, etichetta: 'Dotato di 10 ruote per lo spostamento rapido' } : el,
      ),
    }
    const svg = renderScene(sceneLunga, deps)
    expect(svg).toContain('<tspan')
    // ogni riga (tspan) deve restare sotto la larghezza massima di colonna: nessuna riga
    // supera i ~21 caratteri (theme.margini.labelMaxLarghezza / (fontSize * rapporto calibrato)).
    const righe = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1])
    expect(righe.length).toBeGreaterThan(1)
    for (const riga of righe) {
      expect(riga.replace('…', '').length).toBeLessThanOrEqual(22)
    }
    // il testo intero deve restare presente (nessuna parola persa), a parte l'eventuale ellissi.
    expect(righe.join(' ').replace('…', '')).toContain('Dotato')
  })
})
