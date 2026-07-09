import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Prisma 7: l'URL di connessione non sta più nello schema (datasource senza `url`);
// per i comandi Migrate/Introspect va qui. A runtime la connessione è fornita dal
// driver adapter in src/lib/db.ts. Carico .env/.env.local come fanno gli script.
config({ path: path.resolve(process.cwd(), '.env') })
config({ path: path.resolve(process.cwd(), '.env.local') })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
})
