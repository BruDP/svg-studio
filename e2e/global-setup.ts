import { execSync } from 'node:child_process'

// DB e2e ISOLATO: gli E2E non devono mai toccare il DB di sviluppo (data/svg-studio.db).
// Vale sia per questo processo di globalSetup (che semina/pulisce via subprocessi tsx)
// sia per il dev server avviato da Playwright (webServer.env in playwright.config.ts).
const E2E_DATABASE_URL = 'file:./data/e2e.db'

/**
 * Ricrea lo schema fresco su e2e.db e semina il Product di fixture, forzando il modo
 * finto (offline, deterministico).
 *
 * Sia la creazione dello schema (e2e/reset-db.ts) sia la semina vera e propria
 * (e2e/seed.ts) girano come processi tsx separati: il transform esbuild interno di
 * Playwright rompe la risoluzione dei binding nativi di better-sqlite3 (il pacchetto
 * "bindings" ispeziona lo stack per trovare il node_modules chiamante e si perde dentro
 * il bundler di Playwright). Girare sotto tsx puro, come fanno già gli script in
 * scripts/, evita il problema.
 */
export default async function globalSetup() {
  process.env.DATABASE_URL = E2E_DATABASE_URL
  process.env.SVG_STUDIO_FAKE = '1'
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, SVG_STUDIO_FAKE: '1' }
  execSync('npx tsx e2e/reset-db.ts', { stdio: 'inherit', env })
  execSync('npx tsx e2e/seed.ts', { stdio: 'inherit', env })
}
