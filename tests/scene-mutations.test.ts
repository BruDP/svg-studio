import { describe, it, expect } from 'vitest'
import { applyMutation } from '@/lib/scene/mutations'
import type { Scene, IconLabelElement, QuotaElement, FotoElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

function scenaBase(): Scene {
  return {
    version: SCENE_VERSION,
    sku: 'X1',
    templateId: 'colonna-sinistra',
    canvas: { width: 1000, height: 1000 },
    elements: [
      { type: 'testo', id: 'titolo', testo: 'barbecue', x: 60, y: 60, ruolo: 'titolo' },
      { type: 'icona-label', id: 'f0', chiave: 'a', etichetta: 'A', x: 60, y: 160, verificata: true },
      { type: 'icona-label', id: 'f1', chiave: 'b', etichetta: 'B', x: 60, y: 256, verificata: true },
      { type: 'foto', id: 'ph', imageHash: 'h', x: 480, y: 140, width: 400, height: 400 },
    ],
  }
}
const icone = (s: Scene) => s.elements.filter((e): e is IconLabelElement => e.type === 'icona-label')

function scenaConQuota(): Scene {
  const s = scenaBase()
  s.elements.push({ type: 'quota', id: 'q0', orientamento: 'verticale', valore: '84,5 cm', x1: 940, y1: 100, x2: 940, y2: 620 })
  return s
}
const quota = (s: Scene) => s.elements.find((e): e is QuotaElement => e.type === 'quota')!
const foto = (s: Scene) => s.elements.find((e): e is FotoElement => e.type === 'foto')!

describe('applyMutation', () => {
  it('sposta-feature giù inverte l\'ordine delle icone e riflowa le y', () => {
    const s = applyMutation(scenaBase(), { type: 'sposta-feature', id: 'f0', direzione: 'giu' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['b', 'a'])
    // le posizioni y restano quelle della colonna (riflow), non seguono l'elemento
    expect(ic[0].y).toBe(160)
    expect(ic[1].y).toBe(256)
  })

  it('sposta-feature su in cima è no-op sull\'ordine', () => {
    const s = applyMutation(scenaBase(), { type: 'sposta-feature', id: 'f0', direzione: 'su' })
    expect(icone(s).map((e) => e.chiave)).toEqual(['a', 'b'])
  })

  it('rimuovi elimina l\'icona e riflowa le rimanenti', () => {
    const s = applyMutation(scenaBase(), { type: 'rimuovi', id: 'f0' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['b'])
    expect(ic[0].y).toBe(160) // riflow dall'inizio colonna
  })

  it('aggiungi-feature appende con id univoco, verificata false, e riflow', () => {
    const s = applyMutation(scenaBase(), { type: 'aggiungi-feature', chiave: 'c', etichetta: 'C' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['a', 'b', 'c'])
    const nuova = ic[2]
    expect(nuova.verificata).toBe(false)
    expect(nuova.y).toBe(352) // 160 + 2*96
    expect(ic.map((e) => e.id).length).toBe(new Set(ic.map((e) => e.id)).size) // id univoci
  })

  it('modifica-etichetta cambia solo il testo, non la posizione', () => {
    const s = applyMutation(scenaBase(), { type: 'modifica-etichetta', id: 'f1', etichetta: 'Nuova' })
    const f1 = icone(s).find((e) => e.id === 'f1')!
    expect(f1.etichetta).toBe('Nuova')
    expect(f1.y).toBe(256)
  })

  it('è pura: non muta la scena in ingresso', () => {
    const orig = scenaBase()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, { type: 'rimuovi', id: 'f0' })
    expect(orig).toEqual(copia)
  })

  it('preserva gli elementi non-icona (titolo, foto)', () => {
    const s = applyMutation(scenaBase(), { type: 'rimuovi', id: 'f0' })
    expect(s.elements.some((e) => e.id === 'titolo')).toBe(true)
    expect(s.elements.some((e) => e.id === 'ph')).toBe(true)
  })
})

describe('sposta-quota', () => {
  it('sposta l\'estremo iniziale', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'inizio', x: 900, y: 150 })
    expect(quota(s).x1).toBe(900)
    expect(quota(s).y1).toBe(150)
    expect(quota(s).x2).toBe(940) // l'altro estremo invariato
  })

  it('sposta l\'estremo finale', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'fine', x: 880, y: 600 })
    expect(quota(s).x2).toBe(880)
    expect(quota(s).y2).toBe(600)
  })

  it('clampa entro il canvas [0..1000]', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'fine', x: 1200, y: -30 })
    expect(quota(s).x2).toBe(1000)
    expect(quota(s).y2).toBe(0)
  })

  it('no-op se la quota non esiste', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'inesistente', estremo: 'fine', x: 1, y: 1 })
    expect(quota(s).x2).toBe(940)
  })

  it('è pura (non muta l\'input)', () => {
    const orig = scenaConQuota()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, { type: 'sposta-quota', id: 'q0', estremo: 'inizio', x: 1, y: 2 })
    expect(orig).toEqual(copia)
  })
})

describe('imposta-foto', () => {
  it('cambia l\'imageHash della foto', () => {
    const s = applyMutation(scenaBase(), { type: 'imposta-foto', imageHash: 'nuovo-hash' })
    expect(foto(s).imageHash).toBe('nuovo-hash')
  })
  it('no-op se non c\'è foto', () => {
    const senzaFoto: Scene = { ...scenaBase(), elements: scenaBase().elements.filter((e) => e.type !== 'foto') }
    expect(() => applyMutation(senzaFoto, { type: 'imposta-foto', imageHash: 'x' })).not.toThrow()
  })
})
