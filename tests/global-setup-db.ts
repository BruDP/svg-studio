import Database from 'better-sqlite3'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Setup globale dei test unit: crea un DB SQLite ISOLATO (`data/test.db`) con lo schema
 * fresco a ogni run, applicando le migration SQL versionate. Così i test — che fanno
 * `deleteMany` in beforeEach — non toccano mai il DB di sviluppo (`data/svg-studio.db`).
 *
 * Non si usa la CLI Prisma per migrare: in Prisma 7 `url` non è più ammessa nello schema
 * (servirebbe `prisma.config.ts`) e il runtime passa comunque l'url via adapter. Qui basta
 * eseguire la DDL delle migration direttamente. `DATABASE_URL` per i worker dei test è
 * impostata a `file:./data/test.db` in `vitest.config.ts`.
 */
export default function setup(): void {
  const dbPath = path.resolve(process.cwd(), 'data', 'test.db')
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true })
  }
  const db = new Database(dbPath)
  const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations')
  const dirs = readdirSync(migrationsDir)
    .filter((d) => /^\d/.test(d))
    .sort() // prefisso timestamp → ordine cronologico
  for (const d of dirs) {
    db.exec(readFileSync(path.join(migrationsDir, d, 'migration.sql'), 'utf8'))
  }
  db.close()
}
