import { z } from 'zod'
import type { Scene } from './types'

const iconLabel = z.object({
  type: z.literal('icona-label'),
  id: z.string(),
  chiave: z.string(),
  etichetta: z.string(),
  x: z.number(),
  y: z.number(),
  verificata: z.boolean(),
  maxLarghezzaEtichetta: z.number().optional(),
})

const foto = z.object({
  type: z.literal('foto'),
  id: z.string(),
  imageHash: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  gruppo: z.string().optional(),
})

const quota = z.object({
  type: z.literal('quota'),
  id: z.string(),
  orientamento: z.enum(['verticale', 'orizzontale', 'diagonale']),
  valore: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  gruppo: z.string().optional(),
  nascosta: z.boolean().optional(),
})

const badge = z.object({
  type: z.literal('badge'),
  id: z.string(),
  testo: z.string(),
  x: z.number(),
  y: z.number(),
  gruppo: z.string().optional(),
})

const testo = z.object({
  type: z.literal('testo'),
  id: z.string(),
  testo: z.string(),
  x: z.number(),
  y: z.number(),
  ruolo: z.enum(['titolo', 'sottotitolo', 'corpo']),
})

const element = z.discriminatedUnion('type', [iconLabel, foto, quota, badge, testo])

const scene = z.object({
  version: z.number(),
  sku: z.string(),
  templateId: z.string(),
  canvas: z.object({ width: z.number(), height: z.number() }),
  elements: z.array(element),
})

// Guardia a compile-time: se lo schema zod diverge dal tipo Scene, qui fallisce la compilazione.
const _sceneTypeGuard = (s: z.infer<typeof scene>): Scene => s
void _sceneTypeGuard

export function parseScene(input: unknown): Scene {
  return scene.parse(input) as Scene
}
