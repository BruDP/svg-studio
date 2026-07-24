import type { Scene, SceneElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
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

function renderElement(el: SceneElement, deps: { icon: IconResolver; image: ImageResolver }): string {
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
        // Tipografia "headline" Apple (skill apple-design §15): tracking negativo (~-0.02em) e
        // leading stretto per il corpo grande.
        const size = theme.testo.titolo
        const lineH = size * theme.testo.interlineaTitolo
        const righe = spezzaEtichetta(el.testo, theme.margini.titoloMaxLarghezza, size, 2)
        const tspans = righe
          .map((r, i) => `<tspan x="${el.x}" y="${el.y + size + i * lineH}">${esc(r)}</tspan>`)
          .join('')
        return `<text font-family="${theme.fontFamily}" font-size="${size}" font-weight="600" letter-spacing="-0.6" fill="${theme.colors.testo}">${tspans}</text>`
      }
      const size = theme.testo.etichetta
      return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="400" fill="${theme.colors.testo}">${esc(el.testo)}</text>`
    }
    case 'icona-label': {
      // Design clean: solo il GLIFO a tratto sottile monocromatico (niente disco colorato),
      // con l'etichetta accostata. L'icona occupa [el.x, el.x+lato] in orizzontale, centrata in
      // verticale su cy. Colore icona = inchiostro neutro (theme.colors.icona), NON l'accento.
      const r = theme.icona.raggio
      const cy = el.y + r
      const inner = deps.icon(el.chiave)
      const lato = theme.icona.iconaLato
      const scala = lato / 24
      const gx = el.x
      const gy = cy - lato / 2
      const glifo = inner
        ? `<g transform="translate(${gx} ${gy}) scale(${scala})" fill="none" stroke="${theme.colors.icona}" stroke-width="${theme.icona.stroke / scala}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
        : ''
      const labelX = el.x + lato + theme.margini.labelGap
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
      return glifo + label
    }
    case 'foto': {
      // Design clean: la foto prodotto (sfondo bianco) è posata direttamente sul bianco della
      // scheda — nessun tile arrotondato, nessuna ombra: il prodotto sembra galleggiare senza
      // cornice, come nelle pagine prodotto Apple. Il colore lo mette il prodotto stesso.
      const { x, y, width: w, height: hh } = el
      const href = deps.image(el.imageHash)
      return href
        ? `<image x="${x}" y="${y}" width="${w}" height="${hh}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="16" fill="${theme.colors.fotoPlaceholder}"/>`
    }
    case 'quota': {
      // Quota nascosta (toggle profondità): resta nella scena ma non si disegna.
      if (el.nascosta) return ''
      // Callout misura MINIMAL: una retta sottile grigio-chiaro + il numero accostato, SENZA
      // i trattini perpendicolari agli estremi (rimossi nel design clean/Apple). Grigio neutro,
      // corpo piccolo: le misure sono info di supporto, non competono con titolo/feature.
      const { x1, y1, x2, y2 } = el
      const col = theme.colors.quota
      const sw = theme.freccia.stroke
      const fs = theme.testo.quota
      const gap = theme.freccia.labelGap
      const linea = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`
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
      // Testo piccolo → tracking leggermente positivo per leggibilità (skill apple-design §15).
      const etichetta = `<text x="${lx}" y="${ly}" text-anchor="${anchor}"${ruota} font-family="${theme.fontFamily}" font-size="${fs}" font-weight="500" letter-spacing="0.2" fill="${theme.colors.quotaTesto}">${esc(el.valore)}</text>`
      return linea + etichetta
    }
    case 'badge': {
      if (el.nascosto) return ''
      // "Hero stat" (colonna-sinistra): numero grande + etichetta piccola in maiuscoletto sopra,
      // ancorato a sinistra (x = el.x). Forte gerarchia, stile keynote Apple. Tracking negativo sul
      // numero (corpo grande), positivo sull'etichetta (corpo piccolo) — vedi apple-design §15.
      if (el.heroValore) {
        const nSize = theme.testo.heroNumero
        const lSize = theme.testo.heroEtichetta
        const etich = el.heroEtichetta
          ? `<text x="${el.x}" y="${el.y}" font-family="${theme.fontFamily}" font-size="${lSize}" font-weight="600" letter-spacing="1.2" fill="${theme.colors.testoMuto}">${esc(el.heroEtichetta.toUpperCase())}</text>`
          : ''
        const num = `<text x="${el.x}" y="${el.y + nSize}" font-family="${theme.fontFamily}" font-size="${nSize}" font-weight="600" letter-spacing="-0.8" fill="${theme.colors.testo}">${esc(el.heroValore)}</text>`
        return etich + num
      }
      // Design clean (multi-prodotto): pill neutra (grigio chiarissimo, testo inchiostro).
      const w = Math.ceil(larghezzaStimata(el.testo, theme.testo.badge)) + theme.badge.paddingX * 2
      const h = theme.badge.altezza
      const { x, y } = el
      const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${theme.colors.sfondoAlt}"/>`
      const t = `<text x="${x + w / 2}" y="${y + h / 2 + theme.testo.badge / 3}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.testo.badge}" font-weight="600" fill="${theme.colors.badgeTesto}">${esc(el.testo)}</text>`
      return rect + t
    }
  }
}

export function renderScene(scene: Scene, deps: { icon: IconResolver; image: ImageResolver }): string {
  const body = scene.elements.map((el) => renderElement(el, deps)).join('\n  ')
  const { width: w, height: h } = scene.canvas
  // Design clean: tela bianca piena, niente pannello tinta, niente hairline, niente logo Satur.
  // La scheda è monocromatica; il colore lo mette solo la foto prodotto (e i loghi di marchio).
  const sfondo = `<rect width="${w}" height="${h}" fill="${theme.colors.sfondo}"/>`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  ${sfondo}`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join('\n')
}
