import { db } from '@/lib/db'

const RATES = {
  'gemini-2.5-pro': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
  'gemini-vision': { input: 0.0075 / 1_000_000, output: 0.03 / 1_000_000 },
}

export async function logCost(
  sku: string,
  operazione: 'extraction' | 'vision',
  modello: string,
  inputTokens: number,
  outputTokens: number,
) {
  const rate = RATES[modello as keyof typeof RATES] || RATES['gemini-2.5-pro']
  const costUsd = inputTokens * rate.input + outputTokens * rate.output
  await db.costLog.create({
    data: { sku, operazione, modello, inputTokens, outputTokens, costUsd },
  })
  return costUsd
}

export async function getTotalCost(since?: Date) {
  const logs = await db.costLog.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
  })
  return logs.reduce((sum: number, log: any) => sum + log.costUsd, 0)
}

export async function getTotalCostAllTime() {
  const logs = await db.costLog.findMany()
  return logs.reduce((sum: number, log: any) => sum + log.costUsd, 0)
}

export async function getAverageCostPerScheda() {
  const logs = await db.costLog.findMany({
    where: { operazione: 'extraction' },
  })
  const unique = new Set(logs.map((l: any) => l.sku)).size
  const total = logs.reduce((sum: number, l: any) => sum + l.costUsd, 0)
  return unique > 0 ? total / unique : 0
}

export async function estimateCostForN(n: number) {
  const avg = await getAverageCostPerScheda()
  return avg * n
}
