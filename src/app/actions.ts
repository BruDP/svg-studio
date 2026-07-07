'use server'

import sharp from 'sharp'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from '../../scripts/compose-lib'
import { renderSceneServer } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import type { ProposeResult } from '@/lib/ui/types'
import { isFake, fakeGenerate, fakeDownload } from '@/lib/testing/fake'

export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(s)
  if (!product) throw new Error(`SKU ${s} non trovato nel feed`)

  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, loadDictionary(), generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

  const svg = await renderSceneServer(scene)
  return {
    scene,
    svg,
    prodotto: { sku: product.sku, descrizioneBreve: product.descrizioneBreve },
  }
}

export async function exportSceneAction(sceneJson: string): Promise<{ path: string; thumbDataUri: string }> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  const svg = await renderSceneServer(scene)
  const path = await exportScene({ svg, sku: scene.sku })
  const thumb = await sharp(path).resize(240, 240).jpeg({ quality: 80 }).toBuffer()
  return { path, thumbDataUri: `data:image/jpeg;base64,${thumb.toString('base64')}` }
}
