'use server'

import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from '../../scripts/compose-lib'
import { resolveRenderBundle, resolveIconsForKeys, renderSceneServer } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import type { ProposeResult } from '@/lib/ui/types'
import { isFake, fakeGenerate, fakeDownload } from '@/lib/testing/fake'
import { db } from '@/lib/db'

export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(s)
  if (!product) throw new Error(`SKU ${s} non trovato nel feed`)

  const dict = loadDictionary()
  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, dict, generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

  // icone per TUTTE le feature applicabili alla categoria (così "aggiungi" ha già l'icona)
  const applicabili = Object.entries(dict.features)
    .filter(([, def]) => def.categorie.includes(proposal.categoria))
    .map(([chiave, def]) => ({ chiave, etichetta: def.label.replace('{valore}', '').trim() }))
  const bundle = await resolveRenderBundle(scene)
  const iconMapChiavi = await resolveIconsForKeys(applicabili.map((f) => f.chiave))
  const iconMap = { ...iconMapChiavi, ...bundle.iconMap }

  const salvata = await db.scene.findUnique({ where: { sku: s } })
  return {
    scene,
    iconMap,
    imageDataUri: bundle.imageDataUri,
    prodotto: { sku: product.sku, descrizioneBreve: product.descrizioneBreve },
    categoriaFeatures: applicabili,
    salvataDisponibile: salvata !== null,
  }
}

export async function saveSceneAction(sceneJson: string): Promise<void> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  await db.scene.upsert({
    where: { sku: scene.sku },
    create: { sku: scene.sku, sceneJson: JSON.stringify(scene) },
    update: { sceneJson: JSON.stringify(scene) },
  })
}

export async function loadSceneAction(
  sku: string,
): Promise<{ scene: Scene; iconMap: Record<string, string>; imageDataUri: string | null } | null> {
  const s = (sku ?? '').trim()
  if (!/^[A-Za-z0-9._-]+$/.test(s)) throw new Error('SKU non valido')
  const row = await db.scene.findUnique({ where: { sku: s } })
  if (!row) return null
  const scene: Scene = parseScene(JSON.parse(row.sceneJson))
  const dict = loadDictionary()
  const applicabili = Object.keys(dict.features)
  const bundle = await resolveRenderBundle(scene)
  const iconMapChiavi = await resolveIconsForKeys(applicabili)
  return { scene, iconMap: { ...iconMapChiavi, ...bundle.iconMap }, imageDataUri: bundle.imageDataUri }
}

export async function exportSceneAction(sceneJson: string): Promise<{ path: string; thumbDataUri: string }> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  const svg = await renderSceneServer(scene)
  const path = await exportScene({ svg, sku: scene.sku })
  // Miniatura da Buffer (non da path): su Windows sharp/libvips mmappa il file di input e,
  // nel processo server long-lived, l'handle resta appeso impedendo una successiva
  // sovrascrittura di output/{sku}.jpg (ri-export dello stesso SKU). Leggere i byte evita l'mmap.
  const thumb = await sharp(readFileSync(path)).resize(240, 240).jpeg({ quality: 80 }).toBuffer()
  return { path, thumbDataUri: `data:image/jpeg;base64,${thumb.toString('base64')}` }
}
