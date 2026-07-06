import { readFileSync } from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import type { Dictionary } from './types'

const featureSchema = z.object({
  label: z.string().min(1),
  icona: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/),
  priorita: z.number().int().min(0).max(100),
  badge: z.boolean(),
  valore: z.enum(['obbligatorio', 'assente']),
  categorie: z.array(z.string()).min(1),
})

const categoriesSchema = z.object({ version: z.number(), categorie: z.array(z.string()).min(1) })
const featuresSchema = z.object({ version: z.number(), features: z.record(z.string(), featureSchema) })

export function loadDictionary(baseDir = 'dictionary'): Dictionary {
  const cats = categoriesSchema.parse(YAML.parse(readFileSync(path.join(baseDir, 'categories.yaml'), 'utf8')))
  const feats = featuresSchema.parse(YAML.parse(readFileSync(path.join(baseDir, 'features.yaml'), 'utf8')))

  for (const [key, f] of Object.entries(feats.features)) {
    if (f.label.includes('{valore}') !== (f.valore === 'obbligatorio')) {
      throw new Error(`Dizionario incoerente: feature "${key}" — label e campo "valore" non allineati`)
    }
    for (const c of f.categorie) {
      if (!cats.categorie.includes(c)) {
        throw new Error(`Dizionario incoerente: feature "${key}" usa categoria sconosciuta "${c}"`)
      }
    }
  }
  return { version: feats.version, categorie: cats.categorie, features: feats.features }
}
