import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/feed/parser'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'

const dict = loadDictionary()
const [barbecue] = parseFeed(readFileSync('tests/fixtures/feed-sample.csv', 'utf8'))

const fakeGenerate = vi.fn(async () =>
  JSON.stringify({
    categoria: 'barbecue',
    features: [
      { chiave: 'alimentazione_carbonella', valore: null, testoSorgente: 'Alimentazione a carbonella' },
      { chiave: 'montaggio_facile', valore: null, testoSorgente: 'kit incluso' },
    ],
  }),
)

beforeAll(async () => { await db.extraction.deleteMany() })
afterAll(async () => { await db.extraction.deleteMany(); await db.$disconnect() })

test('GOLDEN: la proposta è byte-identica allo snapshot committato', async () => {
  const proposal = await extractProposal(barbecue, dict, fakeGenerate)
  const expected = readFileSync('tests/fixtures/proposal-2137070.json', 'utf8')
  expect(JSON.stringify(proposal, null, 2) + '\n').toBe(expected)
})

test('seconda chiamata: cache hit, Gemini NON richiamato', async () => {
  const calls = fakeGenerate.mock.calls.length
  const proposal2 = await extractProposal(barbecue, dict, fakeGenerate)
  expect(fakeGenerate.mock.calls.length).toBe(calls)
  expect(proposal2.categoria).toBe('barbecue')
})

test('input diverso → nuovo inputHash → Gemini richiamato', async () => {
  const calls = fakeGenerate.mock.calls.length
  const modificato = { ...barbecue, notaTecnica: [...barbecue.notaTecnica, 'Riga nuova'] }
  await extractProposal(modificato, dict, fakeGenerate)
  expect(fakeGenerate.mock.calls.length).toBe(calls + 1)
})
