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

function scenaSet(): Scene {
  return {
    version: SCENE_VERSION,
    sku: 'SET1',
    templateId: 'multi-prodotto',
    canvas: { width: 1000, height: 1000 },
    elements: [
      { type: 'testo', id: 'titolo', testo: 'set valigie', x: 60, y: 60, ruolo: 'titolo' },
      { type: 'foto', id: 'ph-g0', imageHash: 'h0', x: 40, y: 120, width: 300, height: 300, gruppo: 'g0' },
      { type: 'quota', id: 'q-g0-0', orientamento: 'verticale', valore: '55 cm', x1: 380, y1: 120, x2: 380, y2: 420, gruppo: 'g0' },
      { type: 'quota', id: 'q-g0-1', orientamento: 'orizzontale', valore: '36 cm', x1: 40, y1: 460, x2: 340, y2: 460, gruppo: 'g0' },
      { type: 'badge', id: 'bg-g0-0', testo: '30 L', x: 40, y: 90, gruppo: 'g0' },
      { type: 'foto', id: 'ph-g1', imageHash: 'h1', x: 500, y: 120, width: 300, height: 300, gruppo: 'g1' },
      { type: 'quota', id: 'q-g1-0', orientamento: 'verticale', valore: '65 cm', x1: 840, y1: 120, x2: 840, y2: 420, gruppo: 'g1' },
      { type: 'badge', id: 'bg-g1-0', testo: '50 L', x: 500, y: 90, gruppo: 'g1' },
      { type: 'icona-label', id: 'f0', chiave: 'a', etichetta: 'A', x: 40, y: 620, verificata: true },
    ],
  }
}
const fotoDiGruppo = (s: Scene, g: string) =>
  s.elements.find((e): e is FotoElement => e.type === 'foto' && e.gruppo === g)!
const quoteDiGruppo = (s: Scene, g: string) =>
  s.elements.filter((e): e is QuotaElement => e.type === 'quota' && e.gruppo === g)

describe('imposta-foto con gruppo (set multi-prodotto)', () => {
  it('aggiorna SOLO la foto e le quote del gruppo indicato, lasciando g0/icone/badge/testo invariati', () => {
    const orig = scenaSet()
    const s = applyMutation(orig, {
      type: 'imposta-foto',
      imageHash: 'nuovo-hash-g1',
      gruppo: 'g1',
      foto: { x: 520, y: 130, width: 260, height: 260 },
      quote: [{ orientamento: 'verticale', valore: '70 cm', x1: 800, y1: 130, x2: 800, y2: 390 }],
    })

    // g1: aggiornato
    const f1 = fotoDiGruppo(s, 'g1')
    expect(f1.imageHash).toBe('nuovo-hash-g1')
    expect({ x: f1.x, y: f1.y, width: f1.width, height: f1.height }).toEqual({ x: 520, y: 130, width: 260, height: 260 })
    const q1 = quoteDiGruppo(s, 'g1')
    expect(q1.map((e) => e.id)).toEqual(['q-g1-0']) // id preservato
    expect(q1[0].valore).toBe('70 cm')

    // g0: invariato
    const f0 = fotoDiGruppo(s, 'g0')
    expect(f0).toEqual(fotoDiGruppo(orig, 'g0'))
    const q0 = quoteDiGruppo(s, 'g0')
    expect(q0).toEqual(quoteDiGruppo(orig, 'g0'))

    // icone/badge/testo invariati
    expect(s.elements.find((e) => e.id === 'bg-g0-0')).toEqual(orig.elements.find((e) => e.id === 'bg-g0-0'))
    expect(s.elements.find((e) => e.id === 'bg-g1-0')).toEqual(orig.elements.find((e) => e.id === 'bg-g1-0'))
    expect(s.elements.find((e) => e.id === 'f0')).toEqual(orig.elements.find((e) => e.id === 'f0'))
    expect(s.elements.find((e) => e.id === 'titolo')).toEqual(orig.elements.find((e) => e.id === 'titolo'))
  })

  it('con più quote nuove che esistenti in quel gruppo: appende con id `q-<gruppo>-<qi>`, senza toccare le quote dell\'altro gruppo', () => {
    const s = applyMutation(scenaSet(), {
      type: 'imposta-foto',
      imageHash: 'h0b',
      gruppo: 'g0',
      quote: [
        { orientamento: 'verticale', valore: 'A', x1: 1, y1: 2, x2: 3, y2: 4 },
        { orientamento: 'orizzontale', valore: 'B', x1: 5, y1: 6, x2: 7, y2: 8 },
        { orientamento: 'diagonale', valore: 'C', x1: 9, y1: 10, x2: 11, y2: 12 },
      ],
    })
    const q0 = quoteDiGruppo(s, 'g0')
    expect(q0.map((e) => e.id)).toEqual(['q-g0-0', 'q-g0-1', 'q-g0-2'])
    expect(q0[2].valore).toBe('C')
    // g1 invariato (1 sola quota, non toccata)
    expect(quoteDiGruppo(s, 'g1').map((e) => e.id)).toEqual(['q-g1-0'])
  })

  it('con meno quote nuove che esistenti in quel gruppo: rimuove solo le eccedenti di quel gruppo', () => {
    const s = applyMutation(scenaSet(), {
      type: 'imposta-foto',
      imageHash: 'h0c',
      gruppo: 'g0',
      quote: [{ orientamento: 'verticale', valore: 'solo', x1: 1, y1: 1, x2: 1, y2: 2 }],
    })
    expect(quoteDiGruppo(s, 'g0').map((e) => e.id)).toEqual(['q-g0-0'])
    expect(quoteDiGruppo(s, 'g1').map((e) => e.id)).toEqual(['q-g1-0']) // g1 intatto
  })

  it('senza gruppo su scena set: comportamento odierno (agisce su tutte le foto/quote, retrocompat)', () => {
    const s = applyMutation(scenaSet(), { type: 'imposta-foto', imageHash: 'tutte' })
    expect(fotoDiGruppo(s, 'g0').imageHash).toBe('tutte')
    expect(fotoDiGruppo(s, 'g1').imageHash).toBe('tutte')
  })

  it('è pura: non muta la scena in ingresso', () => {
    const orig = scenaSet()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, {
      type: 'imposta-foto',
      imageHash: 'x',
      gruppo: 'g1',
      foto: { x: 1, y: 1, width: 1, height: 1 },
      quote: [{ orientamento: 'verticale', valore: 'x', x1: 1, y1: 1, x2: 1, y2: 1 }],
    })
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

  it('con foto+quote: aggiorna geometria foto e sostituisce le quote (id e ordine preservati)', () => {
    const s = applyMutation(scenaConQuota(), {
      type: 'imposta-foto',
      imageHash: 'crop-hash',
      foto: { x: 500, y: 120, width: 300, height: 700 },
      quote: [{ orientamento: 'verticale', valore: '90 cm', x1: 810, y1: 120, x2: 810, y2: 820 }],
    })
    const f = foto(s)
    expect(f.imageHash).toBe('crop-hash')
    expect({ x: f.x, y: f.y, width: f.width, height: f.height }).toEqual({ x: 500, y: 120, width: 300, height: 700 })
    const q = quota(s)
    expect(q.id).toBe('q0')            // id preservato
    expect(q.valore).toBe('90 cm')
    expect(q.x1).toBe(810)
  })

  it('con più quote nuove che esistenti: appende con id progressivi', () => {
    const s = applyMutation(scenaConQuota(), {
      type: 'imposta-foto', imageHash: 'h',
      quote: [
        { orientamento: 'verticale', valore: 'A', x1: 1, y1: 2, x2: 3, y2: 4 },
        { orientamento: 'orizzontale', valore: 'B', x1: 5, y1: 6, x2: 7, y2: 8 },
      ],
    })
    const q = s.elements.filter((e) => e.type === 'quota')
    expect(q.map((e) => e.id)).toEqual(['q0', 'q1'])
    expect(q[1].valore).toBe('B')
  })

  it('con meno quote nuove che esistenti: rimuove quelle in eccesso', () => {
    const due = scenaConQuota()
    due.elements.push({ type: 'quota', id: 'q1', orientamento: 'orizzontale', valore: 'x', x1: 0, y1: 0, x2: 1, y2: 1 })
    const s = applyMutation(due, { type: 'imposta-foto', imageHash: 'h', quote: [
      { orientamento: 'verticale', valore: 'solo', x1: 1, y1: 1, x2: 1, y2: 2 },
    ] })
    expect(s.elements.filter((e) => e.type === 'quota').map((e) => e.id)).toEqual(['q0'])
  })

  it('non tocca icone/badge/testo', () => {
    const base = scenaConQuota()
    base.elements.push({ type: 'badge', id: 'bg0', testo: '120 KG', x: 500, y: 900 })
    const s = applyMutation(base, {
      type: 'imposta-foto', imageHash: 'h',
      foto: { x: 1, y: 1, width: 1, height: 1 }, quote: [],
    })
    expect(s.elements.filter((e) => e.type === 'icona-label').map((e) => e.id)).toEqual(['f0', 'f1'])
    expect(s.elements.find((e) => e.id === 'bg0')).toBeTruthy()
  })

  it('è pura: non muta la scena in ingresso', () => {
    const orig = scenaConQuota()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, { type: 'imposta-foto', imageHash: 'h', foto: { x: 1, y: 1, width: 1, height: 1 }, quote: [] })
    expect(orig).toEqual(copia)
  })
})
