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
  /**
   * Larghezza massima (px) di wrap dell'etichetta, se diversa dal default globale
   * `theme.margini.labelMaxLarghezza` (calibrato per `colonna-sinistra`). Usata dal template
   * `multi-prodotto`, dove la griglia condivisa ha meno spazio orizzontale per colonna.
   * Opzionale, retrocompatibile.
   */
  maxLarghezzaEtichetta?: number
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
  /** Sotto-prodotto di appartenenza in una scheda "set" (es. 'g0'). Opzionale, retrocompatibile. */
  gruppo?: string
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
  /** Sotto-prodotto di appartenenza in una scheda "set" (es. 'g0'). Opzionale, retrocompatibile. */
  gruppo?: string
  /**
   * Se true la quota è nascosta: resta nella scena (coordinate preservate) ma non viene disegnata
   * né mostra maniglie. Usata dal toggle "profondità" per prodotti sferici — ripremendo riappare
   * identica. Opzionale, retrocompatibile.
   */
  nascosta?: boolean
}

/** Badge speciale (es. "120 KG") posizionato vicino alla foto. */
export interface BadgeElement {
  type: 'badge'
  id: string
  testo: string
  x: number
  y: number
  /** Sotto-prodotto di appartenenza in una scheda "set" (es. 'g0'). Opzionale, retrocompatibile. */
  gruppo?: string
  /** Se true il badge è nascosto (stesso pattern di `QuotaElement.nascosta`). Opzionale, retrocompatibile. */
  nascosto?: boolean
  /**
   * Modalità "hero stat" (design clean): quando presenti, il badge è reso come NUMERO GRANDE
   * (`heroValore`, es. "515 L") con etichetta piccola sopra (`heroEtichetta`, es. "Capienza"),
   * ancorato nella colonna sinistra — invece della pill. Usato dal template colonna-sinistra;
   * il multi-prodotto lascia i campi assenti → pill per cella. Opzionali, retrocompatibili.
   */
  heroValore?: string
  heroEtichetta?: string
}

export interface TestoElement {
  type: 'testo'
  id: string
  testo: string
  x: number
  y: number
  ruolo: 'titolo' | 'sottotitolo' | 'corpo'
  /** Se true l'elemento testo è nascosto (stesso pattern di `QuotaElement.nascosta`). Opzionale, retrocompatibile. */
  nascosto?: boolean
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
  /**
   * Colore-accento "di famiglia" della scheda (icone, quote, eyebrow, badge), hex `#RRGGBB`.
   * Risolto dalla categoria del prodotto al compose (vedi `theme-satur.ts`). Opzionale/retrocompatibile:
   * le scene salvate prima di questo campo (o senza categoria riconosciuta) usano l'accento di
   * default del tema (teal) — vedi `theme.colors.accento` nel renderer.
   */
  accento?: string
}

export const SCENE_VERSION = 1
