import { GoogleGenAI, Type } from '@google/genai'
import { bboxPlausibile, type BBox } from './bbox'

export function buildVisionPrompt(): string {
  return [
    'Sei un servizio di ritaglio prodotto. Nella foto individua il SINGOLO prodotto principale in',
    'vendita e restituisci il suo bounding box più stretto possibile, come frazioni [0,1] della',
    "larghezza e altezza dell'immagine (origine in alto a sinistra).",
    'Ignora sfondo, ambientazione, persone, oggetti di scena, ombre e riflessi.',
    "Se non c'è un unico prodotto dominante (collage, più prodotti, solo ambiente) imposta trovato=false.",
  ].join('\n')
}

export function buildVisionSchema() {
  return {
    type: Type.OBJECT,
    required: ['trovato', 'x', 'y', 'width', 'height'],
    properties: {
      trovato: { type: Type.BOOLEAN },
      x: { type: Type.NUMBER },
      y: { type: Type.NUMBER },
      width: { type: Type.NUMBER },
      height: { type: Type.NUMBER },
    },
  }
}

export async function askVisionDefault(imageBytes: Buffer, mime: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY non impostata (usa .env.local)')
  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      { inlineData: { mimeType: mime, data: imageBytes.toString('base64') } },
      { text: buildVisionPrompt() },
    ],
    config: {
      temperature: 0,
      seed: 1,
      thinkingConfig: { thinkingBudget: -1 },
      responseMimeType: 'application/json',
      responseSchema: buildVisionSchema(),
    },
  })
  return res.text ?? ''
}

/** Parsa la risposta Vision (frazioni [0,1]) → BBox in px, con clamp ai bordi e guardia plausibilità.
 *  Ritorna null se: JSON vuoto/invalido, trovato=false, o box implausibile. Non lancia mai. */
export function parseVisionBBox(jsonText: string, imgW: number, imgH: number): BBox | null {
  if (!jsonText.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }
  // JSON.parse accetta anche valori non-oggetto sintatticamente validi (null, array, numeri,
  // stringhe, boolean): senza questo guard r.trovato lancerebbe un TypeError su `null`.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const r = parsed as { trovato?: boolean; x?: number; y?: number; width?: number; height?: number }
  if (!r.trovato || r.x == null || r.y == null || r.width == null || r.height == null) return null

  let left = Math.round(r.x * imgW)
  let top = Math.round(r.y * imgH)
  let width = Math.round(r.width * imgW)
  let height = Math.round(r.height * imgH)
  // clamp ai bordi immagine
  left = Math.max(0, Math.min(left, imgW - 1))
  top = Math.max(0, Math.min(top, imgH - 1))
  width = Math.max(1, Math.min(width, imgW - left))
  height = Math.max(1, Math.min(height, imgH - top))

  const box: BBox = { left, top, width, height }
  return bboxPlausibile(box, imgW, imgH) ? box : null
}
