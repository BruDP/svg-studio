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
    'Sei un classificatore di schede tecniche prodotto. Analizza il testo (descrizione, dettaglio, nota',
    'tecnica) ed estrai in modo ESAUSTIVO TUTTE le feature dell elenco chiavi qui sotto che il testo',
    'supporta: non fermarti alle più ovvie, includi ogni caratteristica verificabile. Punta a un elenco',
    'ricco, idealmente 6 o più feature quando il testo lo consente.',
    'Regole ANTI-INVENZIONE (prioritarie): includi una feature SOLO se il testo la dimostra; se non',
    'esiste una frase di supporto, NON includerla (meglio meno feature che una inventata). NON inventare',
    'valori: "valore" va compilato solo per le chiavi con valore obbligatorio, copiando il numero/dato',
    'esattamente come scritto nel testo. "testoSorgente" è la frase ESATTA del testo da cui hai dedotto',
    'la feature. Indica anche la categoria del prodotto.',
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
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      temperature: 0,
      seed: 1,
      thinkingConfig: { thinkingBudget: -1 },
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(dict),
    },
  })
  return res.text ?? ''
}

export interface ExtractionResult {
  data: RawExtraction
  inputTokens: number
  outputTokens: number
}

export async function defaultGenerateWithCost(prompt: string, dict: Dictionary): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY non impostata (usa .env.local)')
  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      temperature: 0,
      seed: 1,
      thinkingConfig: { thinkingBudget: -1 },
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(dict),
    },
  })
  const text = res.text ?? ''
  if (!text.trim()) throw new Error('Gemini ha restituito una risposta vuota')
  const data = JSON.parse(text) as RawExtraction
  const usage = (res as any).usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 }
  return {
    data,
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
  }
}

export async function extractRaw(
  product: ProductRecord,
  dict: Dictionary,
  generate: (prompt: string, dict: Dictionary) => Promise<string> = defaultGenerate,
): Promise<RawExtraction> {
  const prompt = buildPrompt(product, dict)
  const jsonText = await generate(prompt, dict)
  if (!jsonText.trim()) throw new Error('Gemini ha restituito una risposta vuota')
  return JSON.parse(jsonText) as RawExtraction
}
