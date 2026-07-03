import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // fileParallelism: false — i test condividono il file SQLite data/svg-studio.db:
  // l'esecuzione parallela dei file di test causerebbe race condition sul DB.
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
})
