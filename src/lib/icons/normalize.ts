/**
 * Sanitizzazione SVG basata su regex (nessun DOM lato server). Rimuove i vettori
 * di rischio: script, style, handler inline, riferimenti a risorse esterne.
 * Volutamente conservativo: preferisce lanciare piuttosto che passare SVG dubbi.
 */
export function sanitizeSvg(raw: string): string {
  let s = raw
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  // attributi handler inline: on*="..."
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  // elementi che caricano risorse esterne
  s = s.replace(/<image[\s\S]*?>/gi, '')
  s = s.replace(/<use[\s\S]*?>/gi, '')
  // riferimenti http(s) residui in qualunque attributo
  s = s.replace(/\s[a-z:]+\s*=\s*"https?:[^"]*"/gi, '')
  s = s.replace(/\s[a-z:]+\s*=\s*'https?:[^']*'/gi, '')
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
