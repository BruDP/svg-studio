export interface FeatureDef {
  label: string
  icona: string
  priorita: number
  badge: boolean
  valore: 'obbligatorio' | 'assente'
  categorie: string[]
}

export interface Dictionary {
  version: number
  categorie: string[]
  features: Record<string, FeatureDef>
}
