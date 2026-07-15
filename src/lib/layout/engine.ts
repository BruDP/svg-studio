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
// Lunghezza fissa del segmento diagonale (deve restare allineata a `lunghezza` in quoteFromBBox).
const CELLE_DIAG_LUNGHEZZA = theme.freccia.testa * 2
// Spazio riservato a DESTRA dell'ultima cella. A differenza dei gutter interni (che contengono la
// sola etichetta della quota verticale della cella successiva, ancorata a bordo+testa), qui
// l'elemento più a destra è l'etichetta della quota DIAGONALE (profondità): parte più a destra
// della verticale, a (distanzaDiagonale + lunghezza)·cos(inclinazioneProfonditaDeg) oltre il bordo
// cella, poi labelGap + larghezza etichetta stimata. Senza questa riserva la profondità (e la sua
// etichetta) dell'ultimo pezzo di un set uscivano dal canvas — bug reale su 5926962/2188908.
const CELLE_RIGHT_RESERVE = Math.ceil(
  (theme.freccia.distanzaDiagonale + CELLE_DIAG_LUNGHEZZA) *
    Math.cos((theme.freccia.inclinazioneProfonditaDeg * Math.PI) / 180) +
    theme.freccia.labelGap +
    CELLE_LABEL_WIDTH_STIMATA,
)

export interface CelleProdottiOpts {
  marginX?: number
  y?: number
  height?: number
  gutter?: number
  rightReserve?: number
}

/**
 * Calcola N rettangoli (box-foto) disposti in riga per la parte alta di una scheda "set".
 * Pura e deterministica: nessuna dipendenza da DB/rete, stesso input → stesso output.
 * Tutte le celle stanno dentro il canvas 1000×1000, hanno larghezza uguale, x crescente da
 * sinistra a destra, e sono separate da un gutter sufficiente per la quota verticale + etichetta
 * di una cella senza invadere la successiva (vedi costanti sopra).
 *
 * @throws {Error} se `n` è troppo grande per il canvas con i margini/gutter/rightReserve correnti
 * (width risultante <= 0). Con le costanti di default (marginX=40, gutter=135,
 * rightReserve=171) questo scatta a partire da n=7 (n=6 produce ancora width>0, circa 19px);
 * non è un problema per i set reali, che hanno al più 3-4 pezzi.
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
  const rightReserve = opts?.rightReserve ?? CELLE_RIGHT_RESERVE
  const canvasWidth = 1000
  const larghezzaDisponibile = canvasWidth - marginX - rightReserve - gutter * (n - 1)
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
  const cornerX = fotoBox.x + fotoBox.width
  const cornerY = fotoBox.y + fotoBox.height
  const sottoY = cornerY + theme.freccia.testa
  // Estensione verticale della linea larghezza dovuta all'inclinazione: l'estremo sinistro sale,
  // quello destro scende, centrati su sottoY (la spaziatura del layout attorno a sottoY non cambia).
  const dyLarghezza = fotoBox.width * Math.tan((theme.freccia.inclinazioneLarghezzaDeg * Math.PI) / 180)
  // Punto da cui continua la profondità: l'estremo destro (più basso) della larghezza, per dare
  // l'impressione di un'unica linea di base che piega verso la profondità, non due segmenti scollegati.
  const baseProfonditaY = sottoY + dyLarghezza / 2

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
      y1: sottoY - dyLarghezza / 2,
      x2: cornerX,
      y2: sottoY + dyLarghezza / 2,
    })
  }
  if (dim.profondita !== null) {
    const ang = (theme.freccia.inclinazioneProfonditaDeg * Math.PI) / 180
    const lunghezza = theme.freccia.testa * 2
    // Il punto di partenza è spostato di `distanzaDiagonale` (lungo l'angolo di profondità)
    // dal corner/estremo larghezza: uno stacco visibile, non un punto di continuità, come nelle
    // schede di riferimento dove le due frecce sono disegnate separate.
    const distanza = theme.freccia.distanzaDiagonale
    out.push({
      orientamento: 'diagonale',
      valore: cm(dim.profondita),
      x1: cornerX + distanza * Math.cos(ang),
      y1: baseProfonditaY + distanza * Math.sin(ang),
      x2: cornerX + (distanza + lunghezza) * Math.cos(ang),
      y2: baseProfonditaY + (distanza + lunghezza) * Math.sin(ang),
    })
  }
  return out
}
