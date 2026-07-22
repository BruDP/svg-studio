import { describe, it, expect } from 'vitest'
import { mescola } from '@/lib/render/colore'

describe('mescola', () => {
  it('quota 1 restituisce il primo colore, quota 0 il secondo', () => {
    expect(mescola('#127981', '#FBFAF2', 1)).toBe('#127981')
    expect(mescola('#127981', '#FBFAF2', 0)).toBe('#FBFAF2')
  })

  it('quota intermedia produce un valore tra i due, canale per canale', () => {
    const m = mescola('#000000', '#FFFFFF', 0.5)
    // arrotondamento: 127 o 128 a seconda del metodo di round, comunque a metà strada
    expect(m).toMatch(/^#(7F7F7F|808080)$/i)
  })

  it('accetta hex senza # e produce output con #', () => {
    expect(mescola('127981', 'FBFAF2', 1).toUpperCase()).toBe('#127981')
  })

  it('quota fuori range [0,1] viene clampata', () => {
    expect(mescola('#127981', '#FBFAF2', 2)).toBe(mescola('#127981', '#FBFAF2', 1))
    expect(mescola('#127981', '#FBFAF2', -1)).toBe(mescola('#127981', '#FBFAF2', 0))
  })

  it('lancia su hex non valido', () => {
    expect(() => mescola('non-un-colore', '#FBFAF2', 0.5)).toThrow()
  })
})
