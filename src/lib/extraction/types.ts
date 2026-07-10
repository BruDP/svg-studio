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
// quando cambia la logica che determina la proposta). Bump a 3: il dizionario si amplia
// con le 21 chiavi grandi elettrodomestici (spec 2026-07-10) e 3 chiavi esistenti estendono
// le categorie applicabili, quindi le estrazioni cache dei prodotti frigo/lavatrice/forno/
// congelatore/aspirapolvere vanno ricalcolate con il dizionario ampliato.
export const PROMPT_VERSION = 3
