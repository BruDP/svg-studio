import { db } from '@/lib/db'
import { normalizeIconSvg } from './normalize'

export interface IconRecord {
  key: string
  svg: string
  source: string
  license: string
  status: 'approvata' | 'in-revisione'
}

function toRecord(row: { key: string; svg: string; source: string; license: string; status: string }): IconRecord {
  return { key: row.key, svg: row.svg, source: row.source, license: row.license, status: row.status as IconRecord['status'] }
}

export async function saveIcon(rec: {
  key: string
  rawSvg: string
  source: string
  license: string
}): Promise<IconRecord> {
  const svg = normalizeIconSvg(rec.rawSvg)
  const data = { svg, source: rec.source, license: rec.license, status: 'in-revisione' }
  const row = await db.icon.upsert({
    where: { key: rec.key },
    create: { key: rec.key, ...data },
    update: data,
  })
  return toRecord(row)
}

export async function approveIcon(key: string): Promise<void> {
  await db.icon.update({ where: { key }, data: { status: 'approvata' } })
}

export async function getApprovedIcon(key: string): Promise<IconRecord | null> {
  const row = await db.icon.findUnique({ where: { key } })
  return row && row.status === 'approvata' ? toRecord(row) : null
}

export async function getIcon(key: string): Promise<IconRecord | null> {
  const row = await db.icon.findUnique({ where: { key } })
  return row ? toRecord(row) : null
}

export async function listIcons(): Promise<IconRecord[]> {
  const rows = await db.icon.findMany({ orderBy: { key: 'asc' } })
  return rows.map(toRecord)
}
