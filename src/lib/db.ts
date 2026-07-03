import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const databaseUrl = process.env.DATABASE_URL || 'file:./data/svg-studio.db'

export const db = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: databaseUrl,
  }),
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
