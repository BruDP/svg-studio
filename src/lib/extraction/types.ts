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
// quando cambia la logica che determina la proposta). Bump a 7: nascondiProfonditaSpecchi ora
// ancora il match "specchi" a inizio descrizioneBreve, così mobili/lampade che citano uno
// specchio ("Mobile a specchio", "Lampada da specchio") non perdono più la profondità (falsi
// positivi 2188413/5918801 già in cache col profondita erroneamente nullo).
export const PROMPT_VERSION = 7
