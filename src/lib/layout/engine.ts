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
