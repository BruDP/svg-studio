import type { Scene, SceneElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'

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
  tenute.push(`${restante}…`)
  return tenute
}

function renderElement(el: SceneElement, deps: { icon: IconResolver; image: ImageResolver }): string {
  switch (el.type) {
    case 'testo': {
      if (el.ruolo === 'sottotitolo') {
        // Eyebrow: marchio in maiuscoletto spaziato, tinta accento — ancora editoriale sopra il titolo.
        const size = theme.testo.eyebrow
        return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="600" letter-spacing="2" fill="${theme.colors.accento}">${esc(el.testo.toUpperCase())}</text>`
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
      const chip =
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${theme.colors.iconaBg}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r - 0.75}" fill="none" stroke="${theme.colors.iconaRing}" stroke-width="1.5"/>`
      // glifo 24×24 scalato e centrato nel chip, tratti arrotondati
      const lato = theme.icona.iconaLato
      const scala = lato / 24
      const gx = cx - lato / 2
      const gy = cy - lato / 2
      const glifo = inner
        ? `<g transform="translate(${gx} ${gy}) scale(${scala})" fill="none" stroke="${theme.colors.iconaGlifo}" stroke-width="${theme.icona.stroke / scala}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
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
      const href = deps.image(el.imageHash)
      if (!href) {
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${theme.colors.fotoPlaceholder}"/>`
      }
      return `<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`
    }
    case 'quota': {
      // Quota nascosta (toggle profondità): resta nella scena ma non si disegna.
      if (el.nascosta) return ''
      // Linea di quota "premium": stessa cromia accento delle icone, con trattini
      // perpendicolari agli estremi (stile disegno tecnico) ed etichetta accostata alla
      // linea (non sopra), così l'estensione comunica esattamente la misura del prodotto.
      const { x1, y1, x2, y2 } = el
      const col = theme.colors.freccia
      const sw = theme.freccia.stroke
      const t = theme.freccia.tick
      const fs = theme.testo.etichetta
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
      const etichetta = `<text x="${lx}" y="${ly}" text-anchor="${anchor}"${ruota} font-family="${theme.fontFamily}" font-size="${fs}" font-weight="500" fill="${theme.colors.accento}">${esc(el.valore)}</text>`
      return linea + ticks + etichetta
    }
    case 'badge': {
      // Larghezza dal testo reale (ratio Poppins calibrato) + padding, così badge lunghi
      // come "7000 BTU" non vengono tagliati dal box (il testo è centrato in x+w/2).
      const w = Math.ceil(larghezzaStimata(el.testo, theme.testo.badge)) + theme.badge.paddingX * 2
      const h = theme.badge.altezza
      const rect = `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" rx="${theme.badge.raggio}" fill="${theme.colors.badgeBg}"/>`
      const t = `<text x="${el.x + w / 2}" y="${el.y + h / 2 + theme.testo.badge / 3}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.testo.badge}" font-weight="600" fill="${theme.colors.badgeTesto}">${esc(el.testo)}</text>`
      return rect + t
    }
  }
}

export function renderScene(scene: Scene, deps: { icon: IconResolver; image: ImageResolver }): string {
  const body = scene.elements.map((el) => renderElement(el, deps)).join('\n  ')
  const { width: w, height: h } = scene.canvas
  // Sfondo "spec sheet": off-white + pannello sinistro a tinta tenue (raggruppa la colonna
  // caratteristiche) con hairline di separazione dall'area foto. Solo per il template a colonna
  // singola (le celle multi-prodotto occupano tutta la larghezza; lì niente pannello).
  const conPannello = scene.templateId === 'colonna-sinistra'
  const panelW = 452
  const sfondo =
    `<rect width="${w}" height="${h}" fill="${theme.colors.sfondo}"/>` +
    (conPannello
      ? `<rect x="0" y="0" width="${panelW}" height="${h}" fill="${theme.colors.sfondoAlt}"/>` +
        `<line x1="${panelW}" y1="0" x2="${panelW}" y2="${h}" stroke="${theme.colors.divisore}" stroke-width="1.5"/>`
      : '')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  ${sfondo}`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join('\n')
}
