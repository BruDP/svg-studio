import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { stableStringify } from '@/lib/stable'
import type { Dictionary } from '@/lib/dictionary/types'
import type { ProductRecord } from '@/lib/feed/types'
import { extractRaw } from './gemini'
import { validateExtraction } from './validator'
import { rankFeatures, type ProposedFeature } from './ranking'
import { parseDimensions, parseSetDimensions, type Dimensioni } from './dimensions'
import { PROMPT_VERSION } from './types'

export interface SottoProdotto {
  gruppo: string
  etichetta: string
  dimensioni: Dimensioni
  badges: ProposedFeature[]
}

export interface SchedaProposal {
  sku: string
  categoria: string
  features: ProposedFeature[]
  badges: ProposedFeature[]
  dimensioni: Dimensioni | null
  sottoProdotti?: SottoProdotto[]
}

// Regola prodotto: sugli specchi non va mostrata la quota di profondità — a differenza di mobili
// e sedute (dove la profondità aiuta a capire l'ingombro), per uno specchio è solo lo spessore
// della cornice, non un dato utile all'acquirente. Nessuna categoria dedicata nel dizionario, si
// rileva dal testo: match ancorato a INIZIO descrizioneBreve sullo stem "specchi" (specchio/
// specchiera/specchi). Ancorato apposta: "Mobile a specchio da bagno" o "Lampada da specchio"
// contengono "specchio" ma NON sono specchi (la profondità del mobile/lampada è un dato reale) —
// un match libero /specchio/ le sbaglierebbe (falsi positivi reali nel feed: 2188413, 5918801).
function nascondiProfonditaSpecchi(product: ProductRecord, dim: Dimensioni | null): Dimensioni | null {
  if (!dim || dim.profondita === null) return dim
  return /^\s*specchi/i.test(product.descrizioneBreve) ? { ...dim, profondita: null } : dim
}

export function computeInputHash(product: ProductRecord, dict: Dictionary): string {
  const material = stableStringify({
    product,
    dictVersion: dict.version,
    dictKeys: Object.keys(dict.features).sort(),
    promptVersion: PROMPT_VERSION,
  })
  return createHash('sha256').update(material).digest('hex')
}

export async function extractProposal(
  product: ProductRecord,
  dict: Dictionary,
  generate?: (prompt: string, dict: Dictionary) => Promise<string>,
): Promise<SchedaProposal> {
  const inputHash = computeInputHash(product, dict)

  const cached = await db.extraction.findUnique({
    where: { sku_inputHash: { sku: product.sku, inputHash } },
  })
  if (cached) return JSON.parse(cached.proposal) as SchedaProposal

  const raw = await extractRaw(product, dict, generate)
  const validated = validateExtraction(raw, product)
  const { features, badges } = rankFeatures(validated, raw.categoria, dict)
  const sotto = parseSetDimensions(product.notaTecnica)

  const proposal: SchedaProposal = {
    sku: product.sku,
    categoria: raw.categoria,
    features,
    badges,
    dimensioni: nascondiProfonditaSpecchi(product, parseDimensions(product.notaTecnica)),
    sottoProdotti: sotto.length >= 2 ? sotto : undefined,
  }

  await db.extraction.create({
    data: { sku: product.sku, inputHash, proposal: JSON.stringify(proposal) },
  })
  return proposal
}
