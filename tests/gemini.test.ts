import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseFeed } from '@/lib/feed/parser'
import { loadDictionary } from '@/lib/dictionary/loader'
import { buildPrompt, buildResponseSchema, extractRaw } from '@/lib/extraction/gemini'

const dict = loadDictionary()
const [product] = parseFeed(readFileSync('tests/fixtures/feed-sample.csv', 'utf8'))

test('lo schema di risposta vincola chiavi e categorie agli enum del dizionario', () => {
  const schema = buildResponseSchema(dict) as any
  expect(schema.properties.categoria.enum).toEqual(dict.categorie)
  expect(schema.properties.features.items.properties.chiave.enum).toEqual(Object.keys(dict.features).sort())
})

test('il prompt contiene la Nota Tecnica e le regole', () => {
  const prompt = buildPrompt(product, dict)
  expect(prompt).toContain('Alimentazione a carbonella')
  expect(prompt).toContain('NON inventare')
})

test('extractRaw usa il generate iniettato e parsa il JSON', async () => {
  const fake = async () =>
    JSON.stringify({
      categoria: 'barbecue',
      features: [{ chiave: 'alimentazione_carbonella', valore: null, testoSorgente: 'Alimentazione a carbonella' }],
    })
  const out = await extractRaw(product, dict, fake)
  expect(out.categoria).toBe('barbecue')
  expect(out.features[0].chiave).toBe('alimentazione_carbonella')
})
