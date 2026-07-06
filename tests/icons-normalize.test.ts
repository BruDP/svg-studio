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
    expect(out).not.toMatch(/https?:/i)
  })

  it('lancia se non c\'è un tag svg', () => {
    expect(() => sanitizeSvg('<div>no svg</div>')).toThrow()
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
})
