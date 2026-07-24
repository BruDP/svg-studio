import type { RawExtraction, RawFeature } from './types'
import type { ProductRecord } from '@/lib/feed/types'

/**
 * Post-processing di estrazione: applica regole categoriche per arricchire feature quando
 * Gemini non estrae abbastanza dal testo (testo scarno, titolo con numeri che non vengono colti).
 *
 * Strategia: se categoria è "piccoli_elettrodomestici" e features < 3, estrai dal TITOLO
 * pattern come "5 velocità" → velocità:5, "200W" → potenza:200W.
 */
export function enrichExtraction(raw: RawExtraction, product: ProductRecord): RawExtraction {
  // Se non è categoria ad alto valore di feature, non enrichire
  const needsEnrichment = raw.features.length < 3 && raw.categoria === 'piccoli_elettrodomestici'
  if (!needsEnrichment) return raw

  const title = product.descrizioneBreve.toLowerCase()
  const existing = new Set(raw.features.map((f) => f.chiave))
  const toAdd: RawFeature[] = []

  // Regole di estrazione dal titolo per piccoli_elettrodomestici
  // Es: "Sbattitore 5 velocità 200W" → velocità:5, potenza:200
  const patterns = [
    { regex: /(\d+)\s*velocit[àa]/i, chiave: 'velocita_marcia', label: 'velocità' },
    { regex: /(\d+)\s*w(?:att)?/i, chiave: 'potenza_watt', label: 'potenza' },
    { regex: /cavo\s+(\d+)\s*cm/i, chiave: 'lunghezza_cavo', label: 'cavo', exists: true },
    { regex: /(\d+)\s*l(?:itri)?/i, chiave: 'capacita_litri', label: 'capacità' },
    { regex: /(\d+)\s*programmi?/i, chiave: 'programmi', label: 'programmi' },
  ]

  for (const p of patterns) {
    if (existing.has(p.chiave)) continue // non duplicare se già estratto
    const match = title.match(p.regex)
    if (match) {
      const valore = match[1] ?? null
      toAdd.push({
        chiave: p.chiave,
        valore,
        testoSorgente: `[Titolo] "${product.descrizioneBreve}" → ${p.label} ${valore ? `"${valore}"` : ''}`,
      })
      existing.add(p.chiave)
    }
  }

  return { ...raw, features: [...raw.features, ...toAdd] }
}
