import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { db } from '@/lib/db'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct, searchProducts } from '@/lib/feed/repository'

const csv = readFileSync('tests/fixtures/feed-sample.csv', 'utf8')
const fakeDownload = async () => csv

beforeAll(async () => {
  await db.feedMeta.deleteMany()
  await db.product.deleteMany()
})

afterAll(async () => {
  await db.feedMeta.deleteMany()
  await db.product.deleteMany()
  await db.$disconnect()
})

test('primo avvio: scarica e indicizza', async () => {
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(true)
  expect(await db.product.count()).toBe(2)
})

test('entro 24h non riscarica', async () => {
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(false)
})

test('dopo 24h riscarica', async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
  await db.feedMeta.updateMany({ data: { downloadedAt: old } })
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(true)
})

test('getProduct restituisce il record parsato', async () => {
  const p = await getProduct('2137070')
  expect(p?.notaTecnica).toContain('Alimentazione a carbonella')
  expect(await getProduct('MANCANTE')).toBeNull()
})

test('searchProducts cerca per testo, case-insensitive', async () => {
  const hits = await searchProducts('BARBECUE')
  expect(hits.map((h) => h.sku)).toEqual(['2137070'])
})
