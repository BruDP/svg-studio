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
      const size = el.ruolo === 'titolo' ? theme.testo.titolo : theme.testo.etichetta
      const weight = el.ruolo === 'titolo' ? 600 : 400
      return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${theme.colors.testo}">${esc(el.testo)}</text>`
    }
    case 'icona-label': {
      const r = theme.icona.raggio
      const cx = el.x + r
      const cy = el.y + r
      const inner = deps.icon(el.chiave)
      const cerchio = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.colors.cerchioStroke}" stroke-width="${theme.icona.stroke}"/>`
      // glifo 24×24 scalato e centrato nel cerchio
      const lato = theme.icona.iconaLato
      const scala = lato / 24
      const gx = cx - lato / 2
      const gy = cy - lato / 2
      const glifo = inner
        ? `<g transform="translate(${gx} ${gy}) scale(${scala})" fill="none" stroke="${theme.colors.cerchioStroke}" stroke-width="${theme.icona.stroke / scala}">${inner}</g>`
        : ''
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
      if (el.orientamento === 'verticale') {
        lx = Math.max(x1, x2) + gap
        ly = my + fs / 3
        anchor = 'start'
      } else if (el.orientamento === 'orizzontale') {
        lx = mx
        ly = Math.max(y1, y2) + gap + fs
        anchor = 'middle'
      } else {
        lx = x2 + gap
        ly = y2 + fs / 3
        anchor = 'start'
      }
      const etichetta = `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="${theme.fontFamily}" font-size="${fs}" font-weight="500" fill="${theme.colors.accento}">${esc(el.valore)}</text>`
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
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.canvas.width}" height="${scene.canvas.height}" viewBox="0 0 ${scene.canvas.width} ${scene.canvas.height}">`,
    `  <rect width="${scene.canvas.width}" height="${scene.canvas.height}" fill="${theme.colors.sfondo}"/>`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join('\n')
}
