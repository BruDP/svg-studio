import { expect, test } from 'vitest'
import { parseDimensions } from '@/lib/extraction/dimensions'

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

test('nessuna misura → null', () => {
  expect(parseDimensions(['Colore: rosso'])).toBeNull()
})

test('usa la prima riga che contiene misure', () => {
  expect(parseDimensions(['Colore: rosso', 'Misure: l. 51 x p. 63 x h. 84,5 cm', '10x10x10 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})
