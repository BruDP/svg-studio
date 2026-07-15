import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { composeMultiProdotto, TEMPLATE_ID, CANVAS } from '@/lib/layout/multi-prodotto'
import { parseScene } from '@/lib/scene/schema'
import type { SchedaProposal } from '@/lib/extraction/engine'

// notaTecnica reale del set valigie (SKU 5926962, vedi tests/dimensions.test.ts) già passata
// per parseSetDimensions: qui costruiamo direttamente la SchedaProposal risultante.
const proposal: SchedaProposal = {
  sku: '5926962',
  categoria: 'valigie',
  features: [
    { chiave: 'materiale_policarbonato', etichetta: 'Policarbonato', valore: null, verificata: true, priorita: 90, badge: false },
    { chiave: 'ruote_4', etichetta: '4 ruote girevoli', valore: null, verificata: true, priorita: 85, badge: false },
    { chiave: 'lucchetto_tsa', etichetta: 'Lucchetto TSA', valore: null, verificata: true, priorita: 80, badge: false },
    { chiave: 'manico_telescopico', etichetta: 'Manico telescopico', valore: null, verificata: false, priorita: 70, badge: false },
    { chiave: 'espandibile', etichetta: 'Espandibile', valore: null, verificata: false, priorita: 60, badge: false },
    { chiave: 'interno_foderato', etichetta: 'Interno foderato', valore: null, verificata: false, priorita: 50, badge: false },
    { chiave: 'divisorio_interno', etichetta: 'Divisorio interno', valore: null, verificata: false, priorita: 40, badge: false },
  ],
  badges: [],
  dimensioni: null,
  sottoProdotti: [
    {
      gruppo: 'g0',
      etichetta: 'valigia piccola',
      dimensioni: { larghezza: 36, profondita: 22, altezza: 55 },
      badges: [{ chiave: 'capacita', etichetta: '38 L', valore: '38', verificata: true, priorita: 0, badge: true }],
    },
    {
      gruppo: 'g1',
      etichetta: 'valigia media',
      dimensioni: { larghezza: 42, profondita: 26, altezza: 64 },
      badges: [{ chiave: 'capacita', etichetta: '60 L', valore: '60', verificata: true, priorita: 0, badge: true }],
    },
    {
      gruppo: 'g2',
      etichetta: 'valigia grande',
      dimensioni: { larghezza: 47, profondita: 28, altezza: 75 },
      badges: [{ chiave: 'capacita', etichetta: '99 L', valore: '99', verificata: true, priorita: 0, badge: true }],
    },
  ],
}

const fotoPerGruppo = [
  { gruppo: 'g0', imageHash: 'hash-g0', bbox: { width: 36, height: 55 } },
  { gruppo: 'g1', imageHash: 'hash-g1', bbox: { width: 42, height: 64 } },
  { gruppo: 'g2', imageHash: 'hash-g2', bbox: { width: 47, height: 75 } },
]

describe('composeMultiProdotto', () => {
  it('produce una scena valida con canvas 1000×1000 e templateId corretto', () => {
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe(TEMPLATE_ID)
    expect(scene.canvas).toEqual(CANVAS)
    expect(scene.sku).toBe('5926962')
  })

  it('crea foto/quote/badge per gruppo e icone condivise senza gruppo', () => {
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    const per = (t: string) => scene.elements.filter((e) => e.type === t)

    const foto = per('foto')
    expect(foto).toHaveLength(3)
    expect(foto.map((f) => (f as { gruppo?: string }).gruppo)).toEqual(['g0', 'g1', 'g2'])

    const quote = per('quota')
    // 3 dimensioni (larghezza+profondita+altezza) per gruppo × 3 gruppi
    expect(quote).toHaveLength(9)
    expect(quote.every((q) => typeof (q as { gruppo?: string }).gruppo === 'string')).toBe(true)

    const badge = per('badge')
    expect(badge).toHaveLength(3) // una capacità per pezzo
    expect(badge.map((b) => (b as { gruppo?: string }).gruppo)).toEqual(['g0', 'g1', 'g2'])

    const icone = per('icona-label')
    expect(icone).toHaveLength(7)
    expect(icone.every((i) => (i as { gruppo?: string }).gruppo === undefined)).toBe(true)
  })

  it('assegna gli id con prefisso di gruppo come da piano', () => {
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    const idsOf = (t: string) => scene.elements.filter((e) => e.type === t).map((e) => e.id)

    expect(idsOf('foto')).toEqual(['ph-g0', 'ph-g1', 'ph-g2'])
    expect(idsOf('badge')).toEqual(['bg-g0-0', 'bg-g1-0', 'bg-g2-0'])
    expect(idsOf('quota')).toEqual([
      'q-g0-0', 'q-g0-1', 'q-g0-2',
      'q-g1-0', 'q-g1-1', 'q-g1-2',
      'q-g2-0', 'q-g2-1', 'q-g2-2',
    ])
    expect(idsOf('icona-label')).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'])
  })

  it('nessuna etichetta della griglia condivisa supera lo spazio reale disponibile per colonna', () => {
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    const icone = scene.elements.filter((e) => e.type === 'icona-label') as { maxLarghezzaEtichetta?: number }[]
    // GRIGLIA_COL_GAP (300) - diametro cerchio (84) - labelGap (20) ≈ 196: il valore impostato
    // dal template deve starci dentro con margine.
    for (const i of icone) {
      expect(i.maxLarghezzaEtichetta).toBeDefined()
      expect(i.maxLarghezzaEtichetta!).toBeLessThanOrEqual(196)
    }
  })

  it('è deterministico: due chiamate producono scene identiche', () => {
    const a = composeMultiProdotto({ proposal, fotoPerGruppo })
    const b = composeMultiProdotto({ proposal, fotoPerGruppo })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('corrisponde al golden committato', () => {
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    const goldenPath = 'tests/fixtures/scene-5926962.json'
    if (!existsSync(goldenPath)) return // il golden viene generato allo Step 4
    expect(JSON.stringify(scene, null, 2) + '\n').toBe(readFileSync(goldenPath, 'utf8'))
  })
})

// notaTecnica reale del set giardino (SKU 2188908, caso sporco: badge "Portata massima ... Kg",
// non "Capacità ... L"; vedi tests/dimensions.test.ts) già passata per parseSetDimensions: qui
// costruiamo direttamente la SchedaProposal risultante (Piano B — solo estrazione cambia, il
// template multi-prodotto di Piano A resta invariato e non sa da dove arrivano i sottoProdotti).
const proposalGiardino: SchedaProposal = {
  sku: '2188908',
  categoria: 'giardino',
  features: [
    { chiave: 'materiale_alluminio', etichetta: 'Alluminio', valore: null, verificata: true, priorita: 90, badge: false },
    { chiave: 'cuscini_sfoderabili', etichetta: 'Cuscini sfoderabili', valore: null, verificata: true, priorita: 80, badge: false },
    { chiave: 'lavabile_a_mano', etichetta: 'Lavabile a mano', valore: null, verificata: false, priorita: 70, badge: false },
    { chiave: 'facile_assemblaggio', etichetta: 'Facile da assemblare', valore: null, verificata: false, priorita: 60, badge: false },
  ],
  badges: [],
  dimensioni: null,
  sottoProdotti: [
    {
      gruppo: 'g0',
      etichetta: 'poltroncine',
      dimensioni: { larghezza: 75, profondita: 85, altezza: 86 },
      badges: [{ chiave: 'portata', etichetta: '150 Kg', valore: '150', verificata: true, priorita: 0, badge: true }],
    },
    {
      gruppo: 'g1',
      etichetta: 'divanetto',
      dimensioni: { larghezza: 140, profondita: 85, altezza: 86 },
      badges: [{ chiave: 'portata', etichetta: '300 Kg', valore: '300', verificata: true, priorita: 0, badge: true }],
    },
    {
      gruppo: 'g2',
      etichetta: 'tavolinetto',
      dimensioni: { larghezza: 110, profondita: 64.5, altezza: 40.5 },
      badges: [{ chiave: 'portata', etichetta: '50 Kg', valore: '50', verificata: true, priorita: 0, badge: true }],
    },
  ],
}

const fotoPerGruppoGiardino = [
  { gruppo: 'g0', imageHash: 'hash-g0', bbox: { width: 75, height: 86 } },
  { gruppo: 'g1', imageHash: 'hash-g1', bbox: { width: 140, height: 86 } },
  { gruppo: 'g2', imageHash: 'hash-g2', bbox: { width: 110, height: 40.5 } },
]

describe('composeMultiProdotto — set giardino 2188908 (caso sporco, badge portata)', () => {
  it('produce una scena valida con canvas 1000×1000 e templateId corretto', () => {
    const scene = composeMultiProdotto({ proposal: proposalGiardino, fotoPerGruppo: fotoPerGruppoGiardino })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe(TEMPLATE_ID)
    expect(scene.canvas).toEqual(CANVAS)
    expect(scene.sku).toBe('2188908')
  })

  it('crea 3 celle (foto/quote/badge di portata) per gruppo', () => {
    const scene = composeMultiProdotto({ proposal: proposalGiardino, fotoPerGruppo: fotoPerGruppoGiardino })
    const per = (t: string) => scene.elements.filter((e) => e.type === t)

    const foto = per('foto')
    expect(foto).toHaveLength(3)
    expect(foto.map((f) => (f as { gruppo?: string }).gruppo)).toEqual(['g0', 'g1', 'g2'])

    const quote = per('quota')
    expect(quote).toHaveLength(9) // 3 dimensioni × 3 gruppi

    const badge = per('badge')
    expect(badge).toHaveLength(3) // una portata per pezzo
    expect(badge.map((b) => (b as { testo?: string }).testo)).toEqual(['150 Kg', '300 Kg', '50 Kg'])
  })

  it('è deterministico: due chiamate producono scene identiche', () => {
    const a = composeMultiProdotto({ proposal: proposalGiardino, fotoPerGruppo: fotoPerGruppoGiardino })
    const b = composeMultiProdotto({ proposal: proposalGiardino, fotoPerGruppo: fotoPerGruppoGiardino })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('corrisponde al golden committato', () => {
    const scene = composeMultiProdotto({ proposal: proposalGiardino, fotoPerGruppo: fotoPerGruppoGiardino })
    const goldenPath = 'tests/fixtures/scene-2188908.json'
    if (!existsSync(goldenPath)) return // il golden viene generato allo Step 1/3 del Task 2
    expect(JSON.stringify(scene, null, 2) + '\n').toBe(readFileSync(goldenPath, 'utf8'))
  })
})
