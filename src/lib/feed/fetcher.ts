import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { parseFeed } from './parser'

export const FEED_URL = 'https://www.satur.it/amfeed/feed/download?id=27&file=products.csv.csv'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

async function defaultDownload(): Promise<string> {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`Download feed fallito: HTTP ${res.status}`)
  return res.text()
}

export async function refreshFeedIfStale(
  deps: { download?: () => Promise<string> } = {},
): Promise<{ refreshed: boolean }> {
  const download = deps.download ?? defaultDownload
  const last = await db.feedMeta.findFirst({ orderBy: { downloadedAt: 'desc' } })
  if (last && Date.now() - last.downloadedAt.getTime() < MAX_AGE_MS) {
    return { refreshed: false }
  }

  const csvText = await download()
  const sourceHash = createHash('sha256').update(csvText).digest('hex')
  const records = parseFeed(csvText)

  for (const rec of records) {
    const payload = JSON.stringify(rec)
    const rowHash = createHash('sha256').update(payload).digest('hex')
    const searchText = `${rec.sku} ${rec.descrizioneBreve}`.toLowerCase()
    await db.product.upsert({
      where: { sku: rec.sku },
      create: { sku: rec.sku, payload, rowHash, searchText },
      update: { payload, rowHash, searchText },
    })
  }
  await db.feedMeta.create({ data: { sourceHash } })
  return { refreshed: true }
}
