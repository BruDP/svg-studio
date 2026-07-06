import { db } from '@/lib/db'
import type { ProductRecord } from './types'

export async function getProduct(sku: string): Promise<ProductRecord | null> {
  const row = await db.product.findUnique({ where: { sku } })
  return row ? (JSON.parse(row.payload) as ProductRecord) : null
}

export async function searchProducts(q: string): Promise<{ sku: string; descrizioneBreve: string }[]> {
  const rows = await db.product.findMany({
    where: { searchText: { contains: q.toLowerCase() } },
    take: 20,
    orderBy: { sku: 'asc' },
  })
  return rows.map((r) => {
    const p = JSON.parse(r.payload) as ProductRecord
    return { sku: r.sku, descrizioneBreve: p.descrizioneBreve }
  })
}
