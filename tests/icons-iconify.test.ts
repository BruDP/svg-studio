import { describe, it, expect } from 'vitest'
import { searchIconify, fetchIconifySvg, ICONIFY_SETS } from '@/lib/icons/iconify'

describe('searchIconify', () => {
  it('interroga l\'API filtrando sui set ammessi e mappa i risultati', async () => {
    let calledUrl = ''
    const fetchJson = async (url: string) => {
      calledUrl = url
      return { icons: ['tabler:ruler', 'lucide:ruler', 'mdi:ruler'] }
    }
    const out = await searchIconify('ruler', { fetchJson })
    // la query deve limitare ai set ammessi
    for (const set of ICONIFY_SETS) expect(calledUrl).toContain(set)
    // i risultati fuori dai set ammessi vengono scartati
    expect(out.map((c) => c.id)).toEqual(['tabler:ruler', 'lucide:ruler'])
    expect(out[0]).toEqual({ id: 'tabler:ruler', set: 'tabler', name: 'ruler' })
  })
})

describe('fetchIconifySvg', () => {
  it('scarica l\'SVG per id set:name', async () => {
    let calledUrl = ''
    const fetchText = async (url: string) => {
      calledUrl = url
      return '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>'
    }
    const svg = await fetchIconifySvg('tabler:ruler', { fetchText })
    expect(calledUrl).toContain('tabler')
    expect(calledUrl).toContain('ruler')
    expect(svg).toMatch(/<svg/)
  })
})
