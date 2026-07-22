import { describe, it, expect } from 'vitest'
import { estraiTitolo } from '@/lib/layout/titolo'

describe('estraiTitolo', () => {
  it('taglia la coda di misure precedute da virgola (non tocca la capacità nel nome)', () => {
    // 515L è capacità (parte del nome), 83,3x… è ingombro (coda): si taglia solo l'ingombro.
    expect(estraiTitolo('Frigorifero 4 porte con freezer 515L, 83,3x65,3x177,5cm, nero, Kooper', 'Kooper')).toBe(
      'Frigorifero 4 porte con freezer 515L',
    )
  })

  it('NON tronca sulla virgola decimale delle misure (bug del vecchio split)', () => {
    expect(estraiTitolo('Barbecue tondo rosso con ruote Ø51xh.84,5 cm, BestBQ', 'BestBQ')).toBe(
      'Barbecue tondo rosso con ruote',
    )
    expect(estraiTitolo('Panca contenitore 90x40x50,5 cm')).toBe('Panca contenitore')
    expect(estraiTitolo('Gazebo a veranda idrorepellente 3x2,5 m, ecrù, Esté', 'Esté')).toBe(
      'Gazebo a veranda idrorepellente',
    )
  })

  it('taglia le misure incollate al nome senza virgola', () => {
    expect(estraiTitolo('Barbecue rosso tondo Ø42xh.77 cm, BestBQ', 'BestBQ')).toBe('Barbecue rosso tondo')
  })

  it('preserva voltaggi/potenze (specifiche, non ingombro) fino alla virgola strutturale', () => {
    // "1,5 V" resta (spec), il marchio dopo la virgola cade.
    expect(estraiTitolo('Set 4 batterie AA stilo 1,5 V, Kooper', 'Kooper')).toBe('Set 4 batterie AA stilo 1,5 V')
  })

  it('senza misure taglia colore/marchio alla prima virgola strutturale', () => {
    expect(estraiTitolo('Set 24 posate in acciaio inox, silver lucido, Inglese Sibilla', 'Inglese Sibilla')).toBe(
      'Set 24 posate in acciaio inox',
    )
  })

  it('stringa vuota → stringa vuota; senza coda restituisce il nome intero', () => {
    expect(estraiTitolo('')).toBe('')
    expect(estraiTitolo('Aspirapolvere ciclonico')).toBe('Aspirapolvere ciclonico')
  })

  it('ripiega sul primo segmento se il taglio azzera il titolo (nome tutto-misure)', () => {
    expect(estraiTitolo('90x40x50 cm')).toBe('90x40x50 cm')
  })
})
