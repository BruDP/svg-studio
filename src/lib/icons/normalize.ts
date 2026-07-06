// Valore di un attributo, in una delle due forme quotate: "..." oppure '...'.
const QUOTED_VALUE = `(?:"[^"]*"|'[^']*')`
// Valore di un attributo senza virgolette, terminato da spazio o da ">".
const UNQUOTED_VALUE = `[^\\s>]*`

/**
 * Sanitizzazione SVG basata su regex (nessun DOM lato server). Rimuove i vettori
 * di rischio: script, style, handler inline, riferimenti a risorse esterne.
 * Volutamente conservativo: preferisce lanciare piuttosto che passare SVG dubbi.
 */
export function sanitizeSvg(raw: string): string {
  let s = raw
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  // attributi handler inline: on*="...", on*='...' oppure on*=valore-senza-spazi
  s = s.replace(new RegExp(`\\son[a-z]+\\s*=\\s*(?:${QUOTED_VALUE}|${UNQUOTED_VALUE})`, 'gi'), '')
  // elementi che caricano risorse esterne
  s = s.replace(/<image[\s\S]*?>/gi, '')
  s = s.replace(/<use[\s\S]*?>/gi, '')
  // riferimenti a risorse esterne/attive: solo su href/xlink:href/src, non su
  // attributi qualunque (altrimenti si cancella anche xmlns="http://...").
  s = s.replace(
    new RegExp(`\\s(?:xlink:href|href|src)\\s*=\\s*${QUOTED_VALUE}`, 'gi'),
    (match) => (/(?:https?|javascript|data):/i.test(match) ? '' : match),
  )
  if (!/<svg[\s>]/i.test(s)) {
    throw new Error('SVG non valido dopo la sanitizzazione: manca il tag <svg>')
  }
  return s.trim()
}

/** Estrae il valore di un attributo dal tag di apertura <svg ...>. */
function svgOpenTag(s: string): string {
  const m = /<svg[^>]*>/i.exec(s)
  if (!m) throw new Error('Tag <svg> di apertura non trovato')
  return m[0]
}

export function normalizeIconSvg(raw: string): string {
  const s = sanitizeSvg(raw)
  const open = svgOpenTag(s)
  let newOpen = open
  // rimuovi width/height/viewBox/fill/stroke esistenti sul tag svg
  newOpen = newOpen.replace(/\swidth\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sheight\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sviewBox\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sfill\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sstroke\s*=\s*"[^"]*"/gi, '')
  // reinserisci gli attributi canonici subito dopo "<svg"
  newOpen = newOpen.replace(
    /^<svg/i,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  )
  return s.replace(open, newOpen).trim()
}
