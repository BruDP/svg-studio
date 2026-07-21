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
// quando cambia la logica che determina la proposta). Bump a 8: nuova categoria
// "illuminazione" + 8 chiavi feature lampade in dictionary/features.yaml (v7) e
// dictionary/categories.yaml (v4), più curatela arredo_interno (5 feature irrilevanti
// rimosse). Invalida la cache: le lampade classificate arredo_interno vanno ri-estratte.
export const PROMPT_VERSION = 8
