import { expect, test } from 'vitest'
import { loadDictionary } from '@/lib/dictionary/loader'
import { rankFeatures } from '@/lib/extraction/ranking'
import type { ValidatedFeature } from '@/lib/extraction/validator'

const dict = loadDictionary()
const vf = (chiave: string, valore: string | null = null): ValidatedFeature => ({
  chiave,
  valore,
  testoSorgente: 'x',
  verificata: true,
})

test('ordina per priorità decrescente, tie-break alfabetico sulla chiave', () => {
  const out = rankFeatures([vf('display_touch'), vf('no_frost'), vf('classe_energetica', 'E')], 'frigorifero', dict)
  expect(out.features.map((f) => f.chiave)).toEqual(['classe_energetica', 'no_frost', 'display_touch'])
})

test('le chiavi badge finiscono in badges, non in features', () => {
  const out = rankFeatures([vf('capacita_litri', '515'), vf('no_frost')], 'frigorifero', dict)
  expect(out.badges.map((f) => f.chiave)).toEqual(['capacita_litri'])
  expect(out.features.map((f) => f.chiave)).toEqual(['no_frost'])
})

test('scarta le feature non applicabili alla categoria', () => {
  const out = rankFeatures([vf('doppia_cerniera'), vf('no_frost')], 'frigorifero', dict)
  expect(out.features.map((f) => f.chiave)).toEqual(['no_frost'])
})

test('massimo 7 feature icona: l ottava (priorità più bassa) viene tagliata', () => {
  // sedia_ufficio_gaming ha 8 feature icona applicabili nel dizionario seed
  const many = [
    vf('cuscini_inclusi'), vf('ruote_spostamento', '5'), vf('struttura_girevole'),
    vf('schienale_reclinabile'), vf('montaggio_facile'), vf('pulizia_panno'),
    vf('led_rgb', '338'), vf('cuscino_sfoderabile'),
  ]
  const out = rankFeatures(many, 'sedia_ufficio_gaming', dict)
  expect(out.features).toHaveLength(7)
  // pulizia_panno ha priorità 20, la più bassa: è quella esclusa
  expect(out.features.map((f) => f.chiave)).not.toContain('pulizia_panno')
})

test('etichetta compilata con il valore', () => {
  const out = rankFeatures([vf('classe_energetica', 'E')], 'frigorifero', dict)
  expect(out.features[0].etichetta).toBe('Classe E')
})

test('chiave duplicata: vince la prima occorrenza', () => {
  const out = rankFeatures([vf('no_frost'), vf('no_frost')], 'frigorifero', dict)
  expect(out.features.filter((f) => f.chiave === 'no_frost')).toHaveLength(1)
})
