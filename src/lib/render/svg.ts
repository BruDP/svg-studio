import type { Scene, SceneElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'

export type IconResolver = (chiave: string) => string | null
export type ImageResolver = (imageHash: string) => string | null

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
      const label = `<text x="${el.x + r * 2 + theme.margini.labelGap}" y="${cy + theme.testo.etichetta / 3}" font-family="${theme.fontFamily}" font-size="${theme.testo.etichetta}" fill="${theme.colors.testo}">${esc(el.etichetta)}</text>`
      return cerchio + glifo + label
    }
    case 'foto': {
      const href = deps.image(el.imageHash)
      if (!href) {
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#EEEEEE"/>`
      }
      return `<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`
    }
    case 'quota': {
      const linea = `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${theme.colors.freccia}" stroke-width="${theme.freccia.stroke}"/>`
      const mx = (el.x1 + el.x2) / 2
      const my = (el.y1 + el.y2) / 2
      const etichetta = `<text x="${mx}" y="${my}" font-family="${theme.fontFamily}" font-size="${theme.testo.etichetta}" fill="${theme.colors.freccia}">${esc(el.valore)}</text>`
      return linea + etichetta
    }
    case 'badge': {
      const w = 8 * el.testo.length + 40
      const h = 52
      const rect = `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" rx="10" fill="${theme.colors.badgeBg}"/>`
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
