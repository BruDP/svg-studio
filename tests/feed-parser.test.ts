import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseFeed } from '@/lib/feed/parser'

const csv = readFileSync('tests/fixtures/feed-sample.csv', 'utf8')

test('parsa le righe e i campi base', () => {
  const rows = parseFeed(csv)
  expect(rows).toHaveLength(2)
  expect(rows[0].sku).toBe('2137070')
  expect(rows[0].marchio).toBe('Galileo')
})

test('decodifica entità HTML e rimuove i tag', () => {
  const [r] = parseFeed(csv)
  expect(r.descrizioneBreve).toBe('Barbecue tondo rosso con ruote Ø51xh.84,5 cm, BestBQ')
  expect(r.notaEmozionale).toBe('Perché scegliere BestBQ?')
})

test('divide la Nota Tecnica in righe pulite', () => {
  const [r] = parseFeed(csv)
  expect(r.notaTecnica).toEqual([
    'Barbecue tondo con ruote BestBQ',
    'Alimentazione a carbonella',
    'Griglia cromata rimovibile',
    'Misure: l. 51 x p. 63 x h. 84,5 cm',
    'Colore: rosso',
  ])
})

test('immagini: deduplica e scarta i vuoti', () => {
  const rows = parseFeed(csv)
  expect(rows[0].images).toEqual(['https://ex.it/a.jpeg', 'https://ex.it/b.jpeg', 'https://ex.it/c.jpeg'])
  expect(rows[1].images).toEqual(['https://ex.it/d.jpeg'])
})

test('imballo numerico o null', () => {
  const rows = parseFeed(csv)
  expect(rows[0].imballo).toEqual({ lunghezza: 53, larghezza: 53, altezza: 40 })
  expect(rows[1].imballo).toEqual({ lunghezza: null, larghezza: null, altezza: null })
})
