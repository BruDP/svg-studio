# SVG Studio — Fase 1: Fondamenta e Motore di Estrazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Da uno SKU del feed Magento a una `SchedaProposal` deterministica (categoria + feature canoniche ordinate + dimensioni), verificabile da CLI, con cache in SQLite.

**Architecture:** App Next.js con logica di dominio in `src/lib/` (moduli puri, testabili senza UI). Il feed CSV viene scaricato/parsato/indicizzato in SQLite (Prisma). L'Extraction Engine orchestra: dizionario YAML → Gemini vincolato (temperature 0, structured output con enum chiusi) → validazione anti-allucinazione → ranking deterministico → cache per `(sku, inputHash)`.

**Tech Stack:** Next.js (App Router) + TypeScript, Prisma + SQLite, csv-parse, yaml + zod, @google/genai, Vitest, tsx per gli script CLI.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-03-svg-studio-design.md` (§2, §4, §5). I piani Fase 2 (icone/scena/export) e Fase 3 (editor UI/E2E) sono documenti separati.

## Global Constraints

- Feed: `https://www.satur.it/amfeed/feed/download?id=27&file=products.csv.csv`, separatore `;`, refresh se copia locale più vecchia di **24h**
- DB: SQLite, file **`data/svg-studio.db`**, un solo PC, migrazioni versionate in `prisma/migrations/`
- Gemini: **`temperature: 0`**, `seed: 1`, structured output con JSON Schema, `chiave_canonica` e `categoria` **enum chiusi** sul dizionario; modello `gemini-2.5-flash` con `thinkingBudget: 0`
- Determinismo: stesso input → proposta **byte-identica**; cache in tabella `Extraction` con chiave `(sku, inputHash)`; `inputHash = sha256(stableStringify(dati prodotto + versione dizionario + versione prompt))`
- Valori estratti non tracciabili nel testo sorgente → `verificata: false`, mai scartati in silenzio
- Max **7** feature icona in proposta; le chiavi `badge: true` viaggiano in lista separata
- Dizionario in `dictionary/*.yaml`, versionato in git, validato da test CI
- Node 20+, npm. Directory progetto: `C:/Users/deporzib/Desktop/svg-studio`
- Commit frequenti; messaggi in italiano, prefissi `feat:`/`test:`/`chore:`

---

### Task 1: Scaffold progetto Next.js + Vitest

**Files:**
- Create: intero scaffold Next.js (via generatore), `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (script `test`), `.gitignore`

**Interfaces:**
- Consumes: —
- Produces: progetto compilabile con alias `@/* → src/*`, comando `npm test` funzionante

- [ ] **Step 1: Scaffold in cartella temporanea e spostamento nella root del repo**

(create-next-app rifiuta directory non vuote; `docs/` esiste già)

```bash
cd "C:/Users/deporzib/Desktop/svg-studio"
npx create-next-app@latest tmp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
shopt -s dotglob
mv tmp-scaffold/* .
rmdir tmp-scaffold
```

Expected: cartelle `src/app/`, file `package.json`, `tsconfig.json`, `next.config.ts` nella root.

- [ ] **Step 2: Dipendenze di dominio e test**

```bash
npm i csv-parse yaml zod he @google/genai @prisma/client
npm i -D vitest tsx prisma @types/he
```

- [ ] **Step 3: Config Vitest + smoke test**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // fileParallelism: false — i test condividono il file SQLite data/svg-studio.db:
  // l'esecuzione parallela dei file di test causerebbe race condition sul DB.
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
})
```

`tests/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'

test('vitest è configurato', () => {
  expect(1 + 1).toBe(2)
})
```

In `package.json`, sezione `scripts`, aggiungi/sostituisci:

```json
"test": "vitest run"
```

- [ ] **Step 4: Aggiorna .gitignore**

Aggiungi in fondo a `.gitignore`:

```
data/
output/
.env
.env.local
```

- [ ] **Step 5: Verifica**

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest"
```

---

### Task 2: Prisma + schema DB

**Files:**
- Create: `prisma/schema.prisma`, `.env`, `src/lib/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `db: PrismaClient` (singleton, default export di `@/lib/db`); tabelle `FeedMeta`, `Product`, `Extraction`, `Icon`, `Scene`

- [ ] **Step 1: Schema Prisma**

`prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model FeedMeta {
  id           Int      @id @default(autoincrement())
  sourceHash   String
  downloadedAt DateTime @default(now())
}

model Product {
  sku        String   @id
  payload    String   // JSON di ProductRecord
  rowHash    String
  searchText String   // lowercase: sku + descrizione breve, per LIKE
  updatedAt  DateTime @updatedAt
}

model Extraction {
  sku       String
  inputHash String
  proposal  String   // JSON di SchedaProposal
  createdAt DateTime @default(now())

  @@id([sku, inputHash])
}

model Icon {
  key       String   @id // chiave canonica del dizionario
  svg       String
  source    String   // 'locale' | 'iconify:<set>' | 'gemini'
  license   String
  status    String   // 'approvata' | 'in-revisione'
  updatedAt DateTime @updatedAt
}

model Scene {
  sku       String   @id
  sceneJson String
  updatedAt DateTime @updatedAt
}
```

`.env` (root progetto — è gitignorato):

```
DATABASE_URL="file:../data/svg-studio.db"
```

- [ ] **Step 2: Migrazione iniziale**

```bash
mkdir -p data
npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema`, cartella `prisma/migrations/..._init/` creata.

- [ ] **Step 3: Singleton client**

`src/lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 4: Test round-trip**

`tests/db.test.ts`:

```ts
import { afterAll, expect, test } from 'vitest'
import { db } from '@/lib/db'

afterAll(async () => {
  await db.product.deleteMany({ where: { sku: 'TEST-SKU' } })
  await db.$disconnect()
})

test('upsert e lettura Product', async () => {
  await db.product.upsert({
    where: { sku: 'TEST-SKU' },
    create: { sku: 'TEST-SKU', payload: '{}', rowHash: 'x', searchText: 'test-sku' },
    update: { payload: '{}' },
  })
  const found = await db.product.findUnique({ where: { sku: 'TEST-SKU' } })
  expect(found?.rowHash).toBe('x')
})
```

- [ ] **Step 5: Verifica**

```bash
npm test
```

Expected: 2 file di test, tutti PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: schema Prisma e client SQLite"
```

---

### Task 3: Parser del feed CSV

**Files:**
- Create: `src/lib/feed/types.ts`, `src/lib/feed/parser.ts`, `tests/fixtures/feed-sample.csv`
- Test: `tests/feed-parser.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `interface ProductRecord` e `parseFeed(csvText: string): ProductRecord[]`

- [ ] **Step 1: Fixture con le stranezze reali del feed**

`tests/fixtures/feed-sample.csv` (header identico al feed reale, incluso il refuso `Imballo Lenght`; una riga completa e una minimale):

```csv
SKU;url1thumb;url2base;url3small;url4img1;url5img2;url6img3;url7img4;url8img5;Descrizione_Breve;"Descrizione Estesa";"Nota Tecnica";"Nota emozionale";Prezzo;"Prezzo Speciale";"Prezzo Speciale Da";"Prezzo Speciale Fino";Marchio;SottoMarchio;Url;Colore;"Imballo Lenght";"Imballo Width";"Imballo Height";Materiale
2137070;https://ex.it/a.jpeg;https://ex.it/a.jpeg;https://ex.it/a.jpeg;https://ex.it/b.jpeg;https://ex.it/c.jpeg;;;;"<p>Barbecue tondo rosso con ruote &#216;51xh.84,5 cm, BestBQ</p>";"<p>Barbecue tondo con ruote; in acciaio</p>";"Barbecue tondo con ruote BestBQ&#13;<br>Alimentazione a carbonella&#13;<br>Griglia cromata rimovibile&#13;<br>Misure: l. 51 x p. 63 x h. 84,5 cm&#13;<br>Colore: rosso";"Perch&#233; scegliere BestBQ?";"79.99 EUR";"59.99 EUR";7/3/26;7/30/26;Galileo;;barbecue-tondo-2137070;Rosso;53;53;40;Acciaio
2120836;https://ex.it/d.jpeg;;;;;;;;"<p>Set doccia</p>";"<p>Set doccia satinato</p>";"Set doccia&#13;<br>Barra 62 cm";"Relax.";"12.99 EUR";;;;Galileo;;set-doccia-2120836;Acciaio/Argento;;;;
```

- [ ] **Step 2: Tipi**

`src/lib/feed/types.ts`:

```ts
export interface ProductRecord {
  sku: string
  images: string[]
  descrizioneBreve: string
  descrizioneEstesa: string
  notaTecnica: string[]
  notaEmozionale: string
  prezzo: string
  marchio: string
  urlSlug: string
  colore: string
  materiale: string
  imballo: { lunghezza: number | null; larghezza: number | null; altezza: number | null }
}
```

- [ ] **Step 3: Test del parser (falliranno: parser non esiste)**

`tests/feed-parser.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseFeed } from '@/lib/feed/parser'

const csv = readFileSync('tests/fixtures/feed-sample.csv', 'utf8')

test('parsa le righe e i campi base', () => {
  const rows = parseFeed(csv)
  expect(rows).toHaveLength(2)
  expect(rows[0].sku).toBe('2137070')
  expect(rows[0].marchio).toBe('Galileo')
})

test('decodifica entità HTML e rimuove i tag', () => {
  const [r] = parseFeed(csv)
  expect(r.descrizioneBreve).toBe('Barbecue tondo rosso con ruote Ø51xh.84,5 cm, BestBQ')
  expect(r.notaEmozionale).toBe('Perché scegliere BestBQ?')
})

test('divide la Nota Tecnica in righe pulite', () => {
  const [r] = parseFeed(csv)
  expect(r.notaTecnica).toEqual([
    'Barbecue tondo con ruote BestBQ',
    'Alimentazione a carbonella',
    'Griglia cromata rimovibile',
    'Misure: l. 51 x p. 63 x h. 84,5 cm',
    'Colore: rosso',
  ])
})

test('immagini: deduplica e scarta i vuoti', () => {
  const rows = parseFeed(csv)
  expect(rows[0].images).toEqual(['https://ex.it/a.jpeg', 'https://ex.it/b.jpeg', 'https://ex.it/c.jpeg'])
  expect(rows[1].images).toEqual(['https://ex.it/d.jpeg'])
})

test('imballo numerico o null', () => {
  const rows = parseFeed(csv)
  expect(rows[0].imballo).toEqual({ lunghezza: 53, larghezza: 53, altezza: 40 })
  expect(rows[1].imballo).toEqual({ lunghezza: null, larghezza: null, altezza: null })
})
```

- [ ] **Step 4: Verifica che falliscano**

```bash
npx vitest run tests/feed-parser.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/feed/parser'`.

- [ ] **Step 5: Implementazione**

`src/lib/feed/parser.ts`:

```ts
import { parse } from 'csv-parse/sync'
import he from 'he'
import type { ProductRecord } from './types'

/** Decodifica entità HTML e rimuove i tag, preservando il testo. */
function clean(raw: string | undefined): string {
  if (!raw) return ''
  return he
    .decode(raw)
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .trim()
}

/** La Nota Tecnica usa "&#13;<br>" come separatore di riga. */
function splitNota(raw: string | undefined): string[] {
  if (!raw) return []
  return he
    .decode(raw)
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, '').replace(/\r/g, '').trim())
    .filter((line) => line.length > 0)
}

function toNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseFeed(csvText: string): ProductRecord[] {
  const rows: Record<string, string>[] = parse(csvText, {
    delimiter: ';',
    columns: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
  })

  return rows
    .filter((r) => r['SKU']?.trim())
    .map((r) => {
      const imageKeys = ['url1thumb', 'url2base', 'url3small', 'url4img1', 'url5img2', 'url6img3', 'url7img4', 'url8img5']
      const images = [...new Set(imageKeys.map((k) => r[k]?.trim()).filter((u): u is string => !!u))]
      return {
        sku: r['SKU'].trim(),
        images,
        descrizioneBreve: clean(r['Descrizione_Breve']),
        descrizioneEstesa: clean(r['Descrizione Estesa']),
        notaTecnica: splitNota(r['Nota Tecnica']),
        notaEmozionale: clean(r['Nota emozionale']),
        prezzo: r['Prezzo']?.trim() ?? '',
        marchio: r['Marchio']?.trim() ?? '',
        urlSlug: r['Url']?.trim() ?? '',
        colore: r['Colore']?.trim() ?? '',
        materiale: r['Materiale']?.trim() ?? '',
        imballo: {
          lunghezza: toNumber(r['Imballo Lenght']),
          larghezza: toNumber(r['Imballo Width']),
          altezza: toNumber(r['Imballo Height']),
        },
      }
    })
}
```

- [ ] **Step 6: Verifica**

```bash
npx vitest run tests/feed-parser.test.ts
```

Expected: 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: parser del feed products.csv con fixture reale"
```

---

### Task 4: Fetcher del feed + repository prodotti

**Files:**
- Create: `src/lib/feed/fetcher.ts`, `src/lib/feed/repository.ts`
- Test: `tests/feed-fetcher.test.ts`

**Interfaces:**
- Consumes: `parseFeed` (Task 3), `db` (Task 2)
- Produces: `refreshFeedIfStale(deps?): Promise<{ refreshed: boolean }>`, `getProduct(sku: string): Promise<ProductRecord | null>`, `searchProducts(q: string): Promise<{ sku: string; descrizioneBreve: string }[]>`

- [ ] **Step 1: Test (falliranno)**

`tests/feed-fetcher.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { db } from '@/lib/db'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct, searchProducts } from '@/lib/feed/repository'

const csv = readFileSync('tests/fixtures/feed-sample.csv', 'utf8')
const fakeDownload = async () => csv

beforeAll(async () => {
  await db.feedMeta.deleteMany()
  await db.product.deleteMany()
})

afterAll(async () => {
  await db.feedMeta.deleteMany()
  await db.product.deleteMany()
  await db.$disconnect()
})

test('primo avvio: scarica e indicizza', async () => {
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(true)
  expect(await db.product.count()).toBe(2)
})

test('entro 24h non riscarica', async () => {
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(false)
})

test('dopo 24h riscarica', async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
  await db.feedMeta.updateMany({ data: { downloadedAt: old } })
  const res = await refreshFeedIfStale({ download: fakeDownload })
  expect(res.refreshed).toBe(true)
})

test('getProduct restituisce il record parsato', async () => {
  const p = await getProduct('2137070')
  expect(p?.notaTecnica).toContain('Alimentazione a carbonella')
  expect(await getProduct('MANCANTE')).toBeNull()
})

test('searchProducts cerca per testo, case-insensitive', async () => {
  const hits = await searchProducts('BARBECUE')
  expect(hits.map((h) => h.sku)).toEqual(['2137070'])
})
```

- [ ] **Step 2: Verifica che falliscano**

```bash
npx vitest run tests/feed-fetcher.test.ts
```

Expected: FAIL — moduli mancanti.

- [ ] **Step 3: Implementazione fetcher**

`src/lib/feed/fetcher.ts`:

```ts
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { parseFeed } from './parser'

export const FEED_URL = 'https://www.satur.it/amfeed/feed/download?id=27&file=products.csv.csv'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

async function defaultDownload(): Promise<string> {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`Download feed fallito: HTTP ${res.status}`)
  return res.text()
}

export async function refreshFeedIfStale(
  deps: { download?: () => Promise<string> } = {},
): Promise<{ refreshed: boolean }> {
  const download = deps.download ?? defaultDownload
  const last = await db.feedMeta.findFirst({ orderBy: { downloadedAt: 'desc' } })
  if (last && Date.now() - last.downloadedAt.getTime() < MAX_AGE_MS) {
    return { refreshed: false }
  }

  const csvText = await download()
  const sourceHash = createHash('sha256').update(csvText).digest('hex')
  const records = parseFeed(csvText)

  for (const rec of records) {
    const payload = JSON.stringify(rec)
    const rowHash = createHash('sha256').update(payload).digest('hex')
    const searchText = `${rec.sku} ${rec.descrizioneBreve}`.toLowerCase()
    await db.product.upsert({
      where: { sku: rec.sku },
      create: { sku: rec.sku, payload, rowHash, searchText },
      update: { payload, rowHash, searchText },
    })
  }
  await db.feedMeta.create({ data: { sourceHash } })
  return { refreshed: true }
}
```

- [ ] **Step 4: Implementazione repository**

`src/lib/feed/repository.ts`:

```ts
import { db } from '@/lib/db'
import type { ProductRecord } from './types'

export async function getProduct(sku: string): Promise<ProductRecord | null> {
  const row = await db.product.findUnique({ where: { sku } })
  return row ? (JSON.parse(row.payload) as ProductRecord) : null
}

export async function searchProducts(q: string): Promise<{ sku: string; descrizioneBreve: string }[]> {
  const rows = await db.product.findMany({
    where: { searchText: { contains: q.toLowerCase() } },
    take: 20,
    orderBy: { sku: 'asc' },
  })
  return rows.map((r) => {
    const p = JSON.parse(r.payload) as ProductRecord
    return { sku: r.sku, descrizioneBreve: p.descrizioneBreve }
  })
}
```

- [ ] **Step 5: Verifica**

```bash
npx vitest run tests/feed-fetcher.test.ts
```

Expected: 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: fetcher feed con refresh 24h e repository prodotti"
```

---

### Task 5: Dizionario canonico (YAML + loader + validazione CI)

**Files:**
- Create: `dictionary/categories.yaml`, `dictionary/features.yaml`, `src/lib/dictionary/types.ts`, `src/lib/dictionary/loader.ts`
- Test: `tests/dictionary.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `interface FeatureDef`, `interface Dictionary`, `loadDictionary(baseDir?): Dictionary` (sincrona, con validazione; lancia errore descrittivo se il YAML è incoerente)

- [ ] **Step 1: Categorie**

`dictionary/categories.yaml`:

```yaml
version: 1
categorie:
  - frigorifero
  - congelatore
  - lavatrice
  - forno
  - condizionatore
  - aspirapolvere
  - piccoli_elettrodomestici
  - sedia_ufficio_gaming
  - arredo_interno
  - arredo_esterno
  - barbecue
  - valigie
  - bagno_doccia
  - altro
```

- [ ] **Step 2: Feature seed (ricavate dalle schede reali analizzate)**

`dictionary/features.yaml` — `valore: obbligatorio` significa che l'etichetta contiene `{valore}` e Gemini deve estrarre il dato; `assente` significa feature di sola presenza. `icona` è un id Iconify risolto in Fase 2 (qui è solo una stringa validata nel formato `set:nome`):

```yaml
version: 1
features:
  classe_energetica:
    label: "Classe {valore}"
    icona: tabler:leaf
    priorita: 95
    badge: false
    valore: obbligatorio
    categorie: [frigorifero, congelatore, lavatrice, forno, condizionatore]
  no_frost:
    label: "Sistema No Frost"
    icona: tabler:snowflake-off
    priorita: 90
    badge: false
    valore: assente
    categorie: [frigorifero, congelatore]
  capacita_litri:
    label: "{valore} L"
    icona: tabler:bucket
    priorita: 85
    badge: true
    valore: obbligatorio
    categorie: [frigorifero, congelatore, valigie, aspirapolvere, piccoli_elettrodomestici]
  display_touch:
    label: "Display touch"
    icona: tabler:hand-click
    priorita: 70
    badge: false
    valore: assente
    categorie: [frigorifero, congelatore, lavatrice, forno, condizionatore, piccoli_elettrodomestici]
  ripiani_regolabili:
    label: "Ripiani regolabili"
    icona: tabler:layout-rows
    priorita: 65
    badge: false
    valore: assente
    categorie: [frigorifero, congelatore, arredo_interno]
  lunghezza_cavo:
    label: "Cavo {valore} cm"
    icona: tabler:plug
    priorita: 40
    badge: false
    valore: obbligatorio
    categorie: [frigorifero, congelatore, lavatrice, forno, condizionatore, aspirapolvere, piccoli_elettrodomestici]
  portata_max_kg:
    label: "{valore} KG"
    icona: tabler:weight
    priorita: 88
    badge: true
    valore: obbligatorio
    categorie: [sedia_ufficio_gaming, arredo_interno, arredo_esterno]
  cuscini_inclusi:
    label: "Cuscini inclusi"
    icona: tabler:pillow
    priorita: 60
    badge: false
    valore: assente
    categorie: [sedia_ufficio_gaming, arredo_interno, arredo_esterno]
  ruote_spostamento:
    label: "Dotato di {valore} ruote per spostamento"
    icona: tabler:steering-wheel
    priorita: 62
    badge: false
    valore: obbligatorio
    categorie: [sedia_ufficio_gaming, arredo_interno]
  struttura_girevole:
    label: "Struttura girevole"
    icona: tabler:rotate
    priorita: 58
    badge: false
    valore: assente
    categorie: [sedia_ufficio_gaming]
  schienale_reclinabile:
    label: "Schienale reclinabile"
    icona: tabler:armchair
    priorita: 64
    badge: false
    valore: assente
    categorie: [sedia_ufficio_gaming, arredo_esterno]
  montaggio_facile:
    label: "Montaggio facile, kit incluso"
    icona: tabler:tools
    priorita: 30
    badge: false
    valore: assente
    categorie: [sedia_ufficio_gaming, arredo_interno, arredo_esterno, barbecue]
  pulizia_panno:
    label: "Pulire con un panno"
    icona: tabler:wash-dry-flat
    priorita: 20
    badge: false
    valore: assente
    categorie: [sedia_ufficio_gaming, arredo_interno, arredo_esterno]
  led_rgb:
    label: "{valore} effetti LED RGB selezionabili"
    icona: tabler:bulb
    priorita: 75
    badge: false
    valore: obbligatorio
    categorie: [sedia_ufficio_gaming, arredo_interno]
  struttura_acciaio:
    label: "Struttura in acciaio al carbonio"
    icona: tabler:building-factory-2
    priorita: 72
    badge: false
    valore: assente
    categorie: [arredo_interno, arredo_esterno, barbecue]
  cuscino_sfoderabile:
    label: "Cuscino sfoderabile"
    icona: tabler:zip
    priorita: 55
    badge: false
    valore: assente
    categorie: [arredo_interno, arredo_esterno, sedia_ufficio_gaming]
  fodera_lavabile:
    label: "Fodera lavabile a {valore}°"
    icona: tabler:wash
    priorita: 54
    badge: false
    valore: obbligatorio
    categorie: [arredo_interno, arredo_esterno]
  uso_interno_esterno:
    label: "Adatto ad uso interno ed esterno"
    icona: tabler:home-move
    priorita: 68
    badge: false
    valore: assente
    categorie: [arredo_esterno, arredo_interno]
  ruote_girevoli_360:
    label: "{valore} ruote girevoli a 360°"
    icona: tabler:wheel
    priorita: 70
    badge: false
    valore: obbligatorio
    categorie: [valigie]
  chiusura_combinazione:
    label: "Chiusura con combinazione"
    icona: tabler:lock-square
    priorita: 66
    badge: false
    valore: assente
    categorie: [valigie]
  doppia_cerniera:
    label: "Doppia cerniera"
    icona: tabler:separator-vertical
    priorita: 50
    badge: false
    valore: assente
    categorie: [valigie]
  manico_regolabile:
    label: "Manico regolabile"
    icona: tabler:arrow-autofit-up
    priorita: 52
    badge: false
    valore: assente
    categorie: [valigie, aspirapolvere]
  ultraleggero:
    label: "Ultraleggere e resistenti"
    icona: tabler:feather
    priorita: 48
    badge: false
    valore: assente
    categorie: [valigie]
  alimentazione_carbonella:
    label: "Alimentazione a carbonella"
    icona: tabler:flame
    priorita: 80
    badge: false
    valore: assente
    categorie: [barbecue]
```

- [ ] **Step 3: Test (falliranno)**

`tests/dictionary.test.ts`:

```ts
import { expect, test } from 'vitest'
import { loadDictionary } from '@/lib/dictionary/loader'

test('il dizionario reale carica e valida', () => {
  const dict = loadDictionary()
  expect(dict.version).toBe(1)
  expect(Object.keys(dict.features).length).toBeGreaterThanOrEqual(20)
  expect(dict.categorie).toContain('frigorifero')
})

test('ogni feature con valore obbligatorio ha {valore} nella label, e viceversa', () => {
  const dict = loadDictionary()
  for (const [key, f] of Object.entries(dict.features)) {
    const hasPlaceholder = f.label.includes('{valore}')
    expect(hasPlaceholder, `feature ${key}`).toBe(f.valore === 'obbligatorio')
  }
})

test('ogni categoria referenziata esiste', () => {
  const dict = loadDictionary()
  for (const f of Object.values(dict.features)) {
    for (const c of f.categorie) expect(dict.categorie).toContain(c)
  }
})

test('id icona nel formato set:nome', () => {
  const dict = loadDictionary()
  for (const f of Object.values(dict.features)) {
    expect(f.icona).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/)
  }
})

test('categoria inesistente in una feature → errore descrittivo', () => {
  expect(() => loadDictionary('tests/fixtures/dict-broken')).toThrow(/categoria sconosciuta/i)
})
```

Crea anche la fixture rotta `tests/fixtures/dict-broken/categories.yaml`:

```yaml
version: 1
categorie: [frigorifero]
```

e `tests/fixtures/dict-broken/features.yaml`:

```yaml
version: 1
features:
  no_frost:
    label: "Sistema No Frost"
    icona: tabler:snowflake-off
    priorita: 90
    badge: false
    valore: assente
    categorie: [lavatrice]
```

- [ ] **Step 4: Verifica che falliscano**

```bash
npx vitest run tests/dictionary.test.ts
```

Expected: FAIL — modulo loader mancante.

- [ ] **Step 5: Tipi + loader**

`src/lib/dictionary/types.ts`:

```ts
export interface FeatureDef {
  label: string
  icona: string
  priorita: number
  badge: boolean
  valore: 'obbligatorio' | 'assente'
  categorie: string[]
}

export interface Dictionary {
  version: number
  categorie: string[]
  features: Record<string, FeatureDef>
}
```

`src/lib/dictionary/loader.ts`:

```ts
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
```

- [ ] **Step 6: Verifica**

```bash
npx vitest run tests/dictionary.test.ts
```

Expected: 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: dizionario canonico YAML con loader validato"
```

---

### Task 6: Client Gemini vincolato

**Files:**
- Create: `src/lib/extraction/types.ts`, `src/lib/extraction/gemini.ts`
- Test: `tests/gemini.test.ts`

**Interfaces:**
- Consumes: `Dictionary` (Task 5), `ProductRecord` (Task 3)
- Produces: `interface RawFeature { chiave: string; valore: string | null; testoSorgente: string }`, `interface RawExtraction { categoria: string; features: RawFeature[] }`, `buildPrompt(product, dict): string`, `buildResponseSchema(dict): object`, `extractRaw(product, dict, generate?): Promise<RawExtraction>` — `generate` è iniettabile per i test; il default chiama l'API reale con `GEMINI_API_KEY`

- [ ] **Step 1: Tipi**

`src/lib/extraction/types.ts`:

```ts
export interface RawFeature {
  chiave: string
  valore: string | null
  testoSorgente: string
}

export interface RawExtraction {
  categoria: string
  features: RawFeature[]
}

export const PROMPT_VERSION = 1
```

- [ ] **Step 2: Test (falliranno)**

`tests/gemini.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseFeed } from '@/lib/feed/parser'
import { loadDictionary } from '@/lib/dictionary/loader'
import { buildPrompt, buildResponseSchema, extractRaw } from '@/lib/extraction/gemini'

const dict = loadDictionary()
const [product] = parseFeed(readFileSync('tests/fixtures/feed-sample.csv', 'utf8'))

test('lo schema di risposta vincola chiavi e categorie agli enum del dizionario', () => {
  const schema = buildResponseSchema(dict) as any
  expect(schema.properties.categoria.enum).toEqual(dict.categorie)
  expect(schema.properties.features.items.properties.chiave.enum).toEqual(Object.keys(dict.features).sort())
})

test('il prompt contiene la Nota Tecnica e le regole', () => {
  const prompt = buildPrompt(product, dict)
  expect(prompt).toContain('Alimentazione a carbonella')
  expect(prompt).toContain('NON inventare')
})

test('extractRaw usa il generate iniettato e parsa il JSON', async () => {
  const fake = async () =>
    JSON.stringify({
      categoria: 'barbecue',
      features: [{ chiave: 'alimentazione_carbonella', valore: null, testoSorgente: 'Alimentazione a carbonella' }],
    })
  const out = await extractRaw(product, dict, fake)
  expect(out.categoria).toBe('barbecue')
  expect(out.features[0].chiave).toBe('alimentazione_carbonella')
})
```

- [ ] **Step 3: Verifica che falliscano**

```bash
npx vitest run tests/gemini.test.ts
```

Expected: FAIL — modulo gemini mancante.

- [ ] **Step 4: Implementazione**

`src/lib/extraction/gemini.ts`:

```ts
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
```

- [ ] **Step 5: Verifica**

```bash
npx vitest run tests/gemini.test.ts
```

Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: client Gemini vincolato con structured output ed enum chiusi"
```

---

### Task 7: Validatore anti-allucinazione

**Files:**
- Create: `src/lib/extraction/validator.ts`
- Test: `tests/validator.test.ts`

**Interfaces:**
- Consumes: `RawExtraction`, `RawFeature` (Task 6), `ProductRecord` (Task 3)
- Produces: `interface ValidatedFeature extends RawFeature { verificata: boolean }`, `validateExtraction(raw: RawExtraction, product: ProductRecord): ValidatedFeature[]`

- [ ] **Step 1: Test (falliranno)**

`tests/validator.test.ts`:

```ts
import { expect, test } from 'vitest'
import { validateExtraction } from '@/lib/extraction/validator'
import type { ProductRecord } from '@/lib/feed/types'

const product: ProductRecord = {
  sku: 'X',
  images: [],
  descrizioneBreve: 'Frigorifero 4 porte 515L',
  descrizioneEstesa: '',
  notaTecnica: ['Capacità: 515 L', 'Sistema No Frost', 'Misure: 83,3x65,3x177,5 cm'],
  notaEmozionale: '',
  prezzo: '',
  marchio: '',
  urlSlug: '',
  colore: '',
  materiale: '',
  imballo: { lunghezza: null, larghezza: null, altezza: null },
}

test('valore presente nel testo → verificata', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'capacita_litri', valore: '515', testoSorgente: 'Capacità: 515 L' }] },
    product,
  )
  expect(out[0].verificata).toBe(true)
})

test('valore inventato → NON verificata (ma non scartata)', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'capacita_litri', valore: '600', testoSorgente: 'Capacità: 515 L' }] },
    product,
  )
  expect(out).toHaveLength(1)
  expect(out[0].verificata).toBe(false)
})

test('virgola e punto decimale sono equivalenti', () => {
  const out = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'lunghezza_cavo', valore: '83.3', testoSorgente: 'Misure: 83,3x65,3x177,5 cm' }] },
    product,
  )
  expect(out[0].verificata).toBe(true)
})

test('feature di sola presenza: verificata se testoSorgente compare nel testo', () => {
  const ok = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'no_frost', valore: null, testoSorgente: 'Sistema No Frost' }] },
    product,
  )
  const ko = validateExtraction(
    { categoria: 'frigorifero', features: [{ chiave: 'no_frost', valore: null, testoSorgente: 'Tecnologia inverter' }] },
    product,
  )
  expect(ok[0].verificata).toBe(true)
  expect(ko[0].verificata).toBe(false)
})
```

- [ ] **Step 2: Verifica che falliscano**

```bash
npx vitest run tests/validator.test.ts
```

Expected: FAIL — modulo mancante.

- [ ] **Step 3: Implementazione**

`src/lib/extraction/validator.ts`:

```ts
import type { ProductRecord } from '@/lib/feed/types'
import type { RawExtraction, RawFeature } from './types'

export interface ValidatedFeature extends RawFeature {
  verificata: boolean
}

/** Normalizza per il confronto: minuscole, virgola→punto, spazi collassati. */
function norm(s: string): string {
  return s.toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim()
}

function sourceText(product: ProductRecord): string {
  return norm([product.descrizioneBreve, product.descrizioneEstesa, ...product.notaTecnica].join(' \n '))
}

export function validateExtraction(raw: RawExtraction, product: ProductRecord): ValidatedFeature[] {
  const haystack = sourceText(product)
  return raw.features.map((f) => {
    const needle = f.valore !== null ? norm(f.valore) : norm(f.testoSorgente)
    return { ...f, verificata: needle.length > 0 && haystack.includes(needle) }
  })
}
```

- [ ] **Step 4: Verifica**

```bash
npx vitest run tests/validator.test.ts
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: validatore anti-allucinazione dei valori estratti"
```

---

### Task 8: Ranking deterministico + parsing dimensioni

**Files:**
- Create: `src/lib/extraction/ranking.ts`, `src/lib/extraction/dimensions.ts`
- Test: `tests/ranking.test.ts`, `tests/dimensions.test.ts`

**Interfaces:**
- Consumes: `ValidatedFeature` (Task 7), `Dictionary` (Task 5)
- Produces:
  - `interface ProposedFeature { chiave: string; etichetta: string; valore: string | null; verificata: boolean; priorita: number; badge: boolean }`
  - `rankFeatures(validated: ValidatedFeature[], categoria: string, dict: Dictionary): { features: ProposedFeature[]; badges: ProposedFeature[] }`
  - `interface Dimensioni { larghezza: number | null; profondita: number | null; altezza: number | null }`
  - `parseDimensions(notaTecnica: string[]): Dimensioni | null`

- [ ] **Step 1: Test ranking (falliranno)**

`tests/ranking.test.ts`:

```ts
import { expect, test } from 'vitest'
import { loadDictionary } from '@/lib/dictionary/loader'
import { rankFeatures } from '@/lib/extraction/ranking'
import type { ValidatedFeature } from '@/lib/extraction/validator'

const dict = loadDictionary()
const vf = (chiave: string, valore: string | null = null): ValidatedFeature => ({
  chiave,
  valore,
  testoSorgente: 'x',
  verificata: true,
})

test('ordina per priorità decrescente, tie-break alfabetico sulla chiave', () => {
  const out = rankFeatures([vf('display_touch'), vf('no_frost'), vf('classe_energetica', 'E')], 'frigorifero', dict)
  expect(out.features.map((f) => f.chiave)).toEqual(['classe_energetica', 'no_frost', 'display_touch'])
})

test('le chiavi badge finiscono in badges, non in features', () => {
  const out = rankFeatures([vf('capacita_litri', '515'), vf('no_frost')], 'frigorifero', dict)
  expect(out.badges.map((f) => f.chiave)).toEqual(['capacita_litri'])
  expect(out.features.map((f) => f.chiave)).toEqual(['no_frost'])
})

test('scarta le feature non applicabili alla categoria', () => {
  const out = rankFeatures([vf('doppia_cerniera'), vf('no_frost')], 'frigorifero', dict)
  expect(out.features.map((f) => f.chiave)).toEqual(['no_frost'])
})

test('massimo 7 feature icona: l ottava (priorità più bassa) viene tagliata', () => {
  // sedia_ufficio_gaming ha 8 feature icona applicabili nel dizionario seed
  const many = [
    vf('cuscini_inclusi'), vf('ruote_spostamento', '5'), vf('struttura_girevole'),
    vf('schienale_reclinabile'), vf('montaggio_facile'), vf('pulizia_panno'),
    vf('led_rgb', '338'), vf('cuscino_sfoderabile'),
  ]
  const out = rankFeatures(many, 'sedia_ufficio_gaming', dict)
  expect(out.features).toHaveLength(7)
  // pulizia_panno ha priorità 20, la più bassa: è quella esclusa
  expect(out.features.map((f) => f.chiave)).not.toContain('pulizia_panno')
})

test('etichetta compilata con il valore', () => {
  const out = rankFeatures([vf('classe_energetica', 'E')], 'frigorifero', dict)
  expect(out.features[0].etichetta).toBe('Classe E')
})

test('chiave duplicata: vince la prima occorrenza', () => {
  const out = rankFeatures([vf('no_frost'), vf('no_frost')], 'frigorifero', dict)
  expect(out.features.filter((f) => f.chiave === 'no_frost')).toHaveLength(1)
})
```

- [ ] **Step 2: Test dimensioni (falliranno)**

`tests/dimensions.test.ts`:

```ts
import { expect, test } from 'vitest'
import { parseDimensions } from '@/lib/extraction/dimensions'

test('formato "l. 51 x p. 63 x h. 84,5 cm"', () => {
  expect(parseDimensions(['Misure: l. 51 x p. 63 x h. 84,5 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})

test('formato compatto "83,3x65,3x177,5 cm"', () => {
  expect(parseDimensions(['Dimensioni: 83,3x65,3x177,5 cm'])).toEqual({
    larghezza: 83.3, profondita: 65.3, altezza: 177.5,
  })
})

test('nessuna misura → null', () => {
  expect(parseDimensions(['Colore: rosso'])).toBeNull()
})

test('usa la prima riga che contiene misure', () => {
  expect(parseDimensions(['Colore: rosso', 'Misure: l. 51 x p. 63 x h. 84,5 cm', '10x10x10 cm'])).toEqual({
    larghezza: 51, profondita: 63, altezza: 84.5,
  })
})
```

- [ ] **Step 3: Verifica che falliscano**

```bash
npx vitest run tests/ranking.test.ts tests/dimensions.test.ts
```

Expected: FAIL — moduli mancanti.

- [ ] **Step 4: Implementazione ranking**

`src/lib/extraction/ranking.ts`:

```ts
import type { Dictionary } from '@/lib/dictionary/types'
import type { ValidatedFeature } from './validator'

export const MAX_ICON_FEATURES = 7

export interface ProposedFeature {
  chiave: string
  etichetta: string
  valore: string | null
  verificata: boolean
  priorita: number
  badge: boolean
}

export function rankFeatures(
  validated: ValidatedFeature[],
  categoria: string,
  dict: Dictionary,
): { features: ProposedFeature[]; badges: ProposedFeature[] } {
  const seen = new Set<string>()
  const proposed: ProposedFeature[] = []

  for (const f of validated) {
    const def = dict.features[f.chiave]
    if (!def) continue
    if (!def.categorie.includes(categoria)) continue
    if (seen.has(f.chiave)) continue
    seen.add(f.chiave)
    proposed.push({
      chiave: f.chiave,
      etichetta: def.label.replace('{valore}', f.valore ?? ''),
      valore: f.valore,
      verificata: f.verificata,
      priorita: def.priorita,
      badge: def.badge,
    })
  }

  proposed.sort((a, b) => b.priorita - a.priorita || a.chiave.localeCompare(b.chiave))
  return {
    features: proposed.filter((f) => !f.badge).slice(0, MAX_ICON_FEATURES),
    badges: proposed.filter((f) => f.badge),
  }
}
```

- [ ] **Step 5: Implementazione dimensioni**

`src/lib/extraction/dimensions.ts`:

```ts
export interface Dimensioni {
  larghezza: number | null
  profondita: number | null
  altezza: number | null
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`
// "l. 51 x p. 63 x h. 84,5 cm" (etichettato) — provato per primo
const LABELED = new RegExp(String.raw`l\.?\s*${NUM}\s*x\s*p\.?\s*${NUM}\s*x\s*h\.?\s*${NUM}\s*cm`, 'i')
// "83,3x65,3x177,5 cm" (compatto, interpretato come L x P x H)
const COMPACT = new RegExp(String.raw`${NUM}\s*x\s*${NUM}\s*x\s*h?\.?\s*${NUM}\s*cm`, 'i')

function toNum(s: string): number {
  return Number.parseFloat(s.replace(',', '.'))
}

export function parseDimensions(notaTecnica: string[]): Dimensioni | null {
  for (const line of notaTecnica) {
    const m = LABELED.exec(line) ?? COMPACT.exec(line)
    if (m) return { larghezza: toNum(m[1]), profondita: toNum(m[2]), altezza: toNum(m[3]) }
  }
  return null
}
```

- [ ] **Step 6: Verifica**

```bash
npx vitest run tests/ranking.test.ts tests/dimensions.test.ts
```

Expected: 10 PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: ranking deterministico e parsing dimensioni"
```

---

### Task 9: Extraction Engine con cache e golden test di determinismo

**Files:**
- Create: `src/lib/stable.ts`, `src/lib/extraction/engine.ts`, `tests/fixtures/proposal-2137070.json` (snapshot committato)
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: tutto quanto sopra (`extractRaw`, `validateExtraction`, `rankFeatures`, `parseDimensions`, `db`, `Dictionary`)
- Produces:
  - `stableStringify(value: unknown): string` (JSON con chiavi ordinate, ricorsivo)
  - `interface SchedaProposal { sku: string; categoria: string; features: ProposedFeature[]; badges: ProposedFeature[]; dimensioni: Dimensioni | null }`
  - `extractProposal(product: ProductRecord, dict: Dictionary, generate?): Promise<SchedaProposal>` — cache-first su `Extraction(sku, inputHash)`

- [ ] **Step 1: Util stableStringify**

`src/lib/stable.ts`:

```ts
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)]),
    )
  }
  return v
}
```

- [ ] **Step 2: Test engine (falliranno)**

`tests/engine.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/feed/parser'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'

const dict = loadDictionary()
const [barbecue] = parseFeed(readFileSync('tests/fixtures/feed-sample.csv', 'utf8'))

const fakeGenerate = vi.fn(async () =>
  JSON.stringify({
    categoria: 'barbecue',
    features: [
      { chiave: 'alimentazione_carbonella', valore: null, testoSorgente: 'Alimentazione a carbonella' },
      { chiave: 'montaggio_facile', valore: null, testoSorgente: 'kit incluso' },
    ],
  }),
)

beforeAll(async () => { await db.extraction.deleteMany() })
afterAll(async () => { await db.extraction.deleteMany(); await db.$disconnect() })

test('GOLDEN: la proposta è byte-identica allo snapshot committato', async () => {
  const proposal = await extractProposal(barbecue, dict, fakeGenerate)
  const expected = readFileSync('tests/fixtures/proposal-2137070.json', 'utf8')
  expect(JSON.stringify(proposal, null, 2) + '\n').toBe(expected)
})

test('seconda chiamata: cache hit, Gemini NON richiamato', async () => {
  const calls = fakeGenerate.mock.calls.length
  const proposal2 = await extractProposal(barbecue, dict, fakeGenerate)
  expect(fakeGenerate.mock.calls.length).toBe(calls)
  expect(proposal2.categoria).toBe('barbecue')
})

test('input diverso → nuovo inputHash → Gemini richiamato', async () => {
  const calls = fakeGenerate.mock.calls.length
  const modificato = { ...barbecue, notaTecnica: [...barbecue.notaTecnica, 'Riga nuova'] }
  await extractProposal(modificato, dict, fakeGenerate)
  expect(fakeGenerate.mock.calls.length).toBe(calls + 1)
})
```

- [ ] **Step 3: Snapshot golden committato**

`tests/fixtures/proposal-2137070.json` (esattamente questo contenuto, newline finale inclusa — è il contratto di determinismo; le feature non verificate dal validatore restano con `verificata: false`):

```json
{
  "sku": "2137070",
  "categoria": "barbecue",
  "features": [
    {
      "chiave": "alimentazione_carbonella",
      "etichetta": "Alimentazione a carbonella",
      "valore": null,
      "verificata": true,
      "priorita": 80,
      "badge": false
    },
    {
      "chiave": "montaggio_facile",
      "etichetta": "Montaggio facile, kit incluso",
      "valore": null,
      "verificata": false,
      "priorita": 30,
      "badge": false
    }
  ],
  "badges": [],
  "dimensioni": {
    "larghezza": 51,
    "profondita": 63,
    "altezza": 84.5
  }
}
```

- [ ] **Step 4: Verifica che falliscano**

```bash
npx vitest run tests/engine.test.ts
```

Expected: FAIL — modulo engine mancante.

- [ ] **Step 5: Implementazione engine**

`src/lib/extraction/engine.ts` (nota: l'ordine di costruzione dell'oggetto proposta è fisso — sku, categoria, features, badges, dimensioni — perché `JSON.stringify` preserva l'ordine di inserimento ed è parte del contratto di determinismo):

```ts
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { stableStringify } from '@/lib/stable'
import type { Dictionary } from '@/lib/dictionary/types'
import type { ProductRecord } from '@/lib/feed/types'
import { extractRaw } from './gemini'
import { validateExtraction } from './validator'
import { rankFeatures, type ProposedFeature } from './ranking'
import { parseDimensions, type Dimensioni } from './dimensions'
import { PROMPT_VERSION } from './types'

export interface SchedaProposal {
  sku: string
  categoria: string
  features: ProposedFeature[]
  badges: ProposedFeature[]
  dimensioni: Dimensioni | null
}

export function computeInputHash(product: ProductRecord, dict: Dictionary): string {
  const material = stableStringify({
    product,
    dictVersion: dict.version,
    dictKeys: Object.keys(dict.features).sort(),
    promptVersion: PROMPT_VERSION,
  })
  return createHash('sha256').update(material).digest('hex')
}

export async function extractProposal(
  product: ProductRecord,
  dict: Dictionary,
  generate?: (prompt: string, dict: Dictionary) => Promise<string>,
): Promise<SchedaProposal> {
  const inputHash = computeInputHash(product, dict)

  const cached = await db.extraction.findUnique({
    where: { sku_inputHash: { sku: product.sku, inputHash } },
  })
  if (cached) return JSON.parse(cached.proposal) as SchedaProposal

  const raw = await extractRaw(product, dict, generate)
  const validated = validateExtraction(raw, product)
  const { features, badges } = rankFeatures(validated, raw.categoria, dict)

  const proposal: SchedaProposal = {
    sku: product.sku,
    categoria: raw.categoria,
    features,
    badges,
    dimensioni: parseDimensions(product.notaTecnica),
  }

  await db.extraction.create({
    data: { sku: product.sku, inputHash, proposal: JSON.stringify(proposal) },
  })
  return proposal
}
```

- [ ] **Step 6: Verifica**

```bash
npx vitest run tests/engine.test.ts
```

Expected: 3 PASS (incluso il golden byte-identico).

- [ ] **Step 7: Suite completa**

```bash
npm test
```

Expected: tutti i file di test PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: extraction engine con cache SQLite e golden test di determinismo"
```

---

### Task 10: CLI di verifica end-to-end

**Files:**
- Create: `scripts/propose.ts`, `.env.local.example`
- Modify: `package.json` (script `propose`), `README.md`

**Interfaces:**
- Consumes: `refreshFeedIfStale`, `getProduct`, `loadDictionary`, `extractProposal`
- Produces: comando `npm run propose -- <SKU>` che stampa la `SchedaProposal` in JSON

- [ ] **Step 1: Script CLI**

`scripts/propose.ts`:

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { db } from '@/lib/db'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'

async function main() {
  const sku = process.argv[2]
  if (!sku) {
    console.error('Uso: npm run propose -- <SKU>')
    process.exit(1)
  }

  const { refreshed } = await refreshFeedIfStale()
  console.error(refreshed ? 'Feed scaricato e indicizzato.' : 'Feed locale recente, nessun download.')

  const product = await getProduct(sku)
  if (!product) {
    console.error(`SKU ${sku} non trovato nel feed.`)
    process.exit(2)
  }

  const proposal = await extractProposal(product, loadDictionary())
  console.log(JSON.stringify(proposal, null, 2))
  await db.$disconnect()
}

main()
```

Installa dotenv e registra lo script:

```bash
npm i dotenv
```

In `package.json`, sezione `scripts`:

```json
"propose": "tsx scripts/propose.ts"
```

Nota: `tsx` risolve l'alias `@/*` leggendo `tsconfig.json` (campo `paths` già impostato dallo scaffold). Se il run fallisse con "Cannot find module '@/lib/db'", verifica che `tsconfig.json` contenga `"paths": { "@/*": ["./src/*"] }`.

- [ ] **Step 2: Esempio di configurazione**

`.env.local.example`:

```
GEMINI_API_KEY=la-tua-chiave-gemini
```

- [ ] **Step 3: README**

Sostituisci il contenuto di `README.md` con:

```markdown
# SVG Studio

Generatore di schede tecniche prodotto (satur.it) da feed Magento. Spec: `docs/superpowers/specs/`.

## Setup

1. `npm install`
2. `npx prisma migrate dev`
3. Copia `.env.local.example` in `.env.local` e inserisci la chiave Gemini

## Comandi

- `npm test` — suite Vitest (include validazione dizionario e golden test di determinismo)
- `npm run propose -- <SKU>` — scarica/aggiorna il feed e stampa la proposta di scheda per uno SKU
- `npm run dev` — app web (dalla Fase 3)
```

- [ ] **Step 4: Verifica manuale con API reale (richiede GEMINI_API_KEY in .env.local)**

```bash
npm run propose -- 2137070
```

Expected: JSON con `categoria` plausibile (es. `barbecue`) e feature con `verificata: true`. Rilanciando subito il comando, output identico e nessuna nuova chiamata API (cache hit — verificabile dal tempo di risposta immediato).

Se la chiave non è disponibile, expected: errore chiaro `GEMINI_API_KEY non impostata (usa .env.local)` — accettabile per chiudere il task, la verifica con chiave reale va fatta appena possibile.

- [ ] **Step 5: Suite completa + commit**

```bash
npm test
git add -A
git commit -m "feat: CLI propose per verifica end-to-end della Fase 1"
```

---

## Criteri di completamento Fase 1

- `npm test` verde (incluso golden test byte-identico e validazione CI del dizionario)
- `npm run propose -- <SKU reale>` produce una proposta sensata con chiave API vera
- Rilancio dello stesso comando → stessa proposta dalla cache, zero chiamate API
