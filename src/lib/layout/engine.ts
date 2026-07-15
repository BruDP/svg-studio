import { theme } from '@/lib/theme'

export interface Punto {
  x: number
  y: number
}

export interface QuotaSpec {
  orientamento: 'verticale' | 'orizzontale' | 'diagonale'
  valore: string
  x1: number
  y1: number
  x2: number
  y2: number
}

// --- celleProdotti -----------------------------------------------------------------------
// Costanti locali per la riga di N celle-foto di una scheda "set" (più sotto-prodotti).
// Valori scelti ragionevolmente ora, da tarare nel Task 4 sul confronto con il render reale/golden.
const CELLE_MARGIN_X = 40 // margine sinistro/destro dal bordo canvas (analogo a theme.margini.canvas=60, leggermente più stretto per lasciare più spazio alle celle)
const CELLE_Y = 120 // inizio della zona-foto (sotto un eventuale titolo/header)
const CELLE_HEIGHT = 420 // altezza cella → zona-foto ~120..540
// Gutter minimo tra una cella e la successiva: deve contenere la quota verticale ancorata al
// bordo destro della cella (theme.freccia.testa) + lo spacing prima dell'etichetta
// (theme.freccia.labelGap) + la larghezza dell'etichetta stessa (stimata su un valore tipo
// "999,9 cm", 8 caratteri, con il rapporto em/carattere calibrato in theme.testo.larghezzaCarattereEm
// alla dimensione font theme.testo.etichetta) — altrimenti l'etichetta invade la cella successiva.
const CELLE_LABEL_WIDTH_STIMATA = Math.ceil(8 * theme.testo.larghezzaCarattereEm * theme.testo.etichetta)
const CELLE_GUTTER = theme.freccia.testa + theme.freccia.labelGap + CELLE_LABEL_WIDTH_STIMATA

export interface CelleProdottiOpts {
  marginX?: number
  y?: number
  height?: number
  gutter?: number
}

/**
 * Calcola N rettangoli (box-foto) disposti in riga per la parte alta di una scheda "set".
 * Pura e deterministica: nessuna dipendenza da DB/rete, stesso input → stesso output.
 * Tutte le celle stanno dentro il canvas 1000×1000, hanno larghezza uguale, x crescente da
 * sinistra a destra, e sono separate da un gutter sufficiente per la quota verticale + etichetta
 * di una cella senza invadere la successiva (vedi costanti sopra).
 *
 * @throws {Error} se `n` è troppo grande per il canvas con i margini/gutter correnti (width
 * risultante <= 0). Con le costanti di default (marginX=40, gutter=135) questo scatta a partire
 * da n=8 (n=7 produce ancora width>0, circa 15px).
 */
export function celleProdotti(
  n: number,
  opts?: CelleProdottiOpts,
): { x: number; y: number; width: number; height: number }[] {
  if (n <= 0) return []
  const marginX = opts?.marginX ?? CELLE_MARGIN_X
  const y = opts?.y ?? CELLE_Y
  const height = opts?.height ?? CELLE_HEIGHT
  const gutter = opts?.gutter ?? CELLE_GUTTER
  const canvasWidth = 1000
  const larghezzaDisponibile = canvasWidth - marginX * 2 - gutter * (n - 1)
  const width = Math.floor(larghezzaDisponibile / n)
  if (width <= 0) {
    throw new Error(`celleProdotti: n=${n} troppo grande per il canvas con i margini/gutter correnti`)
  }
  const out: { x: number; y: number; width: number; height: number }[] = []
  for (let i = 0; i < n; i++) {
    out.push({ x: marginX + i * (width + gutter), y, width, height })
  }
  return out
}

// --- grigliaPositions --------------------------------------------------------------------
// Costanti locali per la griglia di icone-feature nella parte bassa di una scheda "set".
// Riusa lo stile dell'elemento 'icona-label' (cerchio + etichetta a destra, vedi svg.ts) ma
// disposto su più colonne invece che in colonna verticale come colonnaPositions.
// Valori scelti ragionevolmente ora, da tarare nel Task 4 sul confronto con il render reale/golden.
const GRIGLIA_COLS = 3
const GRIGLIA_MARGIN_X = 40 // coerente con CELLE_MARGIN_X, per allineamento verticale dei bordi tra le due zone
// Passo orizzontale tra i bordi-sinistri (x) di due colonne: deve contenere il cerchio
// (diametro = theme.icona.raggio*2) + theme.margini.labelGap + una etichetta breve.
// Con 3 colonne su 1000px questo lascia ~190-260px di etichetta per colonna (sufficiente per
// etichette brevi come quelle del dizionario feature; etichette lunghe vanno a capo via
// spezzaEtichetta, già gestito dal renderer).
const GRIGLIA_COL_GAP = 300
const GRIGLIA_ROW_GAP = theme.margini.colonnaGap // stesso passo verticale usato in colonnaPositions
const GRIGLIA_START_Y = 620 // sotto la zona-foto di celleProdotti (default y=120, height=420 → bottom 540) + margine

export interface GrigliaPositionsOpts {
  cols?: number
  marginX?: number
  startY?: number
  colGap?: number
  rowGap?: number
}

/**
 * Calcola le posizioni (Punto[]) di n icone-feature disposte in griglia a `cols` colonne
 * (righe = ⌈n/cols⌉), per la parte bassa di una scheda "set", sotto la riga di foto.
 * Pura e deterministica. Ogni Punto è l'ancora x,y dell'elemento 'icona-label' (bordo
 * sinistro del cerchio), stessa semantica di colonnaPositions.
 */
export function grigliaPositions(n: number, opts?: GrigliaPositionsOpts): Punto[] {
  if (n <= 0) return []
  const cols = opts?.cols ?? GRIGLIA_COLS
  const marginX = opts?.marginX ?? GRIGLIA_MARGIN_X
  const startY = opts?.startY ?? GRIGLIA_START_Y
  const colGap = opts?.colGap ?? GRIGLIA_COL_GAP
  const rowGap = opts?.rowGap ?? GRIGLIA_ROW_GAP
  const out: Punto[] = []
  for (let i = 0; i < n; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    out.push({ x: marginX + col * colGap, y: startY + row * rowGap })
  }
  return out
}

export function colonnaPositions(n: number, startY: number): Punto[] {
  const out: Punto[] = []
  for (let i = 0; i < n; i++) {
    out.push({ x: theme.margini.colonnaX, y: startY + i * theme.margini.colonnaGap })
  }
  return out
}

export function fitFoto(
  bbox: { width: number; height: number },
  box: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const scala = Math.min(box.width / bbox.width, box.height / bbox.height)
  const width = Math.round(bbox.width * scala)
  const height = Math.round(bbox.height * scala)
  const x = box.x + Math.round((box.width - width) / 2)
  const y = box.y + Math.round((box.height - height) / 2)
  return { x, y, width, height }
}

/** Formatta un numero come "84,5 cm" (virgola decimale italiana, no zeri inutili). */
function cm(v: number): string {
  return `${String(v).replace('.', ',')} cm`
}

export function quoteFromBBox(
  fotoBox: { x: number; y: number; width: number; height: number },
  dim: { larghezza: number | null; profondita: number | null; altezza: number | null },
): QuotaSpec[] {
  const out: QuotaSpec[] = []
  const destraX = fotoBox.x + fotoBox.width + theme.freccia.testa
  const sottoY = fotoBox.y + fotoBox.height + theme.freccia.testa

  if (dim.altezza !== null) {
    out.push({
      orientamento: 'verticale',
      valore: cm(dim.altezza),
      x1: destraX,
      y1: fotoBox.y,
      x2: destraX,
      y2: fotoBox.y + fotoBox.height,
    })
  }
  if (dim.larghezza !== null) {
    out.push({
      orientamento: 'orizzontale',
      valore: cm(dim.larghezza),
      x1: fotoBox.x,
      y1: sottoY,
      x2: fotoBox.x + fotoBox.width,
      y2: sottoY,
    })
  }
  if (dim.profondita !== null) {
    const cornerX = fotoBox.x + fotoBox.width
    const cornerY = fotoBox.y + fotoBox.height
    // Come verticale/orizzontale, il punto di partenza è spostato di `testa` dal bordo/corner
    // della foto (non il corner grezzo): altrimenti il trattino perpendicolare di questa quota
    // si sovrappone a quello della quota orizzontale, che ancora il proprio estremo alla stessa
    // X, solo `testa` px più sotto.
    out.push({
      orientamento: 'diagonale',
      valore: cm(dim.profondita),
      x1: cornerX + theme.freccia.testa,
      y1: cornerY + theme.freccia.testa,
      x2: cornerX + theme.freccia.testa * 3,
      y2: cornerY + theme.freccia.testa * 3,
    })
  }
  return out
}
