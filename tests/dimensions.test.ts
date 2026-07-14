import { describe, expect, test } from 'vitest'
import { parseDimensions, parseSetDimensions } from '@/lib/extraction/dimensions'

test('formato "l. 51 x p. 63 x h. 84,5 cm"', () => {
  expect(parseDimensions(['Misure: l. 51 x p. 63 x h. 84,5 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})

test('formato compatto "83,3x65,3x177,5 cm"', () => {
  expect(parseDimensions(['Dimensioni: 83,3x65,3x177,5 cm'])).toEqual({
    larghezza: 83.3, profondita: 65.3, altezza: 177.5,
  })
})

test('formato tondo "Ø 70 x h. 75 cm" → diametro come larghezza, profondità assente', () => {
  expect(parseDimensions(['Misure: Ø 70 x h. 75 cm'])).toEqual({
    larghezza: 70, profondita: null, altezza: 75,
  })
})

test('formato tondo senza "h." → "Ø 40 x 90 cm"', () => {
  expect(parseDimensions(['Ø 40 x 90 cm'])).toEqual({
    larghezza: 40, profondita: null, altezza: 90,
  })
})

test('formato tondo senza simbolo Ø, con prefisso "Misure" → "Misure: 70 x h. 75 cm"', () => {
  expect(parseDimensions(['Misure: 70 x h. 75 cm'])).toEqual({
    larghezza: 70, profondita: null, altezza: 75,
  })
})

test('formato tondo senza Ø, doppio spazio dopo i due punti → "Misure:  480 x h. 270 cm"', () => {
  expect(parseDimensions(['Misure:  480 x h. 270 cm'])).toEqual({
    larghezza: 480, profondita: null, altezza: 270,
  })
})

test('linea "N x M cm" senza prefisso "Misure" → non riconosciuta (null)', () => {
  expect(parseDimensions(['70 x h. 75 cm'])).toBeNull()
})

test('nessuna misura → null', () => {
  expect(parseDimensions(['Colore: rosso'])).toBeNull()
})

test('usa la prima riga che contiene misure', () => {
  expect(parseDimensions(['Colore: rosso', 'Misure: l. 51 x p. 63 x h. 84,5 cm', '10x10x10 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})

describe('parseSetDimensions', () => {
  // notaTecnica reale del set valigie (SKU 5926962), caso pulito: ogni blocco "Misure <etichetta>"
  // ha una riga "Capacità <etichetta>" corrispondente.
  const valigie = [
    'Misure valigia piccola: l. 36 x p. 22 x h. 55 cm',
    'Misure valigia media: l. 42 x p. 26 x h. 64 cm',
    'Misure valigia grande: l. 47 x p. 28 x h. 75 cm',
    'Capacità valigia piccola: 38 L',
    'Capacità valigia media: 60 L',
    'Capacità valigia grande: 99 L',
  ]

  test('set pulito (valigie): 3 sotto-prodotti, ordine di apparizione dei blocchi Misure', () => {
    const risultato = parseSetDimensions(valigie)
    expect(risultato).toHaveLength(3)
    expect(risultato.map((s) => s.gruppo)).toEqual(['g0', 'g1', 'g2'])
    expect(risultato.map((s) => s.etichetta)).toEqual(['valigia piccola', 'valigia media', 'valigia grande'])
  })

  test('dimensioni del pezzo piccolo', () => {
    const [piccola] = parseSetDimensions(valigie)
    expect(piccola.dimensioni).toEqual({ larghezza: 36, profondita: 22, altezza: 55 })
  })

  test('badge di capacità del pezzo piccolo', () => {
    const [piccola] = parseSetDimensions(valigie)
    expect(piccola.badges).toHaveLength(1)
    expect(piccola.badges[0]).toMatchObject({
      chiave: 'capacita',
      etichetta: '38 L',
      valore: '38',
      verificata: true,
      priorita: 0,
      badge: true,
    })
  })

  test('prodotto singolo (una sola riga di misure, nessuna Capacità) → []', () => {
    expect(parseSetDimensions(['l. 51 x p. 63 x h. 84,5 cm'])).toEqual([])
  })

  test('set giardino sporco (Portata...Kg, non Capacità...L) → [] (gate capacità, Piano B non nostro)', () => {
    const giardino = [
      'Misure poltroncine: l. 75 x p. 85 x h. 86 cm',
      'Portata massima poltroncine: 150 Kg',
      'Misure divanetto:   l. 140 x p. 85 x h. 86 cm',
      'Portata massima divanetto: 300 Kg',
      'Misure tavolinetto: l. 110 x p. 64,5 h. 40,5 cm',
      'Portata massima tavolinetto: 50 Kg',
      'Misure seduta: l. 65 x p. 64 cm',
      'Misure cuscino divano: l. 130 x p. 67,5 x h. 11 cm',
    ]
    expect(parseSetDimensions(giardino)).toEqual([])
  })

  test('un solo blocco Misure con Capacità corrispondente (sotto soglia 2) → []', () => {
    const uno = [
      'Misure valigia piccola: l. 36 x p. 22 x h. 55 cm',
      'Capacità valigia piccola: 38 L',
    ]
    expect(parseSetDimensions(uno)).toEqual([])
  })

  test('nessuna notaTecnica → []', () => {
    expect(parseSetDimensions([])).toEqual([])
  })
})
