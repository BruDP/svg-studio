/**
 * Normalizzazione del marchio prodotto (campo `marchio` del feed) verso: uno `slug` stabile per
 * cercare il file logo (`assets/loghi/<slug>.png`) e un `display` pulito per il wordmark di ripiego
 * quando il file logo non c'è.
 *
 * Il feed usa SOLO 3 marchi reali nel campo `marchio` (verificato: Galileo 4221, Villa d'Este 2134,
 * Kooper 712). Le "linee" come BestBQ/Esté/FitLover/SìChef vivono nella descrizione, non qui.
 */

function base(m: string): string {
  return (m ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // toglie i diacritici combinanti (é→e)
    .replace(/[®™]/g, '')
    .trim()
    .toLowerCase()
}

function slugify(s: string): string {
  return base(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface MarchioInfo {
  slug: string
  display: string
}

export function marchioInfo(marchio: string): MarchioInfo {
  const b = base(marchio)
  if (b === 'galileo') return { slug: 'galileo', display: 'Galileo' }
  if (b === 'kooper') return { slug: 'kooper', display: 'Kooper' }
  // "Villa d Este Home Tivoli" e varianti → VdE / Villa d'Este
  if (b.startsWith('villa d este') || b === 'vde') return { slug: 'villa-d-este', display: "Villa d'Este" }
  // Fallback generico: slug dallo slugify, display = marchio ripulito.
  return { slug: slugify(marchio) || 'marchio', display: (marchio ?? '').trim() }
}

/** Chiave usata nella imageMap del bundle per il logo di un marchio (riusa il resolver immagini). */
export function chiaveLogo(marchio: string): string {
  return `logo:${marchioInfo(marchio).slug}`
}
