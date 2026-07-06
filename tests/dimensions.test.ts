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

test('nessuna misura → null', () => {
  expect(parseDimensions(['Colore: rosso'])).toBeNull()
})

test('usa la prima riga che contiene misure', () => {
  expect(parseDimensions(['Colore: rosso', 'Misure: l. 51 x p. 63 x h. 84,5 cm', '10x10x10 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})
