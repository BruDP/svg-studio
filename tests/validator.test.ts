import { expect, test } from 'vitest'
import { validateExtraction } from '@/lib/extraction/validator'
import type { ProductRecord } from '@/lib/feed/types'

const product: ProductRecord = {
  sku: 'X',
  images: [],
  descrizioneBreve: 'Frigorifero 4 porte 515L',
  descrizioneEstesa: '',
  notaTecnica: ['Capacità: 515 L', 'Sistema No Frost', 'Misure: 83,3x65,3x177,5 cm'],
  notaEmozionale: '',
  prezzo: '',
  marchio: '',
  urlSlug: '',
  colore: '',
  materiale: '',
  imballo: { lunghezza: null, larghezza: null, altezza: null },
}

test('valore presente nel testo → verificata', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'capacita_litri', valore: '515', testoSorgente: 'Capacità: 515 L' }] },
    product,
  )
  expect(out[0].verificata).toBe(true)
})

test('valore inventato → NON verificata (ma non scartata)', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'capacita_litri', valore: '600', testoSorgente: 'Capacità: 515 L' }] },
    product,
  )
  expect(out).toHaveLength(1)
  expect(out[0].verificata).toBe(false)
})

test('virgola e punto decimale sono equivalenti', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'lunghezza_cavo', valore: '83.3', testoSorgente: 'Misure: 83,3x65,3x177,5 cm' }] },
    product,
  )
  expect(out[0].verificata).toBe(true)
})

test('feature di sola presenza: verificata se testoSorgente compare nel testo', () => {
  const ok = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'no_frost', valore: null, testoSorgente: 'Sistema No Frost' }] },
    product,
  )
  const ko = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'no_frost', valore: null, testoSorgente: 'Tecnologia inverter' }] },
    product,
  )
  expect(ok[0].verificata).toBe(true)
  expect(ko[0].verificata).toBe(false)
})
