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

test('specchio: la profondità viene rimossa dalla proposta (nessuna categoria dedicata, rilevato dal testo)', async () => {
  const specchio = {
    ...barbecue,
    sku: `${barbecue.sku}-specchio-test`,
    descrizioneBreve: 'Specchio arredo da terra 170x70 cm, rosa cipria, More Amor',
    notaTecnica: ['Misure: l. 70 x p. 34 x h. 170 cm'],
  }
  const proposal = await extractProposal(specchio, dict, fakeGenerate)
  expect(proposal.dimensioni).toEqual({ larghezza: 70, profondita: null, altezza: 170 })
})

test('prodotto non-specchio con le stesse misure: la profondità resta', async () => {
  const nonSpecchio = {
    ...barbecue,
    sku: `${barbecue.sku}-non-specchio-test`,
    descrizioneBreve: 'Comodino da terra 170x70 cm, rosa cipria',
    notaTecnica: ['Misure: l. 70 x p. 34 x h. 170 cm'],
  }
  const proposal = await extractProposal(nonSpecchio, dict, fakeGenerate)
  expect(proposal.dimensioni).toEqual({ larghezza: 70, profondita: 34, altezza: 170 })
})

test('mobile/lampada che CITA lo specchio (non a inizio): la profondità resta (falso positivo reale 2188413/5918801)', async () => {
  const mobile = {
    ...barbecue,
    sku: `${barbecue.sku}-mobile-specchio-test`,
    descrizioneBreve: 'Mobile a specchio da bagno in legno mdf laccato',
    notaTecnica: ['Misure: l. 70 x p. 34 x h. 170 cm'],
  }
  const proposal = await extractProposal(mobile, dict, fakeGenerate)
  expect(proposal.dimensioni).toEqual({ larghezza: 70, profondita: 34, altezza: 170 })
})
