import { expect, test } from 'vitest'
import { loadDictionary } from '@/lib/dictionary/loader'

test('il dizionario reale carica e valida', () => {
  const dict = loadDictionary()
  expect(dict.version).toBe(3)
  expect(Object.keys(dict.features).length).toBeGreaterThanOrEqual(20)
  expect(dict.categorie).toContain('frigorifero')
  expect(dict.categorie).toContain('condizionatore_portatile')
  expect(dict.categorie).toContain('ventilatore')
  expect(dict.categorie).toContain('deumidificatore')
})

test('ogni feature con valore obbligatorio ha {valore} nella label, e viceversa', () => {
  const dict = loadDictionary()
  for (const [key, f] of Object.entries(dict.features)) {
    const hasPlaceholder = f.label.includes('{valore}')
    expect(hasPlaceholder, `feature ${key}`).toBe(f.valore === 'obbligatorio')
  }
})

test('ogni categoria referenziata esiste', () => {
  const dict = loadDictionary()
  for (const f of Object.values(dict.features)) {
    for (const c of f.categorie) expect(dict.categorie).toContain(c)
  }
})

test('id icona nel formato set:nome', () => {
  const dict = loadDictionary()
  for (const f of Object.values(dict.features)) {
    expect(f.icona).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/)
  }
})

test('categoria inesistente in una feature → errore descrittivo', () => {
  expect(() => loadDictionary('tests/fixtures/dict-broken')).toThrow(/categoria sconosciuta/i)
})
