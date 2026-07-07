import { execSync } from 'node:child_process'

/**
 * Semina il Product di fixture nel DB e forza il modo finto (offline, deterministico).
 *
 * La semina vera e propria vive in e2e/seed.ts ed è lanciata come processo tsx separato:
 * il transform esbuild interno di Playwright rompe la risoluzione dei binding nativi di
 * better-sqlite3 (il pacchetto "bindings" ispeziona lo stack per trovare il node_modules
 * chiamante e si perde dentro il bundler di Playwright). Girare la semina sotto tsx puro,
 * come fanno già gli script in scripts/, evita il problema.
 */
export default async function globalSetup() {
  process.env.SVG_STUDIO_FAKE = '1'
  execSync('npx tsx e2e/seed.ts', { stdio: 'inherit' })
}
