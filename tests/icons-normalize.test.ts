import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sanitizeSvg, normalizeIconSvg } from '@/lib/icons/normalize'

const raw = readFileSync('tests/fixtures/icons/raw-tabler-ruler.svg', 'utf8')

describe('sanitizeSvg', () => {
  it('rimuove script, style, handler inline e riferimenti esterni', () => {
    const out = sanitizeSvg(raw)
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/<style/i)
    expect(out).not.toMatch(/onclick/i)
    // l'immagine esterna (e il suo http(s)) deve sparire, ma non xmlns
    expect(out).not.toMatch(/evil\.example/i)
    expect(out).not.toMatch(/<image/i)
  })

  it('lancia se non c\'è un tag svg', () => {
    expect(() => sanitizeSvg('<div>no svg</div>')).toThrow()
  })

  it('preserva xmlns sul tag svg', () => {
    const out = sanitizeSvg(raw)
    expect(out).toMatch(/<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  })

  it('rimuove un handler onclick non quotato', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" onclick=steal()/></svg>')
    expect(out).not.toMatch(/onclick/i)
  })

  it('rimuove href javascript: e http(s):, mantenendo path/d e xmlns', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><path d="M3 3h14v14H3z"/></a><a href="https://evil/x.png"></a></svg>',
    )
    expect(out).not.toMatch(/javascript:/i)
    expect(out).not.toMatch(/https?:\/\/evil/i)
    expect(out).toMatch(/d="M3 3h14v14H3z"/)
    expect(out).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  })
})

describe('normalizeIconSvg', () => {
  it('forza viewBox 24×24, stroke currentColor, fill none, senza width/height fissi', () => {
    const out = normalizeIconSvg(raw)
    expect(out).toMatch(/viewBox="0 0 24 24"/)
    expect(out).toMatch(/stroke="currentColor"/)
    expect(out).toMatch(/fill="none"/)
    expect(out).not.toMatch(/\swidth="24"/)
    expect(out).not.toMatch(/\sheight="24"/)
  })

  it('preserva il path del disegno', () => {
    const out = normalizeIconSvg(raw)
    expect(out).toMatch(/M3 3h14v14H3z/)
  })

  it('è idempotente', () => {
    expect(normalizeIconSvg(normalizeIconSvg(raw))).toBe(normalizeIconSvg(raw))
  })

  it('preserva xmlns sul tag svg', () => {
    const out = normalizeIconSvg(raw)
    expect(out).toMatch(/<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  })
})
