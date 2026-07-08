import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { config } from 'dotenv'

// Eseguito come processo Node/tsx separato (invocato da global-setup.ts): il transform
// esbuild interno di Playwright rompe la risoluzione dei binding nativi di better-sqlite3
// (il pacchetto "bindings" ispeziona lo stack per trovare il node_modules chiamante).
// Girando qui sotto tsx puro, come già fanno gli script in scripts/, l'ambiente Node è quello
// normale e better-sqlite3 carica correttamente.
config({ path: path.resolve(process.cwd(), '.env') })
config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const record = JSON.parse(readFileSync(path.resolve('e2e/fixtures/prodotto-2137070.json'), 'utf8'))
  const payload = JSON.stringify(record)
  const rowHash = createHash('sha256').update(payload).digest('hex')
  const searchText = `${record.sku} ${record.descrizioneBreve}`.toLowerCase()
  await db.product.upsert({
    where: { sku: record.sku },
    create: { sku: record.sku, payload, rowHash, searchText },
    update: { payload, rowHash, searchText },
  })
  // FeedMeta recente → refreshFeedIfStale salta il download nel modo finto
  await db.feedMeta.create({ data: { sourceHash: 'e2e' } })
  // Pulizia db.scene: il test "salva e riprendi" scrive una scena modificata per lo SKU di
  // fixture; senza questa pulizia una scena salvata da un'esecuzione precedente resta nel DB
  // (sqlite persiste su disco tra esecuzioni di `npm run e2e`) e rende i run non ripetibili
  // in modo verificabile. Girando in global-setup, la pulizia avviene una sola volta per run.
  await db.scene.deleteMany()
  await db.$disconnect()
}

main()
