import { defineConfig } from 'vitest/config'
import path from 'node:path'

// DB di test ISOLATO: i test non devono mai toccare il DB di sviluppo (data/svg-studio.db),
// perché fanno deleteMany su product/feedMeta/icon. Lo schema viene creato fresco a ogni run
// dal globalSetup (tests/global-setup-db.ts) applicando le migration SQL.
const TEST_DATABASE_URL = 'file:./data/test.db'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // fileParallelism: false — i test condividono il file SQLite del test DB:
  // l'esecuzione parallela dei file di test causerebbe race condition sul DB.
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    fileParallelism: false,
    globalSetup: './tests/global-setup-db.ts',
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
})
