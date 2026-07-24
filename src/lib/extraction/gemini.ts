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
    'Sei un estrattore di feature da schede tecniche. SCOPO: trovare TUTTE le feature applicabili.',
    'STRATEGIE DI RICERCA (in ordine di importanza):',
    '1. TITOLO/SOTTOTITOLO PRIMO: il titolo "Sbattitore 5 velocità" CONTIENE feature (velocità). Estrai subito.',
    '2. DESCRIZIONE BREVE: "con cavo 100 cm" → "lunghezza_cavo" con valore "100". Estrai numeri/dati chiari.',
    '3. TESTO LUNGO: leggi ogni riga di dettaglio e nota tecnica; ogni frase è una candidata feature.',
    '4. IMPLICITI: "silenzioso" → cerca "funzionamento_silenzioso" nel vocabolario. Se in vocabolario, estrai.',
    '',
    'REGOLE ANTI-ALLUCINAZIONE (NON negoziabili):',
    '- Includi feature SOLO se il testo la supporta CON EVIDENZA TESTUALE ESATTA.',
    '- "testoSorgente" deve essere una citazione vera del testo originale.',
    '- Se incerti sul valore (numero impreciso, unità ambigua), scrivi il testo tal quale; NON inventare.',
    '- Punta MINIMO a 4-5 feature, MASSIMO a quello che il testo supporta (no padding, no allucinazione).',
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
