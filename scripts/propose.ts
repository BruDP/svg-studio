import { config } from 'dotenv'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env')
const envLocalPath = resolve(process.cwd(), '.env.local')

config({ path: envPath })
config({ path: envLocalPath })

async function main() {
  const { db } = await import('@/lib/db')
  const { refreshFeedIfStale } = await import('@/lib/feed/fetcher')
  const { getProduct } = await import('@/lib/feed/repository')
  const { loadDictionary } = await import('@/lib/dictionary/loader')
  const { extractProposal } = await import('@/lib/extraction/engine')

  const sku = process.argv[2]
  if (!sku) {
    console.error('Uso: npm run propose -- <SKU>')
    process.exit(1)
  }

  const { refreshed } = await refreshFeedIfStale()
  console.error(refreshed ? 'Feed scaricato e indicizzato.' : 'Feed locale recente, nessun download.')

  const product = await getProduct(sku)
  if (!product) {
    console.error(`SKU ${sku} non trovato nel feed.`)
    process.exit(2)
  }

  const proposal = await extractProposal(product, loadDictionary())
  console.log(JSON.stringify(proposal, null, 2))
  await db.$disconnect()
}

main()
