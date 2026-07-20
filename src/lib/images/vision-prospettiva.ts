import { GoogleGenAI, Type } from '@google/genai'

/** Prospettiva di profondità rilevata su una foto prodotto: direzione verso cui si allontana
 *  lo spigolo di profondità, la sua inclinazione in gradi, e se sale o scende nella foto. */
export interface Prospettiva {
  direzione: 'destra' | 'sinistra'
  angoloDeg: number
  verso: 'su' | 'giu'
}

export function buildProspettivaPrompt(): string {
  return [
    'Analizzi foto di prodotti per un catalogo. Su queste foto disegniamo le linee di quota (larghezza, altezza, profondità) e vogliamo che la linea della PROFONDITÀ sia parallela allo spigolo del prodotto che si allontana in prospettiva. Osserva l\'inquadratura del prodotto:',
    '- prospettiva: "frontale" se si vede praticamente solo la faccia frontale/laterale piatta (foto 2D, nessuno spigolo di profondità visibile); "tre_quarti" se si vede anche un fianco/la tridimensionalità (uno spigolo inferiore che si allontana).',
    '- direzioneProfondita: verso quale lato si allontana la profondità guardando la foto: "destra", "sinistra", oppure "nessuna" se frontale.',
    '- angoloProfonditaGradi: inclinazione in GRADI dello spigolo inferiore di profondità rispetto all\'orizzontale (0 = orizzontale, valori tipici 10-35 per un tre_quarti). 0 se frontale.',
    '- verso: "su" se quello spigolo, allontanandosi, sale nella foto; "giu" se scende. "nessuno" se frontale.',
  ].join('\n')
}

export function buildProspettivaSchema() {
  return {
    type: Type.OBJECT,
    required: ['prospettiva', 'direzioneProfondita', 'angoloProfonditaGradi', 'verso'],
    properties: {
      prospettiva: { type: Type.STRING, enum: ['frontale', 'tre_quarti'] },
      direzioneProfondita: { type: Type.STRING, enum: ['destra', 'sinistra', 'nessuna'] },
      angoloProfonditaGradi: { type: Type.NUMBER },
      verso: { type: Type.STRING, enum: ['su', 'giu', 'nessuno'] },
    },
  }
}

export async function askProspettivaDefault(imageBytes: Buffer, mime: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY non impostata (usa .env.local)')
  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      { inlineData: { mimeType: mime, data: imageBytes.toString('base64') } },
      { text: buildProspettivaPrompt() },
    ],
    config: {
      temperature: 0,
      seed: 1,
      thinkingConfig: { thinkingBudget: -1 },
      responseMimeType: 'application/json',
      responseSchema: buildProspettivaSchema(),
    },
  })
  return res.text ?? ''
}

/** Parsa la risposta Vision → Prospettiva, o null se frontale/non rilevata/incoerente.
 *  Non lancia mai. */
export function parseProspettiva(jsonText: string): Prospettiva | null {
  if (!jsonText.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }
  // JSON.parse accetta anche valori non-oggetto sintatticamente validi (null, array, numeri,
  // stringhe, boolean): senza questo guard l'accesso ai campi lancerebbe un TypeError su `null`.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const r = parsed as {
    prospettiva?: string
    direzioneProfondita?: string
    angoloProfonditaGradi?: number
    verso?: string
  }

  // Frontale (o nessuna direzione di profondità) → nessuna prospettiva: il layout userà il default.
  if (r.prospettiva === 'frontale' || r.direzioneProfondita === 'nessuna') return null

  // Valori incoerenti/fuori range → scarta (null, mai lanciare).
  if (r.direzioneProfondita !== 'destra' && r.direzioneProfondita !== 'sinistra') return null
  if (typeof r.angoloProfonditaGradi !== 'number' || !Number.isFinite(r.angoloProfonditaGradi)) return null

  const angoloDeg = Math.max(0, Math.min(45, r.angoloProfonditaGradi))
  const verso: 'su' | 'giu' = r.verso === 'su' ? 'su' : 'giu'
  return { direzione: r.direzioneProfondita, angoloDeg, verso }
}

/**
 * Ricava la Prospettiva dalla quota diagonale che l'operatore ha corretto a mano nell'editor
 * (livello 1 "memoria correzioni"): la direzione/verso/angolo sono dedotti dal segmento x1,y1→x2,y2
 * così come l'operatore lo ha disegnato, senza richiamare Vision.
 */
export function prospettivaDaQuotaDiagonale(q: { x1: number; y1: number; x2: number; y2: number }): Prospettiva {
  const direzione: 'destra' | 'sinistra' = q.x2 >= q.x1 ? 'destra' : 'sinistra'
  const verso: 'su' | 'giu' = q.y2 >= q.y1 ? 'giu' : 'su'
  const a = Math.abs((Math.atan2(q.y2 - q.y1, q.x2 - q.x1) * 180) / Math.PI)
  const acuto = Math.min(a, 180 - a)
  const angoloDeg = Math.max(0, Math.min(45, acuto))
  return { direzione, angoloDeg, verso }
}
