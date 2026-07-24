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
// Bump a 10: padding "minimo 6 icone" in rankFeatures (poi RIMOSSO, vedi 11).
// Bump a 11: RIMOSSO il padding min-6 (produceva icone false su prodotti a testo scarno, es.
// specchio con "ripiani/cuscini"). Ora le schede scarne mostrano meno icone ma tutte vere; il
// conteggio icone resta come SEGNALE di qualità (⚠ poche icone), non come pavimento forzato.
// Invalida la cache: rimuove i proposal col padding scritti a v10.
// Bump a 13: prompt AGGRESSIVO con inferenza per categoria (fallback per testi scarni).
// Titolo è fonte PRIMARIA, non secondaria. Estrattore estrae TUTTI i numeri/aggettivi dal titolo.
// Categoria fallback (piccoli_elettrodomestici → watt, velocità, cavo; barbecue → alimentazione, etc).
// Invalida cache: ri-estrae con nuova strategia tutti i prodotti.
export const PROMPT_VERSION = 13
