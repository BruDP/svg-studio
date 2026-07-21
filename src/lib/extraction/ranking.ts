import type { Dictionary } from '@/lib/dictionary/types'
import type { ValidatedFeature } from './validator'

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
  return {
    features: proposed.filter((f) => !f.badge).slice(0, MAX_ICON_FEATURES),
    badges: proposed.filter((f) => f.badge),
  }
}
