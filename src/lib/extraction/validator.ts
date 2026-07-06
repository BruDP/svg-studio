import type { ProductRecord } from '@/lib/feed/types'
import type { RawExtraction, RawFeature } from './types'

export interface ValidatedFeature extends RawFeature {
  verificata: boolean
}

/** Normalizza per il confronto: minuscole, virgola→punto, spazi collassati. */
function norm(s: string): string {
  return s.toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim()
}

function sourceText(product: ProductRecord): string {
  return norm([product.descrizioneBreve, product.descrizioneEstesa, ...product.notaTecnica].join(' \n '))
}

export function validateExtraction(raw: RawExtraction, product: ProductRecord): ValidatedFeature[] {
  const haystack = sourceText(product)
  return raw.features.map((f) => {
    const needle = f.valore !== null ? norm(f.valore) : norm(f.testoSorgente)
    return { ...f, verificata: needle.length > 0 && haystack.includes(needle) }
  })
}
