import type { Scene, SceneElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { mescola } from './colore'
import { chiaveLogo, marchioInfo } from '@/lib/branding/marchio'

export type IconResolver = (chiave: string) => string | null
export type ImageResolver = (imageHash: string) => string | null

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function larghezzaStimata(testo: string, fontSize: number): number {
  return testo.length * fontSize * theme.testo.larghezzaCarattereEm
}

/**
 * Spezza un'etichetta troppo lunga su piu' righe (word-wrap greedy) in modo che non superi
 * maxWidth e non venga coperta dalla foto (disegnata dopo, quindi sopra, nello z-order SVG).
 * Oltre maxRighe comprime il resto con un'ellissi: difesa in profondita' per testo patologico.
 */
function spezzaEtichetta(testo: string, maxWidth: number, fontSize: number, maxRighe = 2): string[] {
  const parole = testo.split(' ')
  const righe: string[] = []
  let corrente = ''
  for (const parola of parole) {
    const prova = corrente ? `${corrente} ${parola}` : parola
    if (corrente && larghezzaStimata(prova, fontSize) > maxWidth) {
      righe.push(corrente)
      corrente = parola
    } else {
      corrente = prova
    }
  }
  if (corrente) righe.push(corrente)
  if (righe.length <= maxRighe) return righe

  const tenute = righe.slice(0, maxRighe - 1)
  let restante = righe.slice(maxRighe - 1).join(' ')
  while (restante.length > 1 && larghezzaStimata(`${restante}…`, fontSize) > maxWidth) {
    restante = restante.slice(0, -1)
  }
  // Arretra fino all'ultimo spazio per non tagliare a metà parola (es. "…co" da "compone"),
  // a meno che non resti un'unica parola più lunga della riga: lì il taglio a carattere è l'unica opzione.
  const ultimoSpazio = restante.lastIndexOf(' ')
  if (ultimoSpazio > 0) restante = restante.slice(0, ultimoSpazio)
  tenute.push(`${restante}…`)
  return tenute
}

function renderElement(el: SceneElement, deps: { icon: IconResolver; image: ImageResolver }, accento: string): string {
  switch (el.type) {
    case 'testo': {
      if (el.nascosto) return ''
      if (el.ruolo === 'sottotitolo') {
        // Eyebrow = marchio prodotto. Se esiste il file logo (bundle → imageMap chiave `logo:<slug>`)
        // si disegna il LOGO reale, ancorato a sinistra in un box ad altezza fissa (proporzioni
        // preservate). Altrimenti si disegna il wordmark del marchio (nome pulito, inchiostro,
        // stondato) come ripiego dignitoso — vedi assets/loghi/README.md.
        const logoHref = deps.image(chiaveLogo(el.testo))
        if (logoHref) {
          const hLogo = theme.testo.logoAltezza
          const wBox = theme.margini.titoloMaxLarghezza // stesso limite sinistro del titolo
          return `<image x="${el.x}" y="${el.y}" width="${wBox}" height="${hLogo}" href="${logoHref}" preserveAspectRatio="xMinYMid meet"/>`
        }
        const size = theme.testo.eyebrow
        const { display } = marchioInfo(el.testo)
        return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="600" letter-spacing="0.3" fill="${theme.colors.testo}">${esc(display)}</text>`
      }
      if (el.ruolo === 'titolo') {
        // Nome prodotto: SemiBold, inchiostro, a capo su max 2 righe entro la colonna sinistra.
        const size = theme.testo.titolo
        const lineH = size * theme.testo.interlinea
        const righe = spezzaEtichetta(el.testo, theme.margini.titoloMaxLarghezza, size, 2)
        const tspans = righe
          .map((r, i) => `<tspan x="${el.x}" y="${el.y + size + i * lineH}">${esc(r)}</tspan>`)
          .join('')
        return `<text font-family="${theme.fontFamily}" font-size="${size}" font-weight="600" fill="${theme.colors.testo}">${tspans}</text>`
      }
      const size = theme.testo.etichetta
      return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="400" fill="${theme.colors.testo}">${esc(el.testo)}</text>`
    }
    case 'icona-label': {
      const r = theme.icona.raggio
      const cx = el.x + r
      const cy = el.y + r
      const inner = deps.icon(el.chiave)
      // Chip: disco a tinta tenue + anello sottile (look "premium" invece del cerchio a filo).
      // Tinte derivate dall'accento "di famiglia" della scheda (categoria), non fisse: ogni
      // reparto ha il suo chip in tono, stessa struttura per tutte le schede.
      const chipBg = mescola(accento, theme.colors.sfondo, 0.1)
      const chipRing = mescola(accento, theme.colors.sfondo, 0.22)
      const chip =
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${chipBg}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r - 0.75}" fill="none" stroke="${chipRing}" stroke-width="1.5"/>`
      // glifo 24×24 scalato e centrato nel chip, tratti arrotondati
      const lato = theme.icona.iconaLato
      const scala = lato / 24
      const gx = cx - lato / 2
      const gy = cy - lato / 2
      const glifo = inner
        ? `<g transform="translate(${gx} ${gy}) scale(${scala})" fill="none" stroke="${accento}" stroke-width="${theme.icona.stroke / scala}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
        : ''
      const cerchio = chip // (nome storico usato sotto)
      const labelX = el.x + r * 2 + theme.margini.labelGap
      const fontSize = theme.testo.etichetta
      const maxLarghezza = el.maxLarghezzaEtichetta ?? theme.margini.labelMaxLarghezza
      const righe = spezzaEtichetta(el.etichetta, maxLarghezza, fontSize)
      const label =
        righe.length <= 1
          ? `<text x="${labelX}" y="${cy + fontSize / 3}" font-family="${theme.fontFamily}" font-size="${fontSize}" fill="${theme.colors.testo}">${esc(el.etichetta)}</text>`
          : (() => {
              const lineHeight = fontSize * theme.testo.interlinea
              const firstY = cy + fontSize / 3 - ((righe.length - 1) * lineHeight) / 2
              const tspans = righe
                .map((riga, i) => `<tspan x="${labelX}" y="${firstY + i * lineHeight}">${esc(riga)}</tspan>`)
                .join('')
              return `<text font-family="${theme.fontFamily}" font-size="${fontSize}" fill="${theme.colors.testo}">${tspans}</text>`
            })()
      return cerchio + glifo + label
    }
    case 'foto': {
      // Il prodotto diventa un "tile" fotografico: angoli arrotondati (clip) + ombra flat sotto,
      // così si stacca dal fondo crema con profondità invece di galleggiare piatto. Ombra a tinta
      // unita offset (niente blur: resvg non lo rende affidabile, e lo stile flat è coerente con
      // l'illustrazione di riferimento). Il ritaglio ha lo stesso aspect del prodotto (fitFoto),
      // quindi arrotonda gli angoli della foto, non introduce margini.
      const { x, y, width: w, height: hh } = el
      const rx = theme.foto.raggio
      const clipId = `foto-${el.id}`
      const ombra = `<rect x="${x}" y="${y + theme.foto.ombraOffset}" width="${w}" height="${hh}" rx="${rx}" fill="${theme.colors.testo}" opacity="0.10"/>`
      const clip = `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${rx}"/></clipPath>`
      const href = deps.image(el.imageHash)
      const contenuto = href
        ? `<image x="${x}" y="${y}" width="${w}" height="${hh}" href="${href}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${rx}" fill="${theme.colors.fotoPlaceholder}"/>`
      return ombra + clip + contenuto
    }
    case 'quota': {
      // Quota nascosta (toggle profondità): resta nella scena ma non si disegna.
      if (el.nascosta) return ''
      // Linea di quota "da disegno tecnico": grigio neutro (theme.colors.quota, NON l'accento di
      // reparto — su Kooper le rette risultavano rosse/bordeaux, sgradite), con trattini
      // perpendicolari agli estremi ed etichetta (numero) accostata alla linea, in corpo piccolo
      // (le misure sono info di supporto, non devono competere con titolo/feature).
      const { x1, y1, x2, y2 } = el
      const col = theme.colors.quota
      const sw = theme.freccia.stroke
      const t = theme.freccia.tick
      const fs = theme.testo.quota
      const gap = theme.freccia.labelGap
      const len = Math.hypot(x2 - x1, y2 - y1) || 1
      const px = (-(y2 - y1) / len) * t // perpendicolare unitaria × t
      const py = ((x2 - x1) / len) * t
      const linea = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`
      const tick = (x: number, y: number) =>
        `<line x1="${x - px}" y1="${y - py}" x2="${x + px}" y2="${y + py}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`
      const ticks = tick(x1, y1) + tick(x2, y2)
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      let lx = mx
      let ly = my
      let anchor = 'middle'
      let ruota = '' // verticale resta orizzontale (come nelle schede di riferimento); orizzontale e diagonale seguono l'inclinazione della linea
      if (el.orientamento === 'verticale') {
        lx = Math.max(x1, x2) + gap
        ly = my + fs / 3
        anchor = 'start'
      } else if (el.orientamento === 'orizzontale') {
        lx = mx
        ly = my + gap + fs
        anchor = 'middle'
        const angoloOrizz = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
        ruota = ` transform="rotate(${angoloOrizz} ${lx} ${ly})"`
      } else {
        // Diagonale (profondità): etichetta centrata sotto il punto medio, ruotata lungo la linea
        // ma normalizzata a [-90,90] così resta sempre dritta e leggibile anche quando la linea
        // punta verso sinistra (x2 < x1).
        const grezzo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
        const angolo = grezzo > 90 ? grezzo - 180 : grezzo < -90 ? grezzo + 180 : grezzo
        lx = mx
        ly = my + gap + fs / 2
        anchor = 'middle'
        ruota = ` transform="rotate(${angolo} ${lx} ${ly})"`
      }
      const etichetta = `<text x="${lx}" y="${ly}" text-anchor="${anchor}"${ruota} font-family="${theme.fontFamily}" font-size="${fs}" font-weight="500" fill="${col}">${esc(el.valore)}</text>`
      return linea + ticks + etichetta
    }
    case 'badge': {
      if (el.nascosto) return ''
      // Larghezza dal testo reale (ratio Poppins calibrato) + padding, così badge lunghi
      // come "7000 BTU" non vengono tagliati dal box (il testo è centrato in x+w/2).
      const w = Math.ceil(larghezzaStimata(el.testo, theme.testo.badge)) + theme.badge.paddingX * 2
      const h = theme.badge.altezza
      // Forma a "cartellino prezzo" (nastro con punta a sinistra), non un rettangolo arrotondato:
      // riprende il motivo dei price-tag reali Satur (Brand Book, sezione "Le applicazioni").
      const notch = theme.badge.notch
      const { x, y } = el
      const percorso =
        `M ${x + notch} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x + notch} ${y + h} L ${x} ${y + h / 2} Z`
      const forma = `<path d="${percorso}" fill="${accento}"/>`
      const t = `<text x="${x + notch + (w - notch) / 2}" y="${y + h / 2 + theme.testo.badge / 3}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.testo.badge}" font-weight="600" fill="${theme.colors.badgeTesto}">${esc(el.testo)}</text>`
      return forma + t
    }
  }
}

/**
 * Cuore Satur sfaccettato — ricostruzione fedele del marchio dal Brand Book 2025: silhouette di
 * cuore riempita da un pinwheel di triangoli, con la palette multicolore FISSA del logo (NON
 * l'accento di reparto della scheda: il logo del marchio è invariante). Colori campionati a livello
 * di pixel dal brand book. `ox,oy` = angolo alto-sinistra del box del cuore, `s` = lato (px).
 */
function cuoreSatur(ox: number, oy: number, s: number): string {
  const k = s / 100
  const X = (px: number) => +(ox + px * k).toFixed(2)
  const Y = (py: number) => +(oy + py * k).toFixed(2)
  const heart =
    `M${X(50)},${Y(90)} ` +
    `C${X(20)},${Y(66)} ${X(2)},${Y(50)} ${X(2)},${Y(32)} ` +
    `C${X(2)},${Y(14)} ${X(24)},${Y(6)} ${X(38)},${Y(18)} ` +
    `C${X(44)},${Y(23)} ${X(48)},${Y(28)} ${X(50)},${Y(30)} ` +
    `C${X(52)},${Y(28)} ${X(56)},${Y(23)} ${X(62)},${Y(18)} ` +
    `C${X(76)},${Y(6)} ${X(98)},${Y(14)} ${X(98)},${Y(32)} ` +
    `C${X(98)},${Y(50)} ${X(80)},${Y(66)} ${X(50)},${Y(90)} Z`
  // 4×4 celle, ogni cella = 2 triangoli (diagonale alternata a scacchiera) → pinwheel sfaccettato.
  const celle: string[][][] = [
    [['#6DBE4B', '#8E857B'], ['#B1A99F', '#1B3C6E'], ['#1099A9', '#12739A'], ['#39A0AF', '#1099A9']],
    [['#82BF6D', '#94CC75'], ['#6A81A7', '#1B3C6E'], ['#60AAC3', '#28AFC7'], ['#8B919B', '#7C2530']],
    [['#94CC75', '#ABA5C4'], ['#604775', '#953B81'], ['#5B89B5', '#953B81'], ['#EF1B2B', '#85373B']],
    [['#ABA5C4', '#A7799D'], ['#A7779C', '#604775'], ['#F04F23', '#EF1B2B'], ['#FCD106', '#F13C38']],
  ]
  const gx0 = 4, gy0 = 4, cw = 23, ch = 21.5
  let tri = ''
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x0 = gx0 + c * cw, y0 = gy0 + r * ch, x1 = x0 + cw, y1 = y0 + ch
      const [a, b] = celle[r][c]
      if ((r + c) % 2 === 0) {
        tri += `<polygon points="${X(x0)},${Y(y0)} ${X(x1)},${Y(y0)} ${X(x1)},${Y(y1)}" fill="${a}"/>`
        tri += `<polygon points="${X(x0)},${Y(y0)} ${X(x0)},${Y(y1)} ${X(x1)},${Y(y1)}" fill="${b}"/>`
      } else {
        tri += `<polygon points="${X(x0)},${Y(y0)} ${X(x1)},${Y(y0)} ${X(x0)},${Y(y1)}" fill="${a}"/>`
        tri += `<polygon points="${X(x1)},${Y(y0)} ${X(x1)},${Y(y1)} ${X(x0)},${Y(y1)}" fill="${b}"/>`
      }
    }
  }
  return `<clipPath id="satur-cuore"><path d="${heart}"/></clipPath><g clip-path="url(#satur-cuore)">${tri}</g>`
}

/**
 * Lockup del marchio Satur (cuore + wordmark "satur" + payoff), ancorato in alto a sinistra: è
 * la firma "chi ha fatto questa scheda" — presente su ogni scheda, indipendente dalla categoria.
 * Il wordmark reale usa il font "run" (non licenziato qui): Poppins minuscolo ne è il sostituto
 * più vicino, coerente col resto della scheda.
 */
function logoSatur(): string {
  const s = 40
  const ox = theme.margini.colonnaX
  const oy = 34
  const cuore = cuoreSatur(ox, oy, s)
  const wx = ox + s + 12
  const wm = `<text x="${wx}" y="${oy + s * 0.72}" font-family="${theme.fontFamily}" font-size="${s * 0.84}" font-weight="600" fill="${theme.colors.testo}">satur</text>`
  const payoff = `<text x="${wx + 2}" y="${oy + s + 3}" font-family="${theme.fontFamily}" font-size="${s * 0.2}" font-weight="600" letter-spacing="2.5" fill="${theme.colors.testoMuto}">PASSIONE CASA</text>`
  return cuore + wm + payoff
}

export function renderScene(scene: Scene, deps: { icon: IconResolver; image: ImageResolver }): string {
  // Accento "di famiglia": quello risolto al compose per la categoria del prodotto (scene.accento),
  // con fallback sul teal di default per scene salvate prima di questo campo. Un solo valore per
  // l'intera scheda: tutti gli elementi tinti (chip, quote, eyebrow, badge) restano in armonia.
  const accento = scene.accento ?? theme.colors.accento
  const body = scene.elements.map((el) => renderElement(el, deps, accento)).join('\n  ')
  const { width: w, height: h } = scene.canvas
  // Sfondo "spec sheet": off-white + pannello sinistro a tinta tenue (raggruppa la colonna
  // caratteristiche) con hairline di separazione dall'area foto. Solo per il template a colonna
  // singola (le celle multi-prodotto occupano tutta la larghezza; lì niente pannello).
  const conPannello = scene.templateId === 'colonna-sinistra'
  // Deve restare appena a sinistra di FOTO_BOX_X (colonna-sinistra.ts, 420): 412 lascia 8px di gap.
  const panelW = 412
  const sfondo =
    `<rect width="${w}" height="${h}" fill="${theme.colors.sfondo}"/>` +
    (conPannello
      ? `<rect x="0" y="0" width="${panelW}" height="${h}" fill="${theme.colors.sfondoAlt}"/>` +
        `<line x1="${panelW}" y1="0" x2="${panelW}" y2="${h}" stroke="${theme.colors.divisore}" stroke-width="1.5"/>`
      : '') +
    logoSatur()
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  ${sfondo}`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join('\n')
}
