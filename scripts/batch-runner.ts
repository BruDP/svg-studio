#!/usr/bin/env node
import 'dotenv/config'

// Verifica GEMINI_API_KEY
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY non impostato.')
  console.error('Usa: GEMINI_API_KEY="..." npm run batch -- --limit N')
  process.exit(1)
}

import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct, searchProducts } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { inScopeAltoValore } from '@/lib/branding/selezione'
import { db } from '@/lib/db'
import { extractProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from './compose-lib'
import { renderSceneServer } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'

const args = process.argv.slice(2)
const limit = parseInt(args[args.indexOf('--limit') + 1] || '10000', 10)
const force = args.includes('--force')

async function main() {
  console.log(`🚀 Batch runner: limit=${limit}, force=${force}`)
  await refreshFeedIfStale({})
  const dict = loadDictionary()

  // Seleziona target ad alto valore (tutti i prodotti del DB)
  const allProducts = await db.product.findMany({ take: 10000 })
  console.log(`🔍 Prodotti totali nel DB: ${allProducts.length}`)
  const target: string[] = []
  for (const row of allProducts) {
    const product = JSON.parse(row.payload)
    if (inScopeAltoValore(product.descrizioneBreve, product.marchio)) {
      target.push(row.sku)
      if (target.length >= limit) break
    }
  }
  console.log(`📦 Target trovati: ${target.length}`)

  let generated = 0,
    skipped = 0,
    errors = 0,
    costUsd = 0

  const costStart = await getTotalCost()
  for (const sku of target) {
    try {
      const existing = await db.scene.findUnique({ where: { sku } })
      if (existing && !force) {
        skipped++
        continue
      }

      const product = await getProduct(sku)
      if (!product) throw new Error('non trovato')

      const proposal = await extractProposal(product, dict)
      const { scene } = await composeSceneForProduct({ proposal, product })
      const svg = await renderSceneServer(scene)
      await exportScene({ svg, sku })

      console.log(`✅ ${sku}`)
      generated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ ${sku}: ${msg.slice(0, 80)}`)
      errors++
    }
  }
  costUsd = (await getTotalCost()) - costStart

  console.log(`\n✅ ${generated} | ⏭️ ${skipped} | ❌ ${errors} | 💰 $${costUsd.toFixed(4)}`)
  process.exit(errors > 0 ? 1 : 0)
}

async function getTotalCost() {
  const logs = await db.costLog.findMany()
  return logs.reduce((sum: number, log: any) => sum + log.costUsd, 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
