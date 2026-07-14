import { describe, it, expect } from 'vitest'
import { celleProdotti, colonnaPositions, fitFoto, grigliaPositions, quoteFromBBox } from '@/lib/layout/engine'
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

describe('celleProdotti', () => {
  it('dispone n rettangoli in riga dentro il canvas, larghezza uguale, x crescente', () => {
    const celle = celleProdotti(3)
    expect(celle).toHaveLength(3)
    // tutte dentro il canvas 1000×1000
    celle.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.width).toBeLessThanOrEqual(1000)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y + c.height).toBeLessThanOrEqual(1000)
    })
    // larghezze uguali
    expect(celle[1].width).toBe(celle[0].width)
    expect(celle[2].width).toBe(celle[0].width)
    // x crescente da sinistra a destra
    expect(celle[1].x).toBeGreaterThan(celle[0].x)
    expect(celle[2].x).toBeGreaterThan(celle[1].x)
    // gutter tra celle > 0 e sufficiente per la quota verticale + etichetta (non invade la cella successiva)
    const gutter0 = celle[1].x - (celle[0].x + celle[0].width)
    const gutter1 = celle[2].x - (celle[1].x + celle[1].width)
    expect(gutter0).toBeGreaterThan(0)
    expect(gutter1).toBe(gutter0)
    const minGutter = theme.freccia.testa + theme.freccia.labelGap
    expect(gutter0).toBeGreaterThan(minGutter)
  })

  it('è pura e deterministica: stessa chiamata → stesso risultato', () => {
    expect(celleProdotti(3)).toEqual(celleProdotti(3))
    expect(celleProdotti(4)).toEqual(celleProdotti(4))
  })

  it('n=1 produce un solo rettangolo dentro il canvas', () => {
    const celle = celleProdotti(1)
    expect(celle).toHaveLength(1)
    expect(celle[0].x).toBeGreaterThanOrEqual(0)
    expect(celle[0].x + celle[0].width).toBeLessThanOrEqual(1000)
  })
})

describe('grigliaPositions', () => {
  it('dispone n punti in griglia a 3 colonne, righe = ceil(n/3)', () => {
    const p = grigliaPositions(7)
    expect(p).toHaveLength(7)

    // x su 3 valori distinti ripetuti
    const xs = Array.from(new Set(p.map((pt) => pt.x))).sort((a, b) => a - b)
    expect(xs).toHaveLength(3)

    // 3 righe (ceil(7/3) = 3): y su 3 valori distinti, crescenti per riga
    const ys = Array.from(new Set(p.map((pt) => pt.y))).sort((a, b) => a - b)
    expect(ys).toHaveLength(3)
    expect(ys[1]).toBeGreaterThan(ys[0])
    expect(ys[2]).toBeGreaterThan(ys[1])

    // ordine riga-per-riga: colonna crescente all'interno della riga, poi riga successiva
    expect(p[0].x).toBe(xs[0])
    expect(p[1].x).toBe(xs[1])
    expect(p[2].x).toBe(xs[2])
    expect(p[3].x).toBe(xs[0])
    expect(p[3].y).toBe(ys[1])

    // tutti dentro il canvas, sotto la zona-foto (celleProdotti di default finisce a y=540)
    p.forEach((pt) => {
      expect(pt.x).toBeGreaterThanOrEqual(0)
      expect(pt.x + theme.icona.raggio * 2).toBeLessThanOrEqual(1000)
      expect(pt.y).toBeGreaterThan(540)
      expect(pt.y + theme.icona.raggio * 2).toBeLessThanOrEqual(1000)
    })
  })

  it('è pura e deterministica: stessa chiamata → stesso risultato', () => {
    expect(grigliaPositions(7)).toEqual(grigliaPositions(7))
    expect(grigliaPositions(5)).toEqual(grigliaPositions(5))
  })

  it('n multiplo delle colonne: ultima riga completa', () => {
    const p = grigliaPositions(6)
    expect(p).toHaveLength(6)
    const ys = Array.from(new Set(p.map((pt) => pt.y)))
    expect(ys).toHaveLength(2)
  })
})
