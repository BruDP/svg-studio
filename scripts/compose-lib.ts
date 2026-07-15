import sharp from 'sharp'
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'
import type { Scene } from '@/lib/scene/types'
import { cacheImage, readCachedImage, writeImageBytes } from '@/lib/images/cache'
import { resolveBBox } from '@/lib/images/resolve-bbox'
import { composeColonnaSinistra } from '@/lib/layout/colonna-sinistra'
import { composeMultiProdotto } from '@/lib/layout/multi-prodotto'

type ComposeDeps = {
  download?: (url: string) => Promise<Buffer>
  dir?: string
  askVision?: (imageBytes: Buffer, mime: string) => Promise<string>
}

/**
 * Cache → resolveBBox → ritaglio sharp per una singola foto. Estratto dal ramo `colonna-sinistra`
 * originale: comportamento identico, byte-per-byte (stessa cache, stesso ordine di operazioni,
 * stesso fallback su bbox non rilevabile), coperto dai test `compose-e2e` esistenti.
 */
async function cropFoto(
  url: string,
  deps: ComposeDeps | undefined,
): Promise<{ imageHash: string; bbox: { width: number; height: number } | null }> {
  const cached = await cacheImage(url, deps)
  const bytes = readCachedImage(cached.hash, cached.ext, deps?.dir)
  const mime = cached.ext === 'jpg' ? 'image/jpeg' : cached.ext === 'webp' ? 'image/webp' : 'image/png'
  const box = await resolveBBox(bytes, cached.hash, { ...deps, mime })

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
    imageHash = writeImageBytes(cropped, deps?.dir).hash
    bbox = { width: box.width, height: box.height }
  }

  return { imageHash, bbox }
}

export async function composeSceneForProduct(input: {
  proposal: SchedaProposal
  product: ProductRecord
  deps?: ComposeDeps
}): Promise<{ scene: Scene; imageHash: string }> {
  const { proposal, product } = input
  const url = product.images[0]
  if (!url) throw new Error(`Prodotto ${product.sku} senza immagini nel feed`)

  if (proposal.sottoProdotti && proposal.sottoProdotti.length >= 2) {
    // Piano A: tutti i gruppi partono da images[0] (stessa immagine ritagliata, riusata per ogni
    // gruppo, nessun costo di rete extra), ma la pipeline crop viene eseguita per ciascun gruppo.
    const fotoPerGruppo: { gruppo: string; imageHash: string; bbox: { width: number; height: number } | null }[] = []
    for (const sp of proposal.sottoProdotti) {
      const { imageHash, bbox } = await cropFoto(url, input.deps)
      fotoPerGruppo.push({ gruppo: sp.gruppo, imageHash, bbox })
    }
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    return { scene, imageHash: fotoPerGruppo[0].imageHash }
  }

  // Ramo prodotto singolo: IDENTICO a oggi.
  const { imageHash, bbox } = await cropFoto(url, input.deps)
  const scene = composeColonnaSinistra({ proposal, imageHash, bbox })
  return { scene, imageHash }
}
