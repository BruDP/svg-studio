import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    // fileParallelism: false — i test condividono il file SQLite data/svg-studio.db:
    // l'esecuzione parallela dei file di test causerebbe race condition sul DB.
    test: {
      include: ['tests/**/*.test.ts'],
      fileParallelism: false,
      env: {
        DATABASE_URL: env.DATABASE_URL,
      },
    },
  }
})
