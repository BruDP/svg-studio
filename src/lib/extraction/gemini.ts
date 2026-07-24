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
    'Sei un estrattore AGGRESSIVO di feature da schede tecniche. SCOPO: massimizzare feature trovate.',
    'REGOLA D\'ORO: il TITOLO è una fonte di feature PRIMARIA, non secondaria.',
    '  Es: "Sbattitore 5 velocità 200W" → titolo CONTIENE: "velocità"+"5", "potenza"+"200W".',
    '',
    'STRATEGIE DI RICERCA (ordine stretto):',
    '1. TITOLO: estrai TUTTI i numeri e gli aggettivi (velocità, potenza, watt, litri, cm).',
    '2. DESCRIZIONE BREVE: numero + unità (cavo 100cm → lunghezza_cavo:100).',
    '3. TESTO LUNGO + NOTE: frase per frase, ogni proprietà è una candidata feature.',
    '4. CATEGORIA FALLBACK: se il testo è scarno, usa il vocabolario per la categoria:',
    '   - piccoli_elettrodomestici: cerca potenza (watt), velocità, cavo',
    '   - ventilatore: oscillazione, velocità, diametro pale',
    '   - barbecue: alimentazione, materiale struttura',
    '   - lavatrice: capacità, velocità centrifuga, programmi',
    '',
    'ANTI-ALLUCINAZIONE CALIBRATA:',
    '- Numeri ESATTI: copy from text (es. 100 → copy "100")',
    '- Proprietà del titolo: conta SEMPRE come supporto testuale (es. "5 velocità" → velocità come feature)',
    '- Valore mancante ma titolo suggerisce: estrai proprietà, valore null (es. "velocità" ma non "quante")',
    '- Niente feature inventate da zero, solo da indizi titolo/testo/categoria',
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
