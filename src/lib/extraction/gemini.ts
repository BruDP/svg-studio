import { GoogleGenAI, Type } from '@google/genai'
import type { Dictionary } from '@/lib/dictionary/types'
import type { ProductRecord } from '@/lib/feed/types'
import type { RawExtraction } from './types'

export function buildResponseSchema(dict: Dictionary) {
  return {
    type: Type.OBJECT,
    required: ['categoria', 'features'],
    properties: {
      categoria: { type: Type.STRING, enum: dict.categorie },
      features: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ['chiave', 'valore', 'testoSorgente'],
          properties: {
            chiave: { type: Type.STRING, enum: Object.keys(dict.features).sort() },
            valore: { type: Type.STRING, nullable: true },
            testoSorgente: { type: Type.STRING },
          },
        },
      },
    },
  }
}

export function buildPrompt(product: ProductRecord, dict: Dictionary): string {
  const featureList = Object.entries(dict.features)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, f]) => `- ${key}: ${f.label} (valore ${f.valore})`)
    .join('\n')

  return [
    'Sei un classificatore di schede tecniche prodotto. Analizza il testo e individua SOLO le feature',
    'presenti nell elenco chiavi qui sotto che il testo dimostra esplicitamente.',
    'Regole: NON inventare valori. "valore" va compilato solo per le chiavi con valore obbligatorio,',
    'copiando il numero/dato esattamente come scritto nel testo. "testoSorgente" è la frase esatta',
    'del testo da cui hai dedotto la feature. Indica anche la categoria del prodotto.',
    '',
    'CHIAVI AMMESSE:',
    featureList,
    '',
    'TESTO PRODOTTO:',
    `Descrizione: ${product.descrizioneBreve}`,
    `Dettaglio: ${product.descrizioneEstesa}`,
    'Nota tecnica:',
    ...product.notaTecnica.map((l) => `- ${l}`),
  ].join('\n')
}

async function defaultGenerate(prompt: string, dict: Dictionary): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY non impostata (usa .env.local)')
  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0,
      seed: 1,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(dict),
    },
  })
  return res.text ?? ''
}

export async function extractRaw(
  product: ProductRecord,
  dict: Dictionary,
  generate: (prompt: string, dict: Dictionary) => Promise<string> = defaultGenerate,
): Promise<RawExtraction> {
  const prompt = buildPrompt(product, dict)
  const jsonText = await generate(prompt, dict)
  return JSON.parse(jsonText) as RawExtraction
}
