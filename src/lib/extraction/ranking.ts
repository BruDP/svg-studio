import type { Dictionary } from '@/lib/dictionary/types'
import type { ValidatedFeature } from './validator'
import { MIN_ICONE } from '@/lib/quality/valuta'

export const MAX_ICON_FEATURES = 7

export interface ProposedFeature {
  chiave: string
  etichetta: string
  valore: string | null
  verificata: boolean
  priorita: number
  badge: boolean
}

export function rankFeatures(
  validated: ValidatedFeature[],
  categoria: string,
  dict: Dictionary,
): { features: ProposedFeature[]; badges: ProposedFeature[] } {
  const seen = new Set<string>()
  const proposed: ProposedFeature[] = []

  for (const f of validated) {
    const def = dict.features[f.chiave]
    if (!def) continue
    if (!def.categorie.includes(categoria)) continue
    if (seen.has(f.chiave)) continue
    seen.add(f.chiave)
    proposed.push({
      chiave: f.chiave,
      etichetta: def.label.replace('{valore}', f.valore ?? ''),
      valore: f.valore,
      verificata: f.verificata,
      priorita: def.priorita,
      badge: def.badge,
    })
  }

  proposed.sort((a, b) => b.priorita - a.priorita || a.chiave.localeCompare(b.chiave))
  const features = proposed.filter((f) => !f.badge).slice(0, MAX_ICON_FEATURES)

  // Padding "minimo 6 icone onesto": se le feature reali sono < MIN_ICONE, riempie in coda con
  // feature della categoria NON confermate dal testo (verificata=false), marcandole così l'operatore
  // le rivede/rimuove. Solo feature senza valore obbligatorio (label senza {valore}) e non badge;
  // non si supera il catalogo di categoria (categorie povere restano sotto 6, niente invenzioni).
  if (features.length < MIN_ICONE) {
    const presenti = new Set(proposed.map((f) => f.chiave))
    const riempimento: ProposedFeature[] = Object.entries(dict.features)
      .filter(
        ([k, def]) =>
          def.categorie.includes(categoria) &&
          !def.badge &&
          !def.label.includes('{valore}') &&
          !presenti.has(k),
      )
      .sort(([, a], [, b]) => b.priorita - a.priorita || 0)
      .slice(0, MIN_ICONE - features.length)
      .map(([k, def]) => ({
        chiave: k,
        etichetta: def.label.replace('{valore}', '').trim(),
        valore: null,
        verificata: false,
        priorita: def.priorita,
        badge: false,
      }))
    features.push(...riempimento)
  }

  return {
    features,
    badges: proposed.filter((f) => f.badge),
  }
}
