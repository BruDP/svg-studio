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
// Bump a 9: prompt di estrazione reso ESAUSTIVO (estrae tutte le feature supportate dal testo,
// punta a >=6) mantenendo l'ancora anti-invenzione (testoSorgente) — più icone per scheda.
// Bump a 10: padding "minimo 6 icone" in rankFeatures (feature di categoria da-verificare) — è
// post-processing dell'estrazione, entra nel JSON cachato → invalida la cache per applicarlo.
export const PROMPT_VERSION = 10
