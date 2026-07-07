export interface SceneCanvas {
  width: number
  height: number
}

/** Icona canonica (risolta per chiave dizionario) + etichetta. */
export interface IconLabelElement {
  type: 'icona-label'
  id: string
  chiave: string
  etichetta: string
  x: number
  y: number
  verificata: boolean
}

/** Foto prodotto, referenziata per hash nella cache immagini (mai URL remoto). */
export interface FotoElement {
  type: 'foto'
  id: string
  imageHash: string
  x: number
  y: number
  width: number
  height: number
}

/** Freccia di quotatura ancorata al bounding box della foto. */
export interface QuotaElement {
  type: 'quota'
  id: string
  orientamento: 'verticale' | 'orizzontale' | 'diagonale'
  valore: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Badge speciale (es. "120 KG") posizionato vicino alla foto. */
export interface BadgeElement {
  type: 'badge'
  id: string
  testo: string
  x: number
  y: number
}

export interface TestoElement {
  type: 'testo'
  id: string
  testo: string
  x: number
  y: number
  ruolo: 'titolo' | 'sottotitolo' | 'corpo'
}

export type SceneElement =
  | IconLabelElement
  | FotoElement
  | QuotaElement
  | BadgeElement
  | TestoElement

export interface Scene {
  version: number
  sku: string
  templateId: string
  canvas: SceneCanvas
  elements: SceneElement[]
}

export const SCENE_VERSION = 1
