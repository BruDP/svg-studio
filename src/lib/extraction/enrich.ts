import type { RawExtraction, RawFeature } from './types'
import type { ProductRecord } from '@/lib/feed/types'

/**
 * Post-processing di estrazione: applica regole categoriche per arricchire feature quando
 * Gemini non estrae abbastanza dal testo (testo scarno, titolo con numeri che non vengono colti).
 *
 * Pattern categoria-specifici:
 * - piccoli_elettrodomestici: velocità, potenza, cavo, capacità
 * - fitness: potenza, peso max, programmi, resistenza
 * - barbecue/garden: materiale, alimentazione, bruciatori, coperchio
 */
export function enrichExtraction(raw: RawExtraction, product: ProductRecord): RawExtraction {
  const needsEnrichment = raw.features.length < 3
  if (!needsEnrichment) return raw

  const title = product.descrizioneBreve.toLowerCase()
  const existing = new Set(raw.features.map((f) => f.chiave))
  const toAdd: RawFeature[] = []

  // Pattern per categoria
  const patternsByCategory: Record<string, Array<{ regex: RegExp; chiave: string; label: string }>> = {
    piccoli_elettrodomestici: [
      { regex: /(\d+)\s*velocit[àa]/i, chiave: 'velocita_marcia', label: 'velocità' },
      { regex: /(\d+)\s*w(?:att)?/i, chiave: 'potenza_watt', label: 'potenza' },
      { regex: /cavo\s+(\d+)\s*cm/i, chiave: 'lunghezza_cavo', label: 'cavo' },
      { regex: /(\d+)\s*l(?:itri)?/i, chiave: 'capacita_litri', label: 'capacità' },
      { regex: /(\d+)\s*programmi?/i, chiave: 'programmi', label: 'programmi' },
    ],
    fitness: [
      { regex: /(\d+)\s*w(?:att)?/i, chiave: 'potenza_watt', label: 'potenza' },
      { regex: /(\d+)\s*kg/i, chiave: 'peso_max_utente_kg', label: 'peso max' },
      { regex: /(\d+)\s*programmi?/i, chiave: 'programmi_allenamento', label: 'programmi' },
      { regex: /resistenza\s+(\d+)/i, chiave: 'resistenza_regolabile', label: 'resistenza' },
    ],
    barbecue: [
      { regex: /(\d+)\s*bruciatori?/i, chiave: 'numero_bruciatori', label: 'bruciatori' },
      { regex: /(acciaio|ghisa|inox)/i, chiave: 'materiale_struttura', label: 'materiale' },
      { regex: /(gas|carbone|elettrico)/i, chiave: 'alimentazione', label: 'alimentazione' },
    ],
    arredo_esterno: [
      { regex: /(acciaio|alluminio|legno|resina|ferro)/i, chiave: 'materiale_struttura', label: 'materiale' },
      { regex: /(\d+)\s*posti?/i, chiave: 'numero_posti', label: 'posti' },
    ],
  }

  const patterns = patternsByCategory[raw.categoria] ?? []

  for (const p of patterns) {
    if (existing.has(p.chiave)) continue
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
