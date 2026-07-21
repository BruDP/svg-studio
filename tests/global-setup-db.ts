import Database from 'better-sqlite3'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Ricrea da zero lo schema di un DB SQLite al percorso indicato, applicando le migration
 * SQL versionate (in ordine cronologico via prefisso timestamp). Cancella prima gli
 * eventuali file DB/-journal/-wal/-shm esistenti, così ogni run parte da uno schema pulito.
 *
 * Non si usa la CLI Prisma per migrare: in Prisma 7 `url` non è più ammessa nello schema
 * (servirebbe `prisma.config.ts`) e il runtime passa comunque l'url via adapter. Qui basta
 * eseguire la DDL delle migration direttamente.
 *
 * Condivisa tra `tests/global-setup-db.ts` (DB unit test, `data/test.db`) e
 * `e2e/reset-db.ts` (DB e2e, `data/e2e.db`), così i due percorsi di test restano isolati
 * l'uno dall'altro e dal DB di sviluppo (`data/svg-studio.db`) senza duplicare la logica.
 */
export function createFreshDb(dbPath: string): void {
  mkdirSync(path.dirname(dbPath), { recursive: true }) // su un checkout pulito 'data/' non esiste ancora
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

/**
 * Setup globale dei test unit: crea il DB SQLite ISOLATO (`data/test.db`) con lo schema
 * fresco a ogni run. Così i test — che fanno `deleteMany` in beforeEach — non toccano mai
 * il DB di sviluppo (`data/svg-studio.db`). `DATABASE_URL` per i worker dei test è
 * impostata a `file:./data/test.db` in `vitest.config.ts`.
 */
export default function setup(): void {
  createFreshDb(path.resolve(process.cwd(), 'data', 'test.db'))
}
