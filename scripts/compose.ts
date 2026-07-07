import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const { refreshFeedIfStale } = await import('@/lib/feed/fetcher')
  const { getProduct } = await import('@/lib/feed/repository')
  const { loadDictionary } = await import('@/lib/dictionary/loader')
  const { extractProposal } = await import('@/lib/extraction/engine')
  const { composeSceneForProduct } = await import('./compose-lib')
  const { renderScene } = await import('@/lib/render/svg')
  const { exportScene } = await import('@/lib/export/raster')
  const { getApprovedIcon } = await import('@/lib/icons/repository')
  const { readCachedImage } = await import('@/lib/images/cache')

  const sku = process.argv[2]
  if (!sku) {
    console.error('Uso: npm run compose -- <SKU>')
    process.exit(1)
  }

  await refreshFeedIfStale()
  const product = await getProduct(sku)
  if (!product) {
    console.error(`SKU ${sku} non trovato nel feed.`)
    process.exit(2)
  }

  const proposal = await extractProposal(product, loadDictionary())
  const { scene, imageHash } = await composeSceneForProduct({ proposal, product })

  await db.scene.upsert({
    where: { sku },
    create: { sku, sceneJson: JSON.stringify(scene) },
    update: { sceneJson: JSON.stringify(scene) },
  })

  // Risolutori: icone approvate dal DB (inner SVG), foto dalla cache come data URI
  const iconCache = new Map<string, string | null>()
  for (const el of scene.elements) {
    if (el.type === 'icona-label' && !iconCache.has(el.chiave)) {
      const rec = await getApprovedIcon(el.chiave)
      // estrai il contenuto interno dell'<svg> normalizzato
      const inner = rec ? rec.svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '') : null
      iconCache.set(el.chiave, inner)
    }
  }

  const haFoto = scene.elements.some((e) => e.type === 'foto')
  let dataUri: string | null = null
  if (haFoto) {
    // ricava l'estensione dal file in cache: prova jpg, poi png, poi webp
    for (const ext of ['jpg', 'png', 'webp']) {
      try {
        const buf = readCachedImage(imageHash, ext)
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        dataUri = `data:${mime};base64,${buf.toString('base64')}`
        break
      } catch {
        // prova la prossima estensione
      }
    }
  }

  const svg = renderScene(scene, {
    icon: (k) => iconCache.get(k) ?? null,
    image: () => dataUri,
  })
  const outPath = await exportScene({ svg, sku })
  console.error(`Scheda esportata: ${outPath}`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
