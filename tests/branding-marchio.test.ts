import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { marchioInfo, chiaveLogo } from '@/lib/branding/marchio'
import { caricaLogoMarchio } from '@/lib/branding/logo-loader'

describe('marchioInfo', () => {
  it('riconosce i 3 marchi reali del feed (case-insensitive)', () => {
    expect(marchioInfo('Galileo')).toEqual({ slug: 'galileo', display: 'Galileo' })
    expect(marchioInfo('galileo')).toEqual({ slug: 'galileo', display: 'Galileo' })
    expect(marchioInfo('Kooper')).toEqual({ slug: 'kooper', display: 'Kooper' })
  })

  it('mappa "Villa d Este Home Tivoli" e "VdE" sullo stesso marchio', () => {
    expect(marchioInfo('Villa d Este Home Tivoli')).toEqual({ slug: 'villa-d-este', display: "Villa d'Este" })
    expect(marchioInfo('VdE').slug).toBe('villa-d-este')
  })

  it('fallback: slug slugificato (accenti rimossi) e display = marchio ripulito', () => {
    expect(marchioInfo('Esté')).toEqual({ slug: 'este', display: 'Esté' })
    expect(marchioInfo('BestBQ')).toEqual({ slug: 'bestbq', display: 'BestBQ' })
  })

  it('chiaveLogo usa lo slug', () => {
    expect(chiaveLogo('Villa d Este Home Tivoli')).toBe('logo:villa-d-este')
  })
})

describe('caricaLogoMarchio', () => {
  it('restituisce un data URI quando esiste il file <slug>.png, altrimenti null', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'loghi-'))
    try {
      // 1x1 PNG trasparente
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      )
      writeFileSync(path.join(dir, 'kooper.png'), png)
      const uri = caricaLogoMarchio('Kooper', dir)
      expect(uri).toMatch(/^data:image\/png;base64,/)
      expect(caricaLogoMarchio('Galileo', dir)).toBeNull() // nessun file galileo.*
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
