import path from 'node:path'
import { createFreshDb } from '../tests/global-setup-db'

/**
 * Ricrea da zero lo schema del DB e2e (`data/e2e.db`), riusando la stessa logica del DB
 * unit test (`tests/global-setup-db.ts`). Eseguito come processo tsx separato da
 * `e2e/global-setup.ts`: il transform esbuild interno di Playwright rompe la risoluzione
 * dei binding nativi di better-sqlite3 (vedi commento in `e2e/global-setup.ts`), quindi
 * anche la creazione dello schema — non solo la semina — deve girare fuori da quel
 * transform, sotto tsx puro.
 */
createFreshDb(path.resolve(process.cwd(), 'data', 'e2e.db'))
