import { describe, it, expect } from 'vitest'
import { colonnaPositions, fitFoto, quoteFromBBox } from '@/lib/layout/engine'
import { theme } from '@/lib/theme'

describe('colonnaPositions', () => {
  it('dispone n icone in colonna con gap costante', () => {
    const p = colonnaPositions(3, 100)
    expect(p).toHaveLength(3)
    expect(p[0]).toEqual({ x: theme.margini.colonnaX, y: 100 })
    expect(p[1].y - p[0].y).toBe(theme.margini.colonnaGap)
    expect(p[2].y - p[1].y).toBe(theme.margini.colonnaGap)
    expect(p.every((pt) => pt.x === theme.margini.colonnaX)).toBe(true)
  })
})

describe('fitFoto', () => {
  it('scala mantenendo l\'aspect ratio e centra nel box', () => {
    const out = fitFoto({ width: 200, height: 100 }, { x: 0, y: 0, width: 400, height: 400 })
    // aspect 2:1 dentro 400×400 → 400×200, centrata verticalmente a y=100
    expect(out.width).toBe(400)
    expect(out.height).toBe(200)
    expect(out.x).toBe(0)
    expect(out.y).toBe(100)
  })
})

describe('quoteFromBBox', () => {
  it('genera verticale+orizzontale+diagonale saltando i null', () => {
    const box = { x: 100, y: 100, width: 300, height: 300 }
    const q = quoteFromBBox(box, { larghezza: 50, profondita: 40, altezza: 80 })
    const orient = q.map((e) => e.orientamento).sort()
    expect(orient).toEqual(['diagonale', 'orizzontale', 'verticale'])
    const vert = q.find((e) => e.orientamento === 'verticale')!
    expect(vert.valore).toBe('80 cm')
    // verticale ancorata al bordo destro della foto
    expect(vert.x1).toBe(vert.x2)
    expect(vert.x1).toBeGreaterThanOrEqual(box.x + box.width)
  })

  it('la diagonale parte spostata di "testa" dal corner, come verticale/orizzontale (non sul corner grezzo)', () => {
    const box = { x: 100, y: 100, width: 300, height: 300 }
    const q = quoteFromBBox(box, { larghezza: 50, profondita: 40, altezza: 80 })
    const diag = q.find((e) => e.orientamento === 'diagonale')!
    const orizz = q.find((e) => e.orientamento === 'orizzontale')!
    // il punto di partenza della diagonale non deve coincidere col corner grezzo della foto:
    // deve essere spostato di "testa", come lo è l'ancoraggio della quota orizzontale — altrimenti
    // i trattini perpendicolari delle due quote (distanti solo "testa" px) si sovrappongono.
    const corner = { x: box.x + box.width, y: box.y + box.height }
    expect(diag.x1).toBe(corner.x + theme.freccia.testa)
    expect(diag.y1).toBe(corner.y + theme.freccia.testa)
    // l'estremo della orizzontale è ancorato al bordo grezzo della foto sull'asse X (nessun
    // offset su quell'asse): la diagonale, spostata di "testa" in X, non deve più coincidere
    // con quel punto sull'asse X — altrimenti i trattini si accavallano orizzontalmente.
    expect(diag.x1 - orizz.x2).toBe(theme.freccia.testa)
  })

  it('salta le dimensioni null', () => {
    const q = quoteFromBBox({ x: 0, y: 0, width: 10, height: 10 }, { larghezza: null, profondita: null, altezza: 5 })
    expect(q).toHaveLength(1)
    expect(q[0].orientamento).toBe('verticale')
  })
})
