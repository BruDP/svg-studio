import { describe, it, expect } from 'vitest'
import { rilevaLinea, brandDaMostrare } from '@/lib/branding/linea'
import { gruppoAltoValore, inScopeAltoValore } from '@/lib/branding/selezione'

describe('rilevaLinea', () => {
  it('riconosce la linea dall\'ultimo segmento della descrizione (reali del feed)', () => {
    expect(rilevaLinea('Barbecue tondo rosso con ruote Ø51xh.84,5 cm, BestBQ')).toBe('BestBQ')
    expect(rilevaLinea('Dondolo da giardino 3 posti, tetto parasole, verde, Esté')).toBe('Esté')
    expect(rilevaLinea('Tapis roulant pieghevole 1200 W, FitLover')).toBe('FitLover')
    expect(rilevaLinea('Climatizzatore inverter 12000 Btu, Kooper X')).toBe('Kooper X')
  })

  it('riconosce le varianti Sibilla a fine segmento', () => {
    expect(rilevaLinea('Set 6 bicchieri, Solid Sibilla')).toBe('Sibilla')
    expect(rilevaLinea('Piatto, Manhattan Sibilla')).toBe('Sibilla')
  })

  it('null se l\'ultimo segmento non è una linea nota', () => {
    expect(rilevaLinea('Pouff contenitore 37x45,5 cm')).toBeNull() // finisce con una misura
    expect(rilevaLinea('Prodotto generico, marca ignota')).toBeNull()
    expect(rilevaLinea('')).toBeNull()
  })
})

describe('brandDaMostrare', () => {
  it('preferisce la linea al marchio quando riconosciuta', () => {
    expect(brandDaMostrare('Barbecue …, BestBQ', 'Galileo')).toBe('BestBQ')
    expect(brandDaMostrare('Frigorifero …, nero, Kooper', 'Kooper')).toBe('Kooper') // "Kooper" non è una linea → marchio
  })
  it('ripiega sul marchio se nessuna linea', () => {
    expect(brandDaMostrare('Bicchiere 300 ml, Acapulco', 'Villa d Este Home Tivoli')).toBe('Villa d Este Home Tivoli')
  })
})

describe('gruppoAltoValore / inScopeAltoValore', () => {
  it('classifica i gruppi ad alto valore', () => {
    expect(gruppoAltoValore('Frigo …, Kooper', 'Kooper')).toBe('kooper')
    expect(gruppoAltoValore('Clima …, Kooper X', 'Kooper')).toBe('kooper') // Kooper X → marchio Kooper
    expect(gruppoAltoValore('Barbecue …, BestBQ', 'Galileo')).toBe('garden')
    expect(gruppoAltoValore('Dondolo …, Esté', 'Galileo')).toBe('garden')
    expect(gruppoAltoValore('Tapis …, FitLover', 'Galileo')).toBe('fitness')
  })
  it('fuori scope → null / false', () => {
    expect(gruppoAltoValore('Bicchiere …, Acapulco', 'Villa d Este Home Tivoli')).toBeNull()
    expect(inScopeAltoValore('Bicchiere …, Acapulco', 'Villa d Este Home Tivoli')).toBe(false)
    expect(inScopeAltoValore('Barbecue …, BestBQ', 'Galileo')).toBe(true)
  })
})
