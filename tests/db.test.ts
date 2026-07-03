import { afterAll, expect, test } from 'vitest'
import { db } from '@/lib/db'

afterAll(async () => {
  await db.product.deleteMany({ where: { sku: 'TEST-SKU' } })
  await db.$disconnect()
})

test('upsert e lettura Product', async () => {
  await db.product.upsert({
    where: { sku: 'TEST-SKU' },
    create: { sku: 'TEST-SKU', payload: '{}', rowHash: 'x', searchText: 'test-sku' },
    update: { payload: '{}' },
  })
  const found = await db.product.findUnique({ where: { sku: 'TEST-SKU' } })
  expect(found?.rowHash).toBe('x')
})
