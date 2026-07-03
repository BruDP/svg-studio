export interface ProductRecord {
  sku: string
  images: string[]
  descrizioneBreve: string
  descrizioneEstesa: string
  notaTecnica: string[]
  notaEmozionale: string
  prezzo: string
  marchio: string
  urlSlug: string
  colore: string
  materiale: string
  imballo: { lunghezza: number | null; larghezza: number | null; altezza: number | null }
}
