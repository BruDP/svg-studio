import { describe, it, expect } from 'vitest'
import { buildProspettivaPrompt, buildProspettivaSchema, parseProspettiva } from '@/lib/images/vision-prospettiva'

describe('buildProspettivaPrompt / buildProspettivaSchema', () => {
  it('il prompt distingue frontale/tre_quarti e chiede direzione, angolo e verso', () => {
    const prompt = buildProspettivaPrompt()
    expect(prompt).toContain('frontale')
    expect(prompt).toContain('tre_quarti')
    expect(prompt).toContain('direzioneProfondita')
    expect(prompt).toContain('angoloProfonditaGradi')
  })

  it('lo schema vincola i campi richiesti', () => {
    const s = buildProspettivaSchema() as any
    expect(s.required).toEqual(['prospettiva', 'direzioneProfondita', 'angoloProfonditaGradi', 'verso'])
  })
})

describe('parseProspettiva', () => {
  it('frontale → null (nessuna prospettiva rilevata)', () => {
    const json = JSON.stringify({
      prospettiva: 'frontale',
      direzioneProfondita: 'nessuna',
      angoloProfonditaGradi: 0,
      verso: 'nessuno',
    })
    expect(parseProspettiva(json)).toBeNull()
  })

  it('direzioneProfondita=nessuna anche con prospettiva incoerente → null', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'nessuna',
      angoloProfonditaGradi: 15,
      verso: 'su',
    })
    expect(parseProspettiva(json)).toBeNull()
  })

  it('tre_quarti destra/su → oggetto', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'destra',
      angoloProfonditaGradi: 18,
      verso: 'su',
    })
    expect(parseProspettiva(json)).toEqual({ direzione: 'destra', angoloDeg: 18, verso: 'su' })
  })

  it('tre_quarti sinistra/giu → oggetto', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'sinistra',
      angoloProfonditaGradi: 24,
      verso: 'giu',
    })
    expect(parseProspettiva(json)).toEqual({ direzione: 'sinistra', angoloDeg: 24, verso: 'giu' })
  })

  it('JSON vuoto o invalido → null (non lancia)', () => {
    expect(parseProspettiva('')).toBeNull()
    expect(parseProspettiva('non-json')).toBeNull()
  })

  it('JSON sintatticamente valido ma non-oggetto → null (non lancia)', () => {
    expect(() => parseProspettiva('null')).not.toThrow()
    expect(parseProspettiva('null')).toBeNull()
    expect(parseProspettiva('42')).toBeNull()
    expect(parseProspettiva('[]')).toBeNull()
    expect(parseProspettiva('"stringa"')).toBeNull()
    expect(parseProspettiva('true')).toBeNull()
  })

  it('direzioneProfondita incoerente (né destra/sinistra/nessuna) → null', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'boh',
      angoloProfonditaGradi: 20,
      verso: 'su',
    })
    expect(parseProspettiva(json)).toBeNull()
  })

  it('angolo fuori range viene clampato a 45', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'destra',
      angoloProfonditaGradi: 90,
      verso: 'giu',
    })
    expect(parseProspettiva(json)).toEqual({ direzione: 'destra', angoloDeg: 45, verso: 'giu' })
  })

  it('angolo negativo viene clampato a 0', () => {
    const json = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'sinistra',
      angoloProfonditaGradi: -10,
      verso: 'su',
    })
    expect(parseProspettiva(json)).toEqual({ direzione: 'sinistra', angoloDeg: 0, verso: 'su' })
  })

  it('angolo mancante o non numerico → null (non lancia)', () => {
    const json = JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'destra', verso: 'su' })
    expect(parseProspettiva(json)).toBeNull()
    const json2 = JSON.stringify({
      prospettiva: 'tre_quarti',
      direzioneProfondita: 'destra',
      angoloProfonditaGradi: 'venti',
      verso: 'su',
    })
    expect(parseProspettiva(json2)).toBeNull()
  })

  it('verso mancante o diverso da "su" → default "giu"', () => {
    const json = JSON.stringify({ prospettiva: 'tre_quarti', direzioneProfondita: 'destra', angoloProfonditaGradi: 20 })
    expect(parseProspettiva(json)).toEqual({ direzione: 'destra', angoloDeg: 20, verso: 'giu' })
  })
})
