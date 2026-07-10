export interface RawFeature {
  chiave: string
  valore: string | null
  testoSorgente: string
}

export interface RawExtraction {
  categoria: string
  features: RawFeature[]
}

// Versione della pipeline di estrazione (entra in computeInputHash → invalida la cache
// quando cambia la logica che determina la proposta). Bump a 2: parseDimensions ora
// riconosce il formato tondo "Ø D x h. H cm", quindi le estrazioni cache dei prodotti
// tondi (con dimensioni: null) vanno ricalcolate.
export const PROMPT_VERSION = 2
