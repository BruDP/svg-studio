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
// quando cambia la logica che determina la proposta). Bump a 6: parseSetDimensions ora
// riconosce i set corroborati anche via "Portata massima ... Kg" (set giardino/mobili, oltre
// a "Capacità ... L"), tollera il separatore x mancante e filtra le righe-accessorio. Senza
// questo bump i set già in cache resterebbero senza sottoProdotti (es. 5905391, che il Piano A
// aveva mancato di invalidare) → renderizzati col template singolo invece del multi-prodotto.
export const PROMPT_VERSION = 6
