export interface IconifyCandidate {
  id: string
  set: string
  name: string
}

/**
 * Set line-art a licenza permissiva (Spec §7).
 * Nota: il renderer avvolge le icone come line-art a stroke (`<g fill="none" stroke=...>`),
 * quindi vanno approvati solo glifi basati su stroke. "solar" include anche alcuni glifi
 * basati su fill, che risulterebbero invisibili finché non arriva il supporto fill-icon
 * in una fase successiva.
 */
export const ICONIFY_SETS = ['tabler', 'lucide', 'solar'] as const

const SEARCH_BASE = 'https://api.iconify.design/search'
const SVG_BASE = 'https://api.iconify.design'

async function defaultFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Iconify search fallita: HTTP ${res.status}`)
  return res.json()
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Iconify SVG fallito: HTTP ${res.status}`)
  return res.text()
}

export async function searchIconify(
  q: string,
  deps: { fetchJson?: (url: string) => Promise<unknown> } = {},
): Promise<IconifyCandidate[]> {
  const fetchJson = deps.fetchJson ?? defaultFetchJson
  const prefixes = ICONIFY_SETS.join(',')
  const url = `${SEARCH_BASE}?query=${encodeURIComponent(q)}&prefixes=${prefixes}&limit=32`
  const data = (await fetchJson(url)) as { icons?: string[] }
  const allowed = new Set<string>(ICONIFY_SETS)
  const out: IconifyCandidate[] = []
  for (const id of data.icons ?? []) {
    const [set, name] = id.split(':')
    if (!name || !allowed.has(set)) continue
    out.push({ id, set, name })
  }
  return out
}

export async function fetchIconifySvg(
  id: string,
  deps: { fetchText?: (url: string) => Promise<string> } = {},
): Promise<string> {
  const fetchText = deps.fetchText ?? defaultFetchText
  const [set, name] = id.split(':')
  if (!name) throw new Error(`Id icona non valido: "${id}" (atteso "set:name")`)
  return fetchText(`${SVG_BASE}/${set}/${name}.svg`)
}
