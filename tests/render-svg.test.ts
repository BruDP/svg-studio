import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { renderScene } from '@/lib/render/svg'
import { parseScene } from '@/lib/scene/schema'
import { theme } from '@/lib/theme'

const scene = parseScene(JSON.parse(readFileSync('tests/fixtures/scene-2137070.json', 'utf8')))

const deps = {
  icon: (k: string) => (k === 'materiale_acciaio' ? '<path d="M2 2h20"/>' : null),
  image: (h: string) => (h === 'abc123' ? 'data:image/png;base64,AAAA' : null),
}

describe('renderScene', () => {
  it('produce un SVG con le dimensioni del canvas', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg).toMatch(/width="1000"/)
    expect(svg).toMatch(/height="1000"/)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('design clean: niente cuore Satur, tela bianca, nessuna ombra/tile sulla foto', () => {
    const svg = renderScene(scene, deps)
    expect(svg).not.toContain('satur-cuore') // il cuore multicolore è stato rimosso
    expect(svg).toContain(`fill="${theme.colors.sfondo}"`) // fondo bianco
    expect(svg).not.toMatch(/opacity="0\.10"/) // niente ombra flat
    expect(svg).not.toMatch(/clip-path="url\(#foto-/) // foto posata direttamente su bianco
  })

  it('eyebrow marchio: disegna il LOGO se il resolver immagini lo fornisce (chiave logo:<slug>)', () => {
    const s = parseScene({
      version: 1,
      sku: 'TEST',
      templateId: 'colonna-sinistra',
      canvas: { width: 1000, height: 1000 },
      elements: [{ type: 'testo', id: 'eyebrow', testo: 'Kooper', x: 60, y: 100, ruolo: 'sottotitolo' }],
    })
    const conLogo = renderScene(s, {
      icon: () => null,
      image: (k) => (k === 'logo:kooper' ? 'data:image/png;base64,AAAA' : null),
    })
    expect(conLogo).toContain('href="data:image/png;base64,AAAA"')
    expect(conLogo).not.toContain('>Kooper</text>') // niente wordmark quando c'è il logo
  })

  it('eyebrow marchio: ripiego al wordmark (display pulito) se manca il file logo', () => {
    const s = parseScene({
      version: 1,
      sku: 'TEST',
      templateId: 'colonna-sinistra',
      canvas: { width: 1000, height: 1000 },
      elements: [{ type: 'testo', id: 'eyebrow', testo: 'Villa d Este Home Tivoli', x: 60, y: 100, ruolo: 'sottotitolo' }],
    })
    const svg = renderScene(s, deps) // deps.image ritorna null per la chiave logo
    expect(svg).toContain("Villa d'Este</text>") // wordmark con display normalizzato
    expect(svg).not.toContain('logo:') // nessun riferimento a chiave logo nel markup
  })

  it('inserisce il glifo dell\'icona risolta (senza disco), etichetta anche per quella mancante', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('M2 2h20') // glifo icona risolta
    expect(svg).not.toMatch(/<circle/) // design clean: niente disco/chip attorno all'icona
    // l'icona mancante (montaggio_facile) non ha glifo ma l'etichetta è comunque presente
    expect(svg).toContain('Montaggio facile')
  })

  it('incorpora la foto come data URI', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('data:image/png;base64,AAAA')
  })

  it('usa i token di theme (colore testo) e nessun colore hard-coded diverso', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('#1D1D1F') // theme.colors.testo (inchiostro quasi-nero, design clean)
  })

  it('è deterministico: due render sono byte-identici', () => {
    expect(renderScene(scene, deps)).toBe(renderScene(scene, deps))
  })

  it('corrisponde al golden committato', () => {
    const goldenPath = 'tests/fixtures/render-2137070.svg'
    if (!existsSync(goldenPath)) return // generato allo Step 5
    expect(renderScene(scene, deps)).toBe(readFileSync(goldenPath, 'utf8'))
  })

  it('badge: la larghezza del box accomoda il testo lungo (nessun taglio)', () => {
    const badgeScene = parseScene({
      version: 1,
      sku: 'TEST',
      templateId: 'colonna-sinistra',
      canvas: { width: 1000, height: 1000 },
      elements: [{ type: 'badge', id: 'b1', testo: '7000 BTU', x: 100, y: 100 }],
    })
    const svg = renderScene(badgeScene, deps)
    // Badge design clean = pill neutra (<rect> con rx = metà altezza). La larghezza deve contenere
    // il testo "7000 BTU" (il testo è centrato in x+w/2).
    const m = svg.match(/<rect x="100" y="100" width="(\d+)" height="(\d+)" rx="[\d.]+" fill="[^"]*"\/>/)
    expect(m).not.toBeNull()
    const w = Number(m![1])
    expect(w).toBeGreaterThanOrEqual(110) // testo "7000 BTU" (8 char) a badge 26 ≈ 108 + padding
  })

  it('etichetta corta: resta un unico <text>, nessun <tspan> (nessuna regressione)', () => {
    const svg = renderScene(scene, deps)
    // "Acciaio" e "Montaggio facile" nel golden sono corte: non devono generare tspan.
    expect(svg).not.toContain('<tspan')
  })

  it('quota "premium" produce i trattini perpendicolari agli estremi, oltre alla linea principale', () => {
    const quotaScene = parseScene({
      version: 1,
      sku: 'TEST',
      // templateId senza pannello (il pannello colonna-sinistra aggiungerebbe l'hairline <line>):
      // così contiamo solo le linee della quota.
      templateId: 'multi-prodotto',
      canvas: { width: 1000, height: 1000 },
      elements: [
        { type: 'quota', id: 'q1', orientamento: 'verticale', valore: '10 cm', x1: 100, y1: 100, x2: 100, y2: 200 },
      ],
    })
    const svg = renderScene(quotaScene, deps)
    const linee = [...svg.matchAll(/<line/g)]
    // linea principale + 2 trattini (tick) agli estremi = 3
    expect(linee.length).toBe(3)
  })

  it('etichetta troppo lunga per la colonna va a capo su piu righe (tspan) invece di essere coperta dalla foto', () => {
    const sceneLunga = {
      ...scene,
      elements: scene.elements.map((el) =>
        el.type === 'icona-label' ? { ...el, etichetta: 'Dotato di 10 ruote per lo spostamento rapido' } : el,
      ),
    }
    const svg = renderScene(sceneLunga, deps)
    expect(svg).toContain('<tspan')
    // ogni riga (tspan) deve restare sotto la larghezza massima di colonna: nessuna riga
    // supera i ~21 caratteri (theme.margini.labelMaxLarghezza / (fontSize * rapporto calibrato)).
    const righe = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1])
    expect(righe.length).toBeGreaterThan(1)
    for (const riga of righe) {
      expect(riga.replace('…', '').length).toBeLessThanOrEqual(22)
    }
    // il testo intero deve restare presente (nessuna parola persa), a parte l'eventuale ellissi.
    expect(righe.join(' ').replace('…', '')).toContain('Dotato')
  })

  it('elemento testo nascosto (titolo/eyebrow) non produce alcun <text>', () => {
    const testoNascosto = {
      ...scene,
      elements: [
        { type: 'testo' as const, id: 't1', ruolo: 'titolo' as const, testo: 'Titolo nascosto', x: 60, y: 80, nascosto: true },
      ],
    }
    expect(renderScene(testoNascosto, deps)).not.toContain('Titolo nascosto')
  })

  it('badge nascosto non produce alcun <rect>/<text> del badge', () => {
    const badgeNascosto = {
      ...scene,
      elements: [{ type: 'badge' as const, id: 'bg1', testo: '515 L', x: 480, y: 700, nascosto: true }],
    }
    expect(renderScene(badgeNascosto, deps)).not.toContain('515 L')
  })

  it('titolo troppo lungo per 2 righe: l\'ellissi arretra al confine di parola (nessun taglio a metà parola)', () => {
    // Caso reale dal feed (descrizioneBreve concatenata senza spazio): senza il fix l'ultima riga
    // tagliava dentro una parola ("...verdeIl set s…", "...dondolo co…").
    const titoloScene = {
      ...scene,
      elements: [
        { type: 'testo' as const, id: 't1', ruolo: 'titolo' as const, testo: 'Babbo Natale con cavallo a dondolo con 40 luci Led effetto innevato in magnesia', x: 60, y: 80 },
      ],
    }
    const svg = renderScene(titoloScene, deps)
    const righe = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1])
    expect(righe.length).toBeGreaterThanOrEqual(2)
    const ultima = righe[righe.length - 1]
    expect(ultima.endsWith('…')).toBe(true)
    // il carattere subito prima dell'ellissi deve essere l'inizio di una parola intera:
    // cioè il testo (ellissi esclusa) non deve essere un prefisso proprio di una parola più lunga del titolo.
    const contenuto = ultima.replace('…', '')
    const ultimaParola = contenuto.trim().split(' ').pop()!
    const paroleOriginali = titoloScene.elements[0].testo.split(' ')
    expect(paroleOriginali.some((p) => p === ultimaParola)).toBe(true) // parola intera, non spezzata
  })
})
