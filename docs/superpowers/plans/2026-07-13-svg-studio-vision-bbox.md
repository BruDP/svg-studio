# SVG Studio — Fallback Gemini Vision per il bounding box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare il fallback Gemini Vision per il bounding box del prodotto sulle foto a sfondo
non uniforme (spec `2026-07-13-svg-studio-vision-bbox-design.md`), riconoscendo che la scansione a
pixel non è affidabile quando i 4 angoli discordano (dispersione angoli > soglia), chiamando Vision
solo in quel caso, cachando il risultato per hash immagine, e degradando all'immagine intera in ogni
caso di errore — senza rompere il determinismo dei golden test e mantenendo tutti i test offline.

**Architecture:** Si estende l'**Image Service** (spec master §1). `bbox.ts` resta la primitiva di
scansione (API pubblica invariata) e guadagna il calcolo della dispersione angoli e la guardia di
plausibilità. Un nuovo modulo `vision-bbox.ts` incapsula la chiamata Gemini Vision con dependency
injection (come `extractRaw`). Un nuovo `vision-repository.ts` cacha il risultato in una nuova tabella
Prisma `VisionBBox` (keyed su hash immagine). L'orchestratore `resolve-bbox.ts` sceglie scan / Vision /
immagine-intera ed è l'unico punto che `compose-lib.ts` chiama al posto di `detectBBox`. Nessuna
modifica a `colonna-sinistra.ts` né al motore di rendering/scena.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Prisma/SQLite, `sharp` (decodifica raw +
`extract`), `@google/genai` (Gemini Vision, `gemini-2.5-pro`). Node 20+, npm, alias `@/* → src/*`,
`.gitattributes` LF. Riusa immutati Fasi 1/2/3 e i lotti dizionario.

## Global Constraints

- **API pubblica di `detectBBox` invariata**: firma `(Buffer, {soglia?}) => Promise<BBox|null>` e
  comportamento identico (i 2 test in `tests/images-bbox.test.ts` restano verdi). La rifattorizzazione
  interna (helper `analizzaBBox`) non cambia l'output.
- **Golden determinismo intatto**: `tests/render-svg.test.ts` e `tests/layout-colonna-sinistra.test.ts`
  usano scena/bbox hardcoded, non toccano `bbox.ts`/`compose-lib.ts` → golden barbecue
  (`tests/fixtures/render-2137070.svg`) **byte-identico, nessuna rigenerazione**. Verificarlo, non
  rigenerarlo.
- **`compose-e2e.test.ts` resta offline e verde**: usa immagine sintetica a sfondo bianco uniforme
  (`scartoAngoli = 0`) → ramo "sfondo uniforme", nessuna Vision, nessun DB. Non modificare la sua
  logica; al più aggiornare `deps` se il tipo cambia (retro-compatibile: nuovi campi opzionali).
- **Tutti i test offline e deterministici**: nessuna chiamata di rete, nessuna `GEMINI_API_KEY`, DB
  isolato o cache iniettata. La chiamata Vision reale vive solo nei default di produzione e nel task di
  validazione (Task 5), marcato "rete richiesta".
- **Degrado, non blocco**: ogni errore Vision (rete/quota/chiave assente/JSON invalido/bbox
  implausibile) ⇒ immagine intera (`null`), mai un'eccezione che interrompe la composizione. Gli errori
  di rete/chiave **non** vengono cachati (riprovabili); i "non trovato" legittimi sì.
- **Nessuno stato di revisione per il bbox-Vision** (spec §6.1): `VisionBBox` è pura cache, senza
  colonna `status`. Non replicare il pattern `Icon.status`.
- **Nessun batch runner** (fuori scope, deciso con l'utente): fallback per singolo prodotto nel flusso
  compose/editor esistente.
- **Migration Prisma** seguendo lo stile di `prisma/migrations/20260703152521_init/migration.sql`
  (SQLite, `CREATE TABLE`), più `prisma migrate` per generare la migration reale.
- **UI/commenti/commit in italiano.**

## Modello di esecuzione per-task

La logica di decisione "quando chiamare Vision" e l'orchestrazione sono i punti delicati → Sonnet con
giudizio esplicito. Nessun task è pura trascrizione (niente Haiku qui: anche gli snippet vanno
adattati/testati). I task 1-4 sono solo codice/test **offline**; il Task 5 richiede rete + chiave.

| Task | Contenuto | Esecuzione suggerita | Review |
|---|---|---|---|
| 1 | Dispersione angoli + plausibilità in `bbox.ts` (refactor `analizzaBBox`) + test | Sonnet (refactor delicato, API invariata) | Sonnet |
| 2 | Tabella Prisma `VisionBBox` + migration + `vision-repository.ts` + test (DB isolato) | Sonnet | Sonnet |
| 3 | `vision-bbox.ts`: prompt, schema, `askVision`, `parseVisionBBox` + test offline (fake) | Sonnet | Sonnet |
| 4 | `resolve-bbox.ts` (orchestratore) + integrazione in `compose-lib.ts` + test; verifica golden/e2e | Sonnet (integrazione + determinismo) | Sonnet |
| 5 | Validazione end-to-end su foto lifestyle reali (rete + `GEMINI_API_KEY`) | Sonnet (rete) | Sonnet |

Review finale whole-branch: **Opus**.

## File Structure

```
src/lib/images/
  bbox.ts                 # Task 1 — + analizzaBBox, scartoAngoli, bboxPlausibile, SOGLIA_ANGOLI; detectBBox invariata
  vision-bbox.ts          # Task 3 — NUOVO: buildVisionPrompt, buildVisionSchema, askVisionDefault, parseVisionBBox
  vision-repository.ts    # Task 2 — NUOVO: loadCachedBBox / saveCachedBBox (Prisma VisionBBox)
  resolve-bbox.ts         # Task 4 — NUOVO: resolveBBox (orchestratore), tipo ResolveBBoxDeps
  cache.ts                # INVARIATO — si riusa extFromBytes/logica mime (eventualmente esportare mimeFromBytes)
prisma/
  schema.prisma           # Task 2 — + model VisionBBox
  migrations/
    <ts>_vision_bbox/      # Task 2 — NUOVO: migration.sql (CREATE TABLE VisionBBox)
scripts/
  compose-lib.ts          # Task 4 — detectBBox(bytes) → resolveBBox(bytes, cached.hash, deps)
tests/
  images-bbox.test.ts     # Task 1 — + test scartoAngoli / bboxPlausibile (2 esistenti invariati)
  images-vision-bbox.test.ts   # Task 3 — NUOVO: parse/validazione con fake
  images-vision-repository.test.ts # Task 2 — NUOVO: round-trip cache su DB isolato
  images-resolve-bbox.test.ts  # Task 4 — NUOVO: 3 rami (uniforme/vision/errore) + cache, tutto offline
  compose-e2e.test.ts     # Task 4 — verificato verde (ramo uniforme); modifica solo se il tipo deps lo impone
  render-svg.test.ts / layout-colonna-sinistra.test.ts # Task 4 — verificati golden byte-identici
```

Nessun file sotto `src/lib/layout`, `src/lib/scene`, `src/lib/render`, `src/lib/extraction` cambia.

---

### Task 1: Dispersione angoli + plausibilità in `bbox.ts`

Rifattorizza `detectBBox` per condividere un'unica decodifica raw con il calcolo della dispersione
angoli, ed esporta i due helper di decisione. L'API pubblica e il comportamento di `detectBBox`
restano invariati.

**Files:**
- Modify: `src/lib/images/bbox.ts`
- Test: `tests/images-bbox.test.ts`

**Interfaces:**
- Produces: `analizzaBBox(imageBytes, {soglia?}) => Promise<{ box: BBox|null; scartoAngoli: number; width: number; height: number }>`; `bboxPlausibile(box, width, height) => boolean`; `export const SOGLIA_ANGOLI = 48`. `detectBBox` invariata (delega ad `analizzaBBox`).

- [ ] **Step 1 (test prima): aggiungi i test che falliscono**

In `tests/images-bbox.test.ts` aggiungi (i 2 test esistenti restano intatti):

```ts
import { analizzaBBox, bboxPlausibile, SOGLIA_ANGOLI } from '@/lib/images/bbox'

/** PNG con 4 angoli di colori molto diversi (sfondo non uniforme). */
async function makeAngoliDiscordi(): Promise<Buffer> {
  const w = 100, h = 100
  const px = Buffer.alloc(w * h * 3, 128)
  const setPx = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * w + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b
  }
  setPx(0, 0, 255, 0, 0); setPx(w - 1, 0, 0, 255, 0)
  setPx(0, h - 1, 0, 0, 255); setPx(w - 1, h - 1, 0, 0, 0)
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

it('scartoAngoli è ~0 su sfondo uniforme e alto su angoli discordi', async () => {
  const { scartoAngoli: uniforme } = await analizzaBBox(await makeSample())
  expect(uniforme).toBeLessThanOrEqual(SOGLIA_ANGOLI)
  const { scartoAngoli: discorde } = await analizzaBBox(await makeAngoliDiscordi())
  expect(discorde).toBeGreaterThan(SOGLIA_ANGOLI)
})

it('bboxPlausibile scarta box degeneri (troppo piccoli o quasi-interi)', () => {
  expect(bboxPlausibile({ left: 20, top: 30, width: 50, height: 50 }, 100, 100)).toBe(true)
  expect(bboxPlausibile({ left: 0, top: 0, width: 2, height: 2 }, 100, 100)).toBe(false)       // troppo piccolo
  expect(bboxPlausibile({ left: 0, top: 0, width: 100, height: 100 }, 100, 100)).toBe(false)   // quasi-intero
  expect(bboxPlausibile({ left: 44, top: 0, width: 4, height: 100 }, 100, 100)).toBe(false)    // sliver (larghezza 4 < 5% di 100)
})
```

- [ ] **Step 2: esegui (fallisce)**

Run: `npx vitest run tests/images-bbox.test.ts`
Expected: FAIL sui 2 nuovi test (import inesistenti). I 2 test originali restano verdi.

- [ ] **Step 3: rifattorizza `bbox.ts`**

Estrai l'unica decodifica raw in `analizzaBBox`, che calcola sia il bbox (loop esistente) sia
`scartoAngoli` (massima distanza L1 a coppie tra i 4 angoli). `detectBBox` diventa un thin wrapper.
Aggiungi `bboxPlausibile` e `SOGLIA_ANGOLI`.

```ts
import sharp from 'sharp'

export interface BBox { left: number; top: number; width: number; height: number }

/** Soglia di dispersione tra i 4 angoli oltre cui lo sfondo NON è a tinta unita
 *  (2× la `soglia` per-pixel di default): innesca il fallback Vision. */
export const SOGLIA_ANGOLI = 48

type RGB = [number, number, number]
const distL1 = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

export async function analizzaBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<{ box: BBox | null; scartoAngoli: number; width: number; height: number }> {
  const soglia = deps.soglia ?? 24
  const { data, info } = await sharp(imageBytes).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const at = (x: number, y: number): RGB => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }

  const angoli: RGB[] = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
  let scartoAngoli = 0
  for (let i = 0; i < angoli.length; i++)
    for (let j = i + 1; j < angoli.length; j++)
      scartoAngoli = Math.max(scartoAngoli, distL1(angoli[i], angoli[j]))

  const bg: RGB = [
    Math.round(angoli.reduce((s, c) => s + c[0], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[1], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[2], 0) / 4),
  ]
  const differisce = (x: number, y: number): boolean => {
    const [r, g, b] = at(x, y)
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > soglia
  }

  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (differisce(x, y)) {
        if (x < minX) minX = x; if (y < minY) minY = y
        if (x > maxX) maxX = x; if (y > maxY) maxY = y
      }

  const box = maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  return { box, scartoAngoli, width, height }
}

/** API pubblica invariata: comportamento identico a prima. */
export async function detectBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<BBox | null> {
  return (await analizzaBBox(imageBytes, deps)).box
}

/** Guardia di plausibilità: scarta box degeneri (sliver, quasi-interi, minuscoli).
 *  Un box quasi-intero equivale a "nessun ritaglio utile" → trattato come implausibile. */
export function bboxPlausibile(box: BBox, width: number, height: number): boolean {
  const ratio = (box.width * box.height) / (width * height)
  if (ratio < 0.03 || ratio > 0.985) return false
  if (box.width < width * 0.05 || box.height < height * 0.05) return false
  return true
}
```

- [ ] **Step 4: esegui (passa) + tsc**

Run: `npx vitest run tests/images-bbox.test.ts && npx tsc --noEmit`
Expected: PASS (4 test: 2 originali + 2 nuovi), `tsc` pulito.

- [ ] **Step 5: suite + commit**

```bash
npm test
git add src/lib/images/bbox.ts tests/images-bbox.test.ts
git commit -m "feat(images): dispersione angoli e guardia plausibilità bbox (refactor analizzaBBox, API detectBBox invariata)"
```

Expected: `npm test` verde (incluso `compose-e2e` e golden — `bbox.ts` invariato nel comportamento).

---

### Task 2: Tabella Prisma `VisionBBox` + `vision-repository.ts`

Aggiunge la cache DB del risultato Vision (pura cache, senza `status`), keyed su hash immagine.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_vision_bbox/migration.sql` (generata da Prisma)
- Create: `src/lib/images/vision-repository.ts`
- Test: `tests/images-vision-repository.test.ts`

**Interfaces:**
- Produces: `loadCachedBBox(imageHash) => Promise<{ trovato: boolean; box: BBox | null } | undefined>`; `saveCachedBBox(imageHash, box: BBox | null) => Promise<void>` (box `null` → riga con `trovato=false`).
- Consumes: `db` da `@/lib/db`; `BBox` da `@/lib/images/bbox`.

- [ ] **Step 1: aggiungi il model a `schema.prisma`**

In coda a `prisma/schema.prisma`:

```prisma
model VisionBBox {
  imageHash String   @id
  trovato   Boolean
  left      Int?
  top       Int?
  width     Int?
  height    Int?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: genera la migration**

Run: `npx prisma migrate dev --name vision_bbox`
Expected: nuova cartella `prisma/migrations/<timestamp>_vision_bbox/migration.sql` con `CREATE TABLE
"VisionBBox" (...)`, client Prisma rigenerato. Verifica che `migration.sql` segua lo stile di
`20260703152521_init` (SQLite). Se l'ambiente non permette `migrate dev` (DB in uso), usa
`npx prisma migrate dev --create-only` e applica poi con `migrate deploy`.

- [ ] **Step 3: implementa `vision-repository.ts`**

```ts
import { db } from '@/lib/db'
import type { BBox } from './bbox'

export async function loadCachedBBox(
  imageHash: string,
): Promise<{ trovato: boolean; box: BBox | null } | undefined> {
  const row = await db.visionBBox.findUnique({ where: { imageHash } })
  if (!row) return undefined
  if (!row.trovato) return { trovato: false, box: null }
  return {
    trovato: true,
    box: { left: row.left!, top: row.top!, width: row.width!, height: row.height! },
  }
}

export async function saveCachedBBox(imageHash: string, box: BBox | null): Promise<void> {
  const data = box
    ? { trovato: true, left: box.left, top: box.top, width: box.width, height: box.height }
    : { trovato: false, left: null, top: null, width: null, height: null }
  await db.visionBBox.upsert({ where: { imageHash }, create: { imageHash, ...data }, update: data })
}
```

- [ ] **Step 4: test su DB isolato**

Segui il pattern di `tests/db.test.ts` / `tests/icons-repository.test.ts` (DB test isolato, vedi
memoria di progetto). In `tests/images-vision-repository.test.ts`:

```ts
it('round-trip: salva e rilegge un bbox trovato', async () => {
  const h = 'a'.repeat(64)
  await saveCachedBBox(h, { left: 10, top: 20, width: 30, height: 40 })
  expect(await loadCachedBBox(h)).toEqual({ trovato: true, box: { left: 10, top: 20, width: 30, height: 40 } })
})

it('round-trip: salva e rilegge un "non trovato"', async () => {
  const h = 'b'.repeat(64)
  await saveCachedBBox(h, null)
  expect(await loadCachedBBox(h)).toEqual({ trovato: false, box: null })
})

it('hash sconosciuto → undefined', async () => {
  expect(await loadCachedBBox('c'.repeat(64))).toBeUndefined()
})
```

- [ ] **Step 5: esegui + tsc + commit**

```bash
npx vitest run tests/images-vision-repository.test.ts && npx tsc --noEmit && npm test
git add prisma/schema.prisma prisma/migrations src/lib/images/vision-repository.ts tests/images-vision-repository.test.ts
git commit -m "feat(images): cache DB del bbox-Vision (tabella VisionBBox, pura cache senza revisione)"
```

Expected: verde; golden invariati (nessun tocco a render/scena).

---

### Task 3: Modulo Gemini Vision `vision-bbox.ts`

Incapsula prompt, schema di risposta, chiamata reale (default) e parse+validazione, con `askVision`
iniettabile per i test offline (pattern di `extractRaw`).

**Files:**
- Create: `src/lib/images/vision-bbox.ts`
- Test: `tests/images-vision-bbox.test.ts`
- (eventuale) Modify: `src/lib/images/cache.ts` — esporta `mimeFromBytes` se serve dedurre il mime

**Interfaces:**
- Produces: `buildVisionPrompt(): string`; `buildVisionSchema()`; `askVisionDefault(imageBytes, mime) => Promise<string>`; `parseVisionBBox(jsonText, imgW, imgH) => BBox | null`.
- Consumes: `GoogleGenAI`, `Type` da `@google/genai`; `bboxPlausibile`, `BBox` da `./bbox`.

- [ ] **Step 1: implementa il modulo**

```ts
import { GoogleGenAI, Type } from '@google/genai'
import { bboxPlausibile, type BBox } from './bbox'

export function buildVisionPrompt(): string {
  return [
    'Sei un servizio di ritaglio prodotto. Nella foto individua il SINGOLO prodotto principale in',
    'vendita e restituisci il suo bounding box più stretto possibile, come frazioni [0,1] della',
    'larghezza e altezza dell immagine (origine in alto a sinistra).',
    'Ignora sfondo, ambientazione, persone, oggetti di scena, ombre e riflessi.',
    'Se non c è un unico prodotto dominante (collage, più prodotti, solo ambiente) imposta trovato=false.',
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
  let r: { trovato?: boolean; x?: number; y?: number; width?: number; height?: number }
  try {
    r = JSON.parse(jsonText)
  } catch {
    return null
  }
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
```

Nota: se serve il mime per `inlineData`, riusa la deduzione dai magic byte già presente in `cache.ts`
(`extFromBytes`); valuta di esportare un `mimeFromBytes` (`jpg→image/jpeg`, `png→image/png`,
`webp→image/webp`) da `cache.ts` per non duplicare. La conversione ext→mime può stare anche
nell'orchestratore (Task 4), dove l'`ext` cachato è già disponibile.

- [ ] **Step 2: test offline (fake, nessuna rete)**

`tests/images-vision-bbox.test.ts` — esercita solo `parseVisionBBox` e la forma di prompt/schema
(nessuna chiamata reale):

```ts
it('parsa un box plausibile in frazioni → px', () => {
  const json = JSON.stringify({ trovato: true, x: 0.25, y: 0.1, width: 0.5, height: 0.6 })
  expect(parseVisionBBox(json, 1000, 1000)).toEqual({ left: 250, top: 100, width: 500, height: 600 })
})

it('trovato=false → null', () => {
  expect(parseVisionBBox(JSON.stringify({ trovato: false, x: 0, y: 0, width: 0, height: 0 }), 1000, 1000)).toBeNull()
})

it('JSON vuoto o invalido → null (non lancia)', () => {
  expect(parseVisionBBox('', 100, 100)).toBeNull()
  expect(parseVisionBBox('non-json', 100, 100)).toBeNull()
})

it('box implausibile (sliver / quasi-intero) → null', () => {
  expect(parseVisionBBox(JSON.stringify({ trovato: true, x: 0, y: 0, width: 1, height: 1 }), 1000, 1000)).toBeNull()
  expect(parseVisionBBox(JSON.stringify({ trovato: true, x: 0.4, y: 0, width: 0.02, height: 1 }), 1000, 1000)).toBeNull()
})

it('box che eccede i bordi viene clampato e resta plausibile', () => {
  const json = JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 1.0, height: 1.0 })
  const box = parseVisionBBox(json, 1000, 1000)
  expect(box).not.toBeNull()
  expect(box!.left + box!.width).toBeLessThanOrEqual(1000)
  expect(box!.top + box!.height).toBeLessThanOrEqual(1000)
})

it('lo schema vincola i campi richiesti', () => {
  const s = buildVisionSchema() as any
  expect(s.required).toEqual(['trovato', 'x', 'y', 'width', 'height'])
})
```

Nota: il clamp del penultimo caso (width 1.0 con x 0.2) rende width=800, ratio 0.64 → plausibile.

- [ ] **Step 3: esegui + tsc + commit**

```bash
npx vitest run tests/images-vision-bbox.test.ts && npx tsc --noEmit && npm test
git add src/lib/images/vision-bbox.ts tests/images-vision-bbox.test.ts src/lib/images/cache.ts
git commit -m "feat(images): integrazione Gemini Vision per bbox (prompt, schema, parse+validazione, DI offline)"
```

Expected: verde; golden invariati.

---

### Task 4: Orchestratore `resolve-bbox.ts` + integrazione in `compose-lib.ts`

Assembla i pezzi nella logica di decisione della spec §4 e la collega a `composeSceneForProduct`.
Punto più delicato del piano: preservare il ramo "uniforme" offline usato da `compose-e2e`.

**Files:**
- Create: `src/lib/images/resolve-bbox.ts`
- Modify: `scripts/compose-lib.ts`
- Test: `tests/images-resolve-bbox.test.ts`
- Verify (no-edit): `tests/compose-e2e.test.ts`, `tests/render-svg.test.ts`, `tests/layout-colonna-sinistra.test.ts`

**Interfaces:**
- Produces: `resolveBBox(imageBytes, imageHash, deps?: ResolveBBoxDeps) => Promise<BBox | null>`; tipo `ResolveBBoxDeps`.
- Consumes: `analizzaBBox`, `bboxPlausibile`, `SOGLIA_ANGOLI`, `BBox` da `./bbox`; `parseVisionBBox`, `askVisionDefault` da `./vision-bbox`; `loadCachedBBox`, `saveCachedBBox` da `./vision-repository`.

- [ ] **Step 1: implementa `resolve-bbox.ts`**

```ts
import { analizzaBBox, bboxPlausibile, SOGLIA_ANGOLI, type BBox } from './bbox'
import { askVisionDefault, parseVisionBBox } from './vision-bbox'
import { loadCachedBBox, saveCachedBBox } from './vision-repository'

export interface ResolveBBoxDeps {
  askVision?: (imageBytes: Buffer, mime: string) => Promise<string>
  loadCachedBBox?: (imageHash: string) => Promise<{ trovato: boolean; box: BBox | null } | undefined>
  saveCachedBBox?: (imageHash: string, box: BBox | null) => Promise<void>
  sogliaAngoli?: number
  mime?: string
}

export async function resolveBBox(
  imageBytes: Buffer,
  imageHash: string,
  deps: ResolveBBoxDeps = {},
): Promise<BBox | null> {
  const sogliaAngoli = deps.sogliaAngoli ?? SOGLIA_ANGOLI
  const { box, scartoAngoli, width, height } = await analizzaBBox(imageBytes)

  // Ramo sfondo UNIFORME: comportamento identico a oggi, nessuna Vision, nessun DB.
  if (scartoAngoli <= sogliaAngoli) {
    return box && bboxPlausibile(box, width, height) ? box : null
  }

  // Ramo sfondo NON UNIFORME: fallback Vision, con cache per hash immagine.
  const load = deps.loadCachedBBox ?? loadCachedBBox
  const save = deps.saveCachedBBox ?? saveCachedBBox
  const ask = deps.askVision ?? askVisionDefault

  const cached = await load(imageHash)
  if (cached) return cached.box // include "non trovato" → null, senza richiamare Vision

  try {
    const json = await ask(imageBytes, deps.mime ?? 'image/png')
    const visionBox = parseVisionBBox(json, width, height)
    await save(imageHash, visionBox) // cacha anche il "non trovato" (visionBox null) → non ripete Vision
    return visionBox
  } catch {
    // errore rete/quota/chiave: degrada a immagine intera, NON cacha (riprovabile)
    return null
  }
}
```

Punti di attenzione (giudizio Sonnet):
- Nel ramo uniforme non si tocca né `load`/`save` né `ask` → nessun DB/rete: è ciò che mantiene
  `compose-e2e` offline (immagine bianca → `scartoAngoli = 0`).
- Gli errori Vision non vengono cachati (riprovabili); i `null` da `parseVisionBBox` (trovato=false /
  implausibile) **sì**, perché sono risposte legittime.
- `mime`: passare quello reale dall'orchestratore chiamante (Task Step 2), default `image/png`.

- [ ] **Step 2: integra in `compose-lib.ts`**

Sostituisci (riga 20) `const box = await detectBBox(bytes)` con l'orchestratore, passando l'hash e il
mime dedotto dall'`ext` cachato. Estendi il tipo `deps` con gli hook Vision opzionali:

```ts
import { resolveBBox } from '@/lib/images/resolve-bbox'
// ... rimuovi import di detectBBox se non più usato

// nel tipo deps:
deps?: {
  download?: (url: string) => Promise<Buffer>
  dir?: string
  askVision?: (imageBytes: Buffer, mime: string) => Promise<string>
}

// nel corpo, al posto di detectBBox:
const mime = cached.ext === 'jpg' ? 'image/jpeg' : cached.ext === 'webp' ? 'image/webp' : 'image/png'
const box = await resolveBBox(bytes, cached.hash, { ...input.deps, mime })
```

Il resto (`sharp().extract()`, `writeImageBytes`, `composeColonnaSinistra`) resta identico. `box` ha lo
stesso tipo `BBox | null` di prima → nessun'altra modifica a valle.

- [ ] **Step 3: test dell'orchestratore (offline, tutte le deps iniettate)**

`tests/images-resolve-bbox.test.ts` — riusa `makeSample`/`makeAngoliDiscordi` (sfondo uniforme vs
discorde) e cache in-memory:

```ts
it('sfondo uniforme: usa la scansione, NON chiama Vision', async () => {
  let chiamateVision = 0
  const box = await resolveBBox(await makeSample(), 'h1', {
    askVision: async () => { chiamateVision++; return '' },
  })
  expect(chiamateVision).toBe(0)
  expect(box).toEqual({ left: 20, top: 30, width: 50, height: 50 })
})

it('sfondo non uniforme: chiama Vision e usa il suo bbox plausibile', async () => {
  const store = new Map<string, { trovato: boolean; box: any }>()
  const box = await resolveBBox(await makeAngoliDiscordi(), 'h2', {
    askVision: async () => JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }),
    loadCachedBBox: async (h) => store.get(h),
    saveCachedBBox: async (h, b) => { store.set(h, { trovato: !!b, box: b }) },
  })
  expect(box).toEqual({ left: 20, top: 20, width: 50, height: 50 })
})

it('cache: seconda chiamata non richiama Vision', async () => {
  const store = new Map<string, { trovato: boolean; box: any }>()
  let chiamate = 0
  const deps = {
    askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }) },
    loadCachedBBox: async (h: string) => store.get(h),
    saveCachedBBox: async (h: string, b: any) => { store.set(h, { trovato: !!b, box: b }) },
  }
  await resolveBBox(await makeAngoliDiscordi(), 'h3', deps)
  await resolveBBox(await makeAngoliDiscordi(), 'h3', deps)
  expect(chiamate).toBe(1)
})

it('errore Vision: degrada a immagine intera (null) e NON cacha', async () => {
  const store = new Map<string, any>()
  const box = await resolveBBox(await makeAngoliDiscordi(), 'h4', {
    askVision: async () => { throw new Error('rete giù') },
    loadCachedBBox: async (h) => store.get(h),
    saveCachedBBox: async (h, b) => { store.set(h, b) },
  })
  expect(box).toBeNull()
  expect(store.has('h4')).toBe(false) // errore non cachato → riprovabile
})

it('Vision trovato=false: null cachato, seconda chiamata non richiama Vision', async () => {
  const store = new Map<string, { trovato: boolean; box: any }>()
  let chiamate = 0
  const deps = {
    askVision: async () => { chiamate++; return JSON.stringify({ trovato: false, x: 0, y: 0, width: 0, height: 0 }) },
    loadCachedBBox: async (h: string) => store.get(h),
    saveCachedBBox: async (h: string, b: any) => { store.set(h, { trovato: !!b, box: b }) },
  }
  expect(await resolveBBox(await makeAngoliDiscordi(), 'h5', deps)).toBeNull()
  expect(await resolveBBox(await makeAngoliDiscordi(), 'h5', deps)).toBeNull()
  expect(chiamate).toBe(1)
})
```

- [ ] **Step 4: verifica determinismo e integrazione**

```bash
npx vitest run tests/images-resolve-bbox.test.ts
npx vitest run tests/compose-e2e.test.ts
npx vitest run tests/render-svg.test.ts tests/layout-colonna-sinistra.test.ts
```

Expected:
- `images-resolve-bbox`: 5 test verdi.
- `compose-e2e`: verde **senza modifiche di logica** (immagine bianca → ramo uniforme → nessuna Vision,
  nessun DB). Se il `tsc` richiede l'allineamento del tipo `deps`, è retro-compatibile (campo
  `askVision` opzionale).
- `render-svg` + `layout-colonna-sinistra`: verdi, golden barbecue **byte-identico** (nessuna
  rigenerazione fixture). Se falliscono, NON rigenerare: indagare la causa (non dovrebbero essere
  toccati).

- [ ] **Step 5: tsc + suite + commit**

```bash
npx tsc --noEmit && npm test
git add src/lib/images/resolve-bbox.ts scripts/compose-lib.ts tests/images-resolve-bbox.test.ts
git commit -m "feat(images): orchestratore resolveBBox (scan|Vision|intera) integrato in compose-lib; golden intatti"
```

Expected: `tsc` pulito, `npm test` verde, golden byte-identico.

---

### Task 5: Validazione end-to-end su foto lifestyle reali

Conferma sul campo che il fallback risolve i casi diagnostici (§2.1 della spec). **Rete + chiave
richieste.**

**Rete + `GEMINI_API_KEY` richieste:** questo task chiama Gemini Vision reale e scarica foto dal feed.
Se chiave/rete non disponibili, segnalare **BLOCKED**; i Task 1-4 restano validi/committati e la
pipeline degrada correttamente all'immagine intera senza chiave.

**Files:**
- Nessuna modifica stabile. Eventuale script temporaneo `scripts/_vision-check.ts` (prefisso `_`, non
  committato), sullo stile di `scripts/_find-sku.ts` del piano dizionario.

**Interfaces:**
- Consumes: `resolveBBox` con `askVisionDefault` reale; foto secondarie `product.images[1+]` di SKU
  reali (garden/mare) di cui la scansione a pixel oggi sbaglia il bbox (caso 2).

- [ ] **Step 1: raccogli 3+ foto secondarie che oggi falliscono**

Riusa il campione diagnostico (dondolo/ombrelloni/lettini) o rileva casi con uno script temporaneo:
scarica `product.images[1+]`, calcola `analizzaBBox` e seleziona quelle con `scartoAngoli >
SOGLIA_ANGOLI` (sfondo non uniforme) o con bbox implausibile (caso 2). Annota gli hash immagine.

- [ ] **Step 2: esegui `resolveBBox` reale su ciascuna**

Per ogni foto, chiama `resolveBBox(bytes, hash)` con i default reali (Vision + cache DB). Verifica:
- il bbox restituito è plausibile e racchiude il prodotto (ispezione visiva del crop `sharp().extract()`
  applicato al box), **oppure** è `null` (immagine intera) — mai il bbox sbagliato della scansione.
- seconda esecuzione sullo stesso hash → nessuna nuova chiamata Vision (hit di cache `VisionBBox`,
  verificabile via log/tempo o interrogando la tabella).

Criterio (spec §9): su ≥3 foto lifestyle che oggi falliscono, il prodotto non viene più amputato dal
crop. Annota per ciascuna: `scartoAngoli`, esito Vision (`trovato`/box), plausibilità.

- [ ] **Step 3: (opzionale) genera una scheda end-to-end**

Su uno SKU, forza l'uso di una foto secondaria problematica in `composeSceneForProduct` e conferma
visivamente che la scheda esportata non tagli il prodotto (frecce-quota coerenti o immagine intera con
frecce di default da sistemare a mano, come da spec §8).

- [ ] **Step 4: pulizia**

Rimuovi eventuale `scripts/_vision-check.ts`. Nessun commit di codice (task di validazione). Se emerge
la necessità di tarare `SOGLIA_ANGOLI` o le soglie di plausibilità, aprire un follow-up mirato con i
dati raccolti (non modificare a caso).

---

## Criteri di completamento

- `src/lib/images/bbox.ts`: `detectBBox` invariata (2 test originali verdi); esportati `analizzaBBox`,
  `bboxPlausibile`, `SOGLIA_ANGOLI`; nuovi test verdi.
- `prisma/schema.prisma`: model `VisionBBox` (pura cache, senza `status`); migration generata in
  `prisma/migrations/`; `vision-repository.ts` con round-trip testato su DB isolato.
- `src/lib/images/vision-bbox.ts`: prompt/schema/`askVisionDefault`/`parseVisionBBox`; `parseVisionBBox`
  non lancia mai, clampa ai bordi, applica `bboxPlausibile`; test offline verdi (nessuna rete).
- `src/lib/images/resolve-bbox.ts`: orchestrazione della spec §4; ramo uniforme senza Vision/DB; errori
  Vision non cachati; risultati Vision (incluso "non trovato") cachati; 5 test offline verdi.
- `scripts/compose-lib.ts`: usa `resolveBBox` al posto di `detectBBox`; crop e scena invariati.
- **Determinismo**: `render-svg.test.ts` e `layout-colonna-sinistra.test.ts` verdi, golden barbecue
  **byte-identico** (nessuna rigenerazione); `compose-e2e.test.ts` verde e offline (ramo uniforme).
- `npx tsc --noEmit` pulito e `npm test` verde sull'intero branch.
- Validazione end-to-end (Task 5) su ≥3 foto lifestyle reali: prodotto mai amputato dal crop
  (subordinato a `GEMINI_API_KEY` + rete; se BLOCKED, annotato — la pipeline degrada comunque
  all'immagine intera senza chiave).

## Note per fasi successive (backlog residuo)

- Editor: pulsante "ricalcola bbox con Vision" per forzare Vision anche su sfondo apparentemente
  uniforme; persistenza dell'override manuale del bbox trascinato dall'operatore.
- `promptVersion` nella PK di `VisionBBox` se il prompt Vision evolve in modo sostanziale (come
  `PROMPT_VERSION` per le estrazioni).
- Taratura di `SOGLIA_ANGOLI` e delle soglie di `bboxPlausibile` su un campione più ampio, con i dati
  del Task 5.
- Valutare `gemini-2.5-flash` per Vision se costo/latenza diventano critici su volumi maggiori.
- Backlog invariato dai lotti precedenti: template `griglia-sotto`/`multi-prodotto`, fix parser
  dimensioni formato `Ø`, licenza `solar`, titolo scheda con chiave categoria grezza, badge lungo
  tagliato.
- Batch senza revisione resta **fuori scope** (deciso con l'utente).
