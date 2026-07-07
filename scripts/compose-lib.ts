import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'
import type { Scene } from '@/lib/scene/types'
import { cacheImage, readCachedImage } from '@/lib/images/cache'
import { detectBBox } from '@/lib/images/bbox'
import { composeColonnaSinistra } from '@/lib/layout/colonna-sinistra'

export async function composeSceneForProduct(input: {
  proposal: SchedaProposal
  product: ProductRecord
  deps?: { download?: (url: string) => Promise<Buffer>; dir?: string }
}): Promise<{ scene: Scene; imageHash: string }> {
  const { proposal, product } = input
  const url = product.images[0]
  if (!url) throw new Error(`Prodotto ${product.sku} senza immagini nel feed`)

  const cached = await cacheImage(url, input.deps)
  const bytes = readCachedImage(cached.hash, cached.ext, input.deps?.dir)
  const box = await detectBBox(bytes)
  const bbox = box ? { width: box.width, height: box.height } : null

  const scene = composeColonnaSinistra({ proposal, imageHash: cached.hash, bbox })
  return { scene, imageHash: cached.hash }
}
