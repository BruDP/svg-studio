import { describe, it, expect } from 'vitest'
import { accentoPerCategoria, PALETTE_REPARTO } from '@/lib/theme-satur'
import { theme } from '@/lib/theme'

describe('accentoPerCategoria', () => {
  it('mappa i grandi/piccoli elettrodomestici sul reparto kooper (è il marchio stampato sul prodotto)', () => {
    for (const c of ['frigorifero', 'congelatore', 'lavatrice', 'forno', 'condizionatore', 'aspirapolvere']) {
      expect(accentoPerCategoria(c)).toBe(PALETTE_REPARTO.kooper)
    }
  })

  it('mappa garden/ombrellone/barbecue sul reparto garden', () => {
    for (const c of ['arredo_esterno', 'ombrellone', 'barbecue']) {
      expect(accentoPerCategoria(c)).toBe(PALETTE_REPARTO.garden)
    }
  })

  it('categoria sconosciuta o "altro" usa l\'accento di default (teal)', () => {
    expect(accentoPerCategoria('altro')).toBe(theme.colors.accento)
    expect(accentoPerCategoria('categoria-inesistente')).toBe(theme.colors.accento)
  })

  it('ogni colore-reparto è un hex #RRGGBB valido', () => {
    for (const hex of Object.values(PALETTE_REPARTO)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
