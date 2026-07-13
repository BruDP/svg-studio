import sharp from 'sharp'
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'
import type { Scene } from '@/lib/scene/types'
import { cacheImage, readCachedImage, writeImageBytes } from '@/lib/images/cache'
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

  // Ritaglio sul bounding box del prodotto: il prodotto riempie il riquadro foto (più grande,
  // niente margini bianchi) e le frecce-quota, ancorate al riquadro, combaciano con la sua
  // estensione reale. Se il bbox non è rilevabile (foto lifestyle) si usa l'immagine intera.
  let imageHash = cached.hash
  let bbox: { width: number; height: number } | null = null
  if (box) {
    const cropped = await sharp(bytes)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .png()
      .toBuffer()
    imageHash = writeImageBytes(cropped, input.deps?.dir).hash
    bbox = { width: box.width, height: box.height }
  }

  const scene = composeColonnaSinistra({ proposal, imageHash, bbox })
  return { scene, imageHash }
}
