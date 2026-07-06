import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { saveIcon, approveIcon, getApprovedIcon, getIcon, listIcons } from '@/lib/icons/repository'

const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M1 1h10"/></svg>'

beforeEach(async () => {
  await db.icon.deleteMany()
})
afterAll(async () => {
  await db.icon.deleteMany()
  await db.$disconnect()
})

describe('repository icone', () => {
  it('saveIcon normalizza e salva come in-revisione', async () => {
    const rec = await saveIcon({ key: 'materiale_acciaio', rawSvg, source: 'iconify:tabler', license: 'MIT' })
    expect(rec.status).toBe('in-revisione')
    expect(rec.svg).toMatch(/stroke="currentColor"/)
    expect(rec.svg).toMatch(/M1 1h10/)
  })

  it('getApprovedIcon non restituisce icone in revisione', async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    expect(await getApprovedIcon('k1')).toBeNull()
    expect(await getIcon('k1')).not.toBeNull()
  })

  it("approveIcon rende l'icona recuperabile da getApprovedIcon", async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    await approveIcon('k1')
    const rec = await getApprovedIcon('k1')
    expect(rec?.status).toBe('approvata')
  })

  it('saveIcon su chiave esistente aggiorna e riporta a in-revisione', async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    await approveIcon('k1')
    await saveIcon({ key: 'k1', rawSvg, source: 's2', license: 'l' })
    expect((await getIcon('k1'))?.status).toBe('in-revisione')
  })

  it('listIcons ordina per chiave', async () => {
    await saveIcon({ key: 'b', rawSvg, source: 's', license: 'l' })
    await saveIcon({ key: 'a', rawSvg, source: 's', license: 'l' })
    expect((await listIcons()).map((i) => i.key)).toEqual(['a', 'b'])
  })
})
