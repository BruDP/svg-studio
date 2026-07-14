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
// quando cambia la logica che determina la proposta). Bump a 5: parseDimensions ora
// riconosce anche "Misure: N x h. M cm" senza il simbolo Ø (18 prodotti reali nel feed,
// scoperto confrontando le schede automatiche con schede manuali di riferimento) — prima
// producevano scene senza alcuna quota.
export const PROMPT_VERSION = 5
