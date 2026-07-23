import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { composeColonnaSinistra, TEMPLATE_ID, CANVAS, fotoBoxHeight } from '@/lib/layout/colonna-sinistra'
import { parseScene } from '@/lib/scene/schema'
import { theme } from '@/lib/theme'
import type { SchedaProposal } from '@/lib/extraction/engine'

const proposal: SchedaProposal = {
  sku: '2137070',
  categoria: 'barbecue',
  features: [
    { chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false },
    { chiave: 'montaggio_facile', etichetta: 'Montaggio facile', valore: null, verificata: false, priorita: 30, badge: false },
  ],
  badges: [
    { chiave: 'capacita', etichetta: '99 L', valore: '99', verificata: true, priorita: 90, badge: true },
  ],
  dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 },
}

describe('composeColonnaSinistra', () => {
  it('produce una scena valida con canvas 1000×1000 e templateId corretto', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe(TEMPLATE_ID)
    expect(scene.canvas).toEqual(CANVAS)
    expect(scene.sku).toBe('2137070')
  })

  it('crea un icona-label per feature, un badge per badge, una foto, quote dalle dimensioni', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const per = (t: string) => scene.elements.filter((e) => e.type === t)
    expect(per('icona-label')).toHaveLength(2)
    expect(per('badge')).toHaveLength(1)
    expect(per('foto')).toHaveLength(1)
    expect(per('quota')).toHaveLength(3) // larghezza+profondita+altezza
    expect(per('testo')).toHaveLength(0) // senza `nome` in input: nessuna intestazione
  })

  it('preserva l\'ordine del ranking nelle icone in colonna', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const labels = scene.elements.filter((e) => e.type === 'icona-label').map((e) => (e as { chiave: string }).chiave)
    expect(labels).toEqual(['materiale_acciaio', 'montaggio_facile'])
  })

  it('centra verticalmente la colonna di poche feature (blocco non incollato in alto)', () => {
    // proposal ha 2 feature: con la centratura il blocco sta nella metà bassa del pannello,
    // NON attaccato a iconStartY in alto → spazio bianco simmetrico. La prima icona deve stare
    // ben sotto l'inizio-zona (che senza header è 160): prova che l'offset di centratura è attivo.
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const icone = scene.elements.filter((e) => e.type === 'icona-label') as { y: number }[]
    expect(icone).toHaveLength(2)
    expect(icone[0].y).toBeGreaterThan(300) // centrato, non a ridosso di iconStartY=160
    // il baricentro del blocco è vicino al centro del pannello (≈ (160+940)/2 = 550)
    const centroBlocco = (icone[0].y + icone[1].y) / 2 + 30 // +raggio per il centro del chip
    expect(Math.abs(centroBlocco - 550)).toBeLessThan(60)
  })

  it('è deterministico: due chiamate producono scene identiche', () => {
    const a = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const b = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('con nome+marchio genera l\'intestazione editoriale e sposta più in basso le icone', () => {
    const scene = composeColonnaSinistra({
      proposal,
      imageHash: 'abc123',
      bbox: { width: 200, height: 200 },
      nome: 'Barbecue tondo rosso con ruote Ø51xh.84,5 cm, BestBQ',
      marchio: 'BestBQ',
    })
    const testi = scene.elements.filter((e) => e.type === 'testo') as { ruolo?: string; testo: string; y: number }[]
    const eyebrow = testi.find((t) => t.ruolo === 'sottotitolo')
    const titolo = testi.find((t) => t.ruolo === 'titolo')
    expect(eyebrow?.testo).toBe('BestBQ')
    expect(titolo?.testo).toBe('Barbecue tondo rosso con ruote') // estraiTitolo: niente troncamento su virgola decimale

    const primaIcona = scene.elements.find((e) => e.type === 'icona-label') as { y: number }
    const senzaHeader = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const primaIconaSenzaHeader = senzaHeader.elements.find((e) => e.type === 'icona-label') as { y: number }
    expect(primaIcona.y).toBeGreaterThan(primaIconaSenzaHeader.y) // spazio riservato all'intestazione
  })

  it('bounds: la quota altezza e i badge non escono MAI dal canvas, con 0..3 badge', () => {
    // Lezione della review multi-prodotto (overflow quote ultima cella, 2026-07-15): i golden
    // byte-identici non validano i limiti del canvas — serve un test di bounds esplicito che
    // replichi il worst-case reale (etichetta altezza più lunga plausibile, foto che riempie
    // interamente il riquadro in entrambe le direzioni).
    const larghezzaStimata = (t: string, fs: number) => t.length * fs * theme.testo.larghezzaCarattereEm
    for (let nBadge = 0; nBadge <= 3; nBadge++) {
      const p: SchedaProposal = {
        ...proposal,
        badges: Array.from({ length: nBadge }, (_, i) => ({
          chiave: `b${i}`, etichetta: `Badge ${i}`, valore: '1', verificata: true, priorita: 90, badge: true,
        })),
        dimensioni: { larghezza: 90, profondita: null, altezza: 300.5 }, // "300,5 cm": 8 char, worst-case plausibile
      }

      // Caso 1: bbox width-bound (fitted.width = larghezza piena del riquadro) → stress sul margine destro.
      const sceneLarga = composeColonnaSinistra({ proposal: p, imageHash: 'h', bbox: { width: 427, height: 1 } })
      const quotaV = sceneLarga.elements.find((e) => e.type === 'quota' && e.orientamento === 'verticale') as
        | { x1: number; x2: number; valore: string }
        | undefined
      if (quotaV) {
        const rightEdge = Math.max(quotaV.x1, quotaV.x2) + theme.freccia.labelGap + larghezzaStimata(quotaV.valore, theme.testo.quota)
        expect(rightEdge).toBeLessThanOrEqual(CANVAS.width)
      }

      // Caso 2: bbox height-bound (fitted.height = altezza piena del riquadro) → stress sul bordo basso (badge).
      const h = fotoBoxHeight(nBadge, CANVAS.height)
      const sceneAlta = composeColonnaSinistra({ proposal: p, imageHash: 'h', bbox: { width: 1, height: h } })
      const badges = sceneAlta.elements.filter((e) => e.type === 'badge') as { y: number }[]
      for (const b of badges) {
        expect(b.y + theme.badge.altezza).toBeLessThanOrEqual(CANVAS.height)
      }
    }
  })

  it('corrisponde al golden committato', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const goldenPath = 'tests/fixtures/scene-2137070.json'
    if (!existsSync(goldenPath)) return // il golden viene generato allo Step 5
    expect(JSON.stringify(scene, null, 2) + '\n').toBe(readFileSync(goldenPath, 'utf8'))
  })
})
