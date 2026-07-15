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

  // notaTecnica REALE del set giardino (SKU 2188908, "Set giardino 4 posti, in alluminio, Ibiza
  // Est…"), interrogata dal feed. Caso sporco: badge di "Portata massima ... Kg" (non "Capacità
  // ... L"), separatore mancante nel tavolinetto, righe-accessorio (seduta/cuscini/schienale) con
  // la stessa forma "Misure <etichetta>" dei pezzi veri ma senza badge corrispondente.
  const giardino = [
    'Set giardino Ibiza Est…',
    '4 posti a sedere',
    'In alluminio',
    'Design moderno ideale per giardini e terrazzi',
    'Il set si compone di:',
    '2 poltroncine singole in alluminio con cuscini:',
    'Portata massima poltroncine: 150 Kg',
    'Misure seduta: l. 65 x p. 64 cm',
    'Altezza seduta da terra: 31,5 cm (senza cuscini)',
    'Misure poltroncine: l. 75 x p. 85 x h. 86 cm',
    '1 divanetto in alluminio con cuscini:',
    '2 posti a sedere',
    'Portata massima divanetto: 300 Kg',
    'Misure seduta: 130 x 64 cm',
    'Altezza seduta da terra: 31,5 cm (senza cuscini)',
    'Misure divanetto: l. 140 x p. 85 x h. 86 cm',
    '1 tavolinetto',
    'Portata massima tavolinetto: 50 Kg',
    'Misure tavolinetto: l. 110 x p. 64,5 h. 40,5 cm',
    'Cuscini in poliestere sfoderabili con cerniera e lavabili a mano',
    'Imbottitura in spugna di poliuretano e fibra di poliestere',
    'Misura cuscino divano: l. 130 x p. 67,5 x h. 11 cm',
    'Misura cuscini poltroncine: l. 65 x 67,5 x h. 11 cm',
    'Misure cuscini schienale: l. 65 x 50 x h. 9 cm',
    'Semplice da assemblare',
    'Istruzioni di montaggio incluse',
  ]

  test('set giardino sporco (2188908): 3 pezzi (poltroncine, divanetto, tavolinetto), ordine di apparizione', () => {
    const risultato = parseSetDimensions(giardino)
    expect(risultato).toHaveLength(3)
    expect(risultato.map((s) => s.gruppo)).toEqual(['g0', 'g1', 'g2'])
    expect(risultato.map((s) => s.etichetta)).toEqual(['poltroncine', 'divanetto', 'tavolinetto'])
  })

  test('tavolinetto: separatore "x" mancante prima di "h." tollerato', () => {
    const [, , tavolinetto] = parseSetDimensions(giardino)
    expect(tavolinetto.dimensioni).toEqual({ larghezza: 110, profondita: 64.5, altezza: 40.5 })
  })

  test('ogni pezzo del giardino ha un badge di portata (Kg), non capacità', () => {
    const risultato = parseSetDimensions(giardino)
    expect(risultato.every((s) => s.badges.length === 1 && s.badges[0].chiave === 'portata')).toBe(true)
    const divanetto = risultato.find((s) => s.etichetta === 'divanetto')!
    expect(divanetto.badges[0]).toMatchObject({
      chiave: 'portata', etichetta: '300 Kg', valore: '300', verificata: true, priorita: 0, badge: true,
    })
  })

  test('nessun pezzo per le righe-accessorio (seduta/cuscini/schienale)', () => {
    const etichette = parseSetDimensions(giardino).map((s) => s.etichetta)
    expect(etichette).not.toContain('seduta')
    expect(etichette.some((e) => e.includes('cuscino'))).toBe(false)
    expect(etichette.some((e) => e.includes('schienale'))).toBe(false)
  })

  // Difesa in profondità: nei dati reali del giardino le righe-accessorio vengono già scartate per
  // FORMA (manca "h.", oppure "Misura" singolare) — quindi il caso sopra NON esercita davvero la
  // blacklist ETICHETTE_ACCESSORIO. Questo caso ipotetico ma plausibile (feed sporco futuro) mette
  // un accessorio "seduta" in formato COMPLETO l./p./h. e perfino con un badge di portata
  // corrispondente: il gate badge da solo lo accetterebbe (il badge c'è), è la blacklist a
  // escluderlo. Senza `eAccessorio` questo test fallirebbe (3 pezzi invece di 2).
  test('difesa in profondità: accessorio in formato completo E con badge viene comunque escluso dalla blacklist', () => {
    const conAccessorioCorroborato = [
      'Misure poltroncine: l. 75 x p. 85 x h. 86 cm',
      'Portata massima poltroncine: 150 Kg',
      'Misure divanetto: l. 140 x p. 85 x h. 86 cm',
      'Portata massima divanetto: 300 Kg',
      'Misure seduta: l. 65 x p. 64 x h. 40 cm', // accessorio in formato COMPLETO...
      'Portata massima seduta: 120 Kg', // ...e perfino con badge corrispondente
    ]
    const etichette = parseSetDimensions(conAccessorioCorroborato).map((s) => s.etichetta)
    expect(etichette).toEqual(['poltroncine', 'divanetto'])
    expect(etichette).not.toContain('seduta')
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
