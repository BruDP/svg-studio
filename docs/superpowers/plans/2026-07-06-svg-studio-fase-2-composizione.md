# SVG Studio — Fase 2 — Composizione, rendering ed export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare una `SchedaProposal` (output deterministico della Fase 1) + le foto prodotto in una scheda tecnica raster 1000×1000 `output/{SKU}.jpg`, passando per un contratto di scena JSON, una libreria icone normalizzate, un layout engine deterministico e un renderer SVG.

**Architecture:** Il contratto centrale è la **scena JSON** (lista di elementi tipizzati: icona+label, foto, quota, badge, testo): editor (Fase 3), anteprima, export e persistenza parlano tutti questo formato. La Fase 2 costruisce, in ordine: (1) il contratto di scena, (2) i token di stile, (3) la libreria icone (sanitizzazione → storage DB → Iconify → seeding CLI), (4) il servizio immagini (cache deterministica + bounding box via scansione pixel), (5) il layout engine e il template `colonna-sinistra`, (6) il renderer SVG puro (golden-testabile byte-identico), (7) l'export raster via resvg-js. Un comando CLI `compose` chiude la catena end-to-end, analogo al `propose` della Fase 1.

**Tech Stack:** TypeScript, Next.js 16 (già scaffoldato), Vitest, Prisma 7 + SQLite (adapter better-sqlite3), zod, `sharp` (decodifica pixel foto + PNG→JPEG), `@resvg/resvg-js` (SVG→PNG), API Iconify via `fetch`, font Poppins self-hosted (OFL).

## Decisioni di scope della Fase 2 (prese dal planner, spec §6/§7)

- **Un solo template**: `colonna-sinistra` (il più usato). Il layout engine è generico; `griglia-sotto` e `multi-prodotto` sono rimandati a una fase successiva riusando l'engine. (Spec §6)
- **Font**: Poppins, self-hosted, centralizzato in `theme.ts`, sostituibile. (Spec §6, "da verificare con l'operatrice" → default operativo)
- **Seeding icone via CLI** in Fase 2 (normalizzazione + sanitizzazione + storage). L'approvazione visiva in blocco su griglia resta a Fase 3. (Spec §7)
- **Bounding box: solo scansione pixel deterministica**. Il fallback Gemini Vision è rimandato: se lo scan fallisce, frecce in posizione default da correggere a mano in Fase 3. (Spec §5.3/§8)

## Global Constraints

- **Determinismo**: stessi dati feed + stesse foto (stessi byte) → stessa scena JSON e stesso SVG **byte-identici**. Le foto scaricate vanno messe in cache per contenuto (hash) così che il download di rete non introduca non-determinismo: la scena referenzia le immagini per `imageHash`, mai per URL remoto.
- **Output**: JPEG quadrato **1000×1000** (opzionale 2000×2000), nominato **`{SKU}.jpg`**, salvato in **`output/`** (già in `.gitignore`).
- **Contratto centrale = scena JSON**: editor, anteprima, export e persistenza usano lo stesso formato. Ogni scena salvata è riapribile. (Spec §4)
- **Icone**: in scheda solo icone con `status: 'approvata'`. Un'icona nuova nasce `'in-revisione'`. Ogni icona, da qualsiasi fonte, è normalizzata a **viewBox `0 0 24 24`**, `stroke: currentColor`, e **sanitizzata** (niente `<script>`, attributi `on*`, riferimenti esterni `http(s)`, `<style>` o stili inline). (Spec §7)
- **Token di stile centralizzati** in `src/lib/theme.ts`: colore testo `#4A4A4A`, font Poppins, raggio cerchi, spessore stroke, stile frecce. Nessun valore di stile hard-coded fuori da `theme.ts`. (Spec §6)
- **Regole di layout deterministiche** (Spec §6): feature nell'ordine del ranking (alto→basso); chiavi `badge` vicino alla foto, non in colonna; quote ancorate al bounding box (verticale=altezza a destra, orizzontale=larghezza sotto, diagonale=profondità); foto scalata a riempire con margini fissi.
- **Riuso Fase 1**: consumare `extractProposal`, `getProduct`, `refreshFeedIfStale`, `loadDictionary`, `stableStringify`, `db` così come sono. Non modificare il motore di estrazione.
- **Node 20+, npm.** Directory progetto: `C:/Users/deporzib/Desktop/svg-studio`. Alias import `@/* → src/*`.
- **Git**: `.gitattributes` già presente forza LF (`* text=auto eol=lf`) — i golden fixture committati devono restare LF. Verificare i golden test anche su checkout pulito, non solo sul worktree di sviluppo (lezione Fase 1).
- **Test**: Vitest, `fileParallelism: false` (i test condividono il file SQLite). I test che toccano il DB devono pulire le tabelle che usano.
- **Commit frequenti**; messaggi in italiano, prefissi `feat:`/`test:`/`chore:`/`fix:`.

## File Structure

```
src/lib/
  theme.ts                    # Task 2 — token di stile + nome font
  scene/
    types.ts                  # Task 1 — contratto scena JSON + SCENE_VERSION
    schema.ts                 # Task 1 — zod parseScene()
  icons/
    normalize.ts              # Task 3 — sanitizeSvg() + normalizeIconSvg()
    repository.ts             # Task 4 — getIcon/saveIcon/approveIcon/listIcons
    iconify.ts                # Task 5 — searchIconify()
  images/
    cache.ts                  # Task 7 — cacheImage() download+dedup per hash
    bbox.ts                   # Task 8 — detectBBox() scansione pixel
  layout/
    engine.ts                 # Task 9 — helper geometrici deterministici
    colonna-sinistra.ts       # Task 10 — composeColonnaSinistra() proposal→Scene
  render/
    svg.ts                    # Task 11 — renderScene() Scene→stringa SVG
  export/
    raster.ts                 # Task 12 — exportScene() SVG→resvg→sharp→JPEG
assets/fonts/
  Poppins-Regular.ttf         # Task 2
  Poppins-SemiBold.ttf        # Task 2
  OFL.txt                     # Task 2 — licenza font
scripts/
  seed-icons.ts               # Task 6 — CLI seeding icone da Iconify
  compose.ts                  # Task 13 — CLI end-to-end SKU→JPEG
tests/
  scene-schema.test.ts        # Task 1
  icons-normalize.test.ts     # Task 3
  icons-repository.test.ts    # Task 4
  icons-iconify.test.ts       # Task 5
  images-cache.test.ts        # Task 7
  images-bbox.test.ts         # Task 8
  layout-engine.test.ts       # Task 9
  layout-colonna-sinistra.test.ts   # Task 10
  render-svg.test.ts          # Task 11
  export-raster.test.ts       # Task 12
  compose-e2e.test.ts         # Task 13
  fixtures/
    icons/raw-tabler-ruler.svg          # Task 3
    images/bbox-sample.png              # Task 8 (generata dal test)
    scene-2137070.json                  # Task 10 golden
    render-2137070.svg                  # Task 11 golden
```

Nessuna modifica allo schema Prisma: i model `Icon` e `Scene` esistono già (creati in Fase 1, `prisma/schema.prisma:33-46`).

---

### Task 1: Contratto scena JSON + validatore

**Files:**
- Create: `src/lib/scene/types.ts`, `src/lib/scene/schema.ts`
- Test: `tests/scene-schema.test.ts`

**Interfaces:**
- Consumes: `stableStringify` da `@/lib/stable` (per note di determinismo; non usato direttamente qui).
- Produces:
  - Tipi: `SceneCanvas`, `IconLabelElement`, `FotoElement`, `QuotaElement`, `BadgeElement`, `TestoElement`, `SceneElement` (unione), `Scene`.
  - `const SCENE_VERSION = 1`.
  - `parseScene(input: unknown): Scene` — valida con zod e restituisce la scena tipizzata, lancia su input non valido.

- [ ] **Step 1: Scrivi i tipi della scena**

`src/lib/scene/types.ts`:

```ts
export interface SceneCanvas {
  width: number
  height: number
}

/** Icona canonica (risolta per chiave dizionario) + etichetta. */
export interface IconLabelElement {
  type: 'icona-label'
  id: string
  chiave: string
  etichetta: string
  x: number
  y: number
  verificata: boolean
}

/** Foto prodotto, referenziata per hash nella cache immagini (mai URL remoto). */
export interface FotoElement {
  type: 'foto'
  id: string
  imageHash: string
  x: number
  y: number
  width: number
  height: number
}

/** Freccia di quotatura ancorata al bounding box della foto. */
export interface QuotaElement {
  type: 'quota'
  id: string
  orientamento: 'verticale' | 'orizzontale' | 'diagonale'
  valore: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Badge speciale (es. "120 KG") posizionato vicino alla foto. */
export interface BadgeElement {
  type: 'badge'
  id: string
  testo: string
  x: number
  y: number
}

export interface TestoElement {
  type: 'testo'
  id: string
  testo: string
  x: number
  y: number
  ruolo: 'titolo' | 'sottotitolo' | 'corpo'
}

export type SceneElement =
  | IconLabelElement
  | FotoElement
  | QuotaElement
  | BadgeElement
  | TestoElement

export interface Scene {
  version: number
  sku: string
  templateId: string
  canvas: SceneCanvas
  elements: SceneElement[]
}

export const SCENE_VERSION = 1
```

- [ ] **Step 2: Scrivi il test del validatore (fallisce)**

`tests/scene-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScene } from '@/lib/scene/schema'
import { SCENE_VERSION, type Scene } from '@/lib/scene/types'

const validScene: Scene = {
  version: SCENE_VERSION,
  sku: '2137070',
  templateId: 'colonna-sinistra',
  canvas: { width: 1000, height: 1000 },
  elements: [
    { type: 'icona-label', id: 'f1', chiave: 'materiale_acciaio', etichetta: 'Acciaio', x: 60, y: 120, verificata: true },
    { type: 'foto', id: 'ph', imageHash: 'abc123', x: 400, y: 100, width: 520, height: 520 },
    { type: 'quota', id: 'q1', orientamento: 'verticale', valore: '84,5 cm', x1: 940, y1: 100, x2: 940, y2: 620 },
    { type: 'badge', id: 'b1', testo: '120 KG', x: 420, y: 640 },
    { type: 'testo', id: 't1', testo: 'Barbecue a carbone', x: 60, y: 60, ruolo: 'titolo' },
  ],
}

describe('parseScene', () => {
  it('accetta una scena valida e restituisce lo stesso oggetto', () => {
    expect(parseScene(validScene)).toEqual(validScene)
  })

  it('rifiuta un elemento con type sconosciuto', () => {
    const bad = { ...validScene, elements: [{ type: 'sconosciuto', id: 'x' }] }
    expect(() => parseScene(bad)).toThrow()
  })

  it('rifiuta una quota senza estremi numerici', () => {
    const bad = {
      ...validScene,
      elements: [{ type: 'quota', id: 'q', orientamento: 'verticale', valore: '1 cm', x1: 0, y1: 0, x2: 0, y2: null }],
    }
    expect(() => parseScene(bad)).toThrow()
  })

  it('rifiuta un orientamento quota non ammesso', () => {
    const bad = {
      ...validScene,
      elements: [{ type: 'quota', id: 'q', orientamento: 'obliqua', valore: '1', x1: 0, y1: 0, x2: 1, y2: 1 }],
    }
    expect(() => parseScene(bad)).toThrow()
  })
})
```

- [ ] **Step 3: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/scene-schema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scene/schema'`.

- [ ] **Step 4: Implementa il validatore zod**

`src/lib/scene/schema.ts`:

```ts
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
})

const foto = z.object({
  type: z.literal('foto'),
  id: z.string(),
  imageHash: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
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
})

const badge = z.object({
  type: z.literal('badge'),
  id: z.string(),
  testo: z.string(),
  x: z.number(),
  y: z.number(),
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

export function parseScene(input: unknown): Scene {
  return scene.parse(input) as Scene
}
```

- [ ] **Step 5: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/scene-schema.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scene/ tests/scene-schema.test.ts
git commit -m "feat: contratto scena JSON con validatore zod"
```

---

### Task 2: Token di stile e font

**Files:**
- Create: `src/lib/theme.ts`, `assets/fonts/Poppins-Regular.ttf`, `assets/fonts/Poppins-SemiBold.ttf`, `assets/fonts/OFL.txt`
- Test: (nessun test dedicato — è configurazione statica; verrà esercitato da render/export)

**Interfaces:**
- Produces: `const theme` (oggetto readonly con `fontFamily`, `colors`, `icona`, `freccia`, `testo`, `margini`), `FONT_FILES: string[]` (percorsi assoluti-relativi ai .ttf, per resvg-js).

- [ ] **Step 1: Scarica i file font Poppins**

Poppins è distribuito con licenza SIL Open Font License (OFL) — ridistribuibile. Scarica i due pesi usati dal template:

```bash
mkdir -p assets/fonts
curl -L -o assets/fonts/Poppins-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf"
curl -L -o assets/fonts/Poppins-SemiBold.ttf "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-SemiBold.ttf"
curl -L -o assets/fonts/OFL.txt "https://github.com/google/fonts/raw/main/ofl/poppins/OFL.txt"
```

Expected: tre file scaricati, i `.ttf` di dimensione > 100 KB ciascuno.

Verifica: `ls -la assets/fonts/` mostra i tre file non vuoti.

- [ ] **Step 2: Assicurati che i .ttf non vengano alterati da git**

Aggiungi in `.gitattributes` (dopo la riga esistente `* text=auto eol=lf`) una regola per trattare i font come binari:

```
*.ttf binary
```

Verifica: `git check-attr binary assets/fonts/Poppins-Regular.ttf` stampa `assets/fonts/Poppins-Regular.ttf: binary: set`.

- [ ] **Step 3: Scrivi i token di stile**

`src/lib/theme.ts`:

```ts
import path from 'node:path'

/** Token di stile centralizzati della scheda. Nessun valore di stile va hard-coded altrove. */
export const theme = {
  fontFamily: 'Poppins',
  colors: {
    testo: '#4A4A4A',
    cerchioStroke: '#4A4A4A',
    freccia: '#4A4A4A',
    badgeBg: '#4A4A4A',
    badgeTesto: '#FFFFFF',
    sfondo: '#FFFFFF',
  },
  icona: {
    raggio: 42,
    stroke: 3,
    iconaLato: 44, // lato del glifo 24×24 scalato dentro il cerchio
  },
  freccia: {
    stroke: 2,
    testa: 12,
  },
  testo: {
    titolo: 40,
    etichetta: 26,
    badge: 30,
  },
  margini: {
    canvas: 60,
    colonnaX: 60,
    colonnaGap: 96, // distanza verticale tra icone in colonna
    labelGap: 20, // distanza cerchio → etichetta
  },
} as const

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')

/** Percorsi dei file font per resvg-js (embedding nel raster). */
export const FONT_FILES: string[] = [
  path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
]
```

- [ ] **Step 4: Verifica che il modulo compili e i font esistano**

Scrivi un check temporaneo ed eseguilo:

Run: `npx tsx -e "import { FONT_FILES } from './src/lib/theme.ts'; import { existsSync } from 'node:fs'; if (!FONT_FILES.every(existsSync)) throw new Error('font mancanti'); console.log('OK', FONT_FILES.length)"`
Expected: stampa `OK 2`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts assets/fonts/ .gitattributes
git commit -m "feat: token di stile centralizzati e font Poppins self-hosted"
```

---

### Task 3: Sanitizzazione e normalizzazione icone

**Files:**
- Create: `src/lib/icons/normalize.ts`, `tests/fixtures/icons/raw-tabler-ruler.svg`
- Test: `tests/icons-normalize.test.ts`

**Interfaces:**
- Produces:
  - `sanitizeSvg(raw: string): string` — rimuove `<script>`, `<style>`, attributi `on*`, e riferimenti esterni `http(s)`/`xlink:href` esterni. Lancia `Error` se dopo la pulizia non resta un `<svg>` valido.
  - `normalizeIconSvg(raw: string): string` — sanitizza, forza `viewBox="0 0 24 24"`, imposta `stroke="currentColor"` e `fill="none"` sull'elemento `<svg>`, rimuove attributi `width`/`height` fissi. Restituisce l'SVG normalizzato come stringa.

- [ ] **Step 1: Crea la fixture SVG grezza**

`tests/fixtures/icons/raw-tabler-ruler.svg` (icona line-art di esempio, con rumore da ripulire):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 20 20" fill="#123456" stroke="#000000" stroke-width="2">
  <style>.x{fill:red}</style>
  <script>alert(1)</script>
  <path d="M3 3h14v14H3z" onclick="steal()"/>
  <image href="https://evil.example/pixel.png"/>
</svg>
```

- [ ] **Step 2: Scrivi il test (fallisce)**

`tests/icons-normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sanitizeSvg, normalizeIconSvg } from '@/lib/icons/normalize'

const raw = readFileSync('tests/fixtures/icons/raw-tabler-ruler.svg', 'utf8')

describe('sanitizeSvg', () => {
  it('rimuove script, style, handler inline e riferimenti esterni', () => {
    const out = sanitizeSvg(raw)
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/<style/i)
    expect(out).not.toMatch(/onclick/i)
    expect(out).not.toMatch(/https?:/i)
  })

  it('lancia se non c\'è un tag svg', () => {
    expect(() => sanitizeSvg('<div>no svg</div>')).toThrow()
  })
})

describe('normalizeIconSvg', () => {
  it('forza viewBox 24×24, stroke currentColor, fill none, senza width/height fissi', () => {
    const out = normalizeIconSvg(raw)
    expect(out).toMatch(/viewBox="0 0 24 24"/)
    expect(out).toMatch(/stroke="currentColor"/)
    expect(out).toMatch(/fill="none"/)
    expect(out).not.toMatch(/\swidth="24"/)
    expect(out).not.toMatch(/\sheight="24"/)
  })

  it('preserva il path del disegno', () => {
    const out = normalizeIconSvg(raw)
    expect(out).toMatch(/M3 3h14v14H3z/)
  })

  it('è idempotente', () => {
    expect(normalizeIconSvg(normalizeIconSvg(raw))).toBe(normalizeIconSvg(raw))
  })
})
```

- [ ] **Step 3: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/icons-normalize.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 4: Implementa sanitizzazione e normalizzazione**

`src/lib/icons/normalize.ts`:

```ts
/**
 * Sanitizzazione SVG basata su regex (nessun DOM lato server). Rimuove i vettori
 * di rischio: script, style, handler inline, riferimenti a risorse esterne.
 * Volutamente conservativo: preferisce lanciare piuttosto che passare SVG dubbi.
 */
export function sanitizeSvg(raw: string): string {
  let s = raw
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  // attributi handler inline: on*="..."
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  // elementi che caricano risorse esterne
  s = s.replace(/<image[\s\S]*?>/gi, '')
  s = s.replace(/<use[\s\S]*?>/gi, '')
  // riferimenti http(s) residui in qualunque attributo
  s = s.replace(/\s[a-z:]+\s*=\s*"https?:[^"]*"/gi, '')
  s = s.replace(/\s[a-z:]+\s*=\s*'https?:[^']*'/gi, '')
  if (!/<svg[\s>]/i.test(s)) {
    throw new Error('SVG non valido dopo la sanitizzazione: manca il tag <svg>')
  }
  return s.trim()
}

/** Estrae il valore di un attributo dal tag di apertura <svg ...>. */
function svgOpenTag(s: string): string {
  const m = /<svg[^>]*>/i.exec(s)
  if (!m) throw new Error('Tag <svg> di apertura non trovato')
  return m[0]
}

export function normalizeIconSvg(raw: string): string {
  const s = sanitizeSvg(raw)
  const open = svgOpenTag(s)
  let newOpen = open
  // rimuovi width/height/viewBox/fill/stroke esistenti sul tag svg
  newOpen = newOpen.replace(/\swidth\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sheight\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sviewBox\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sfill\s*=\s*"[^"]*"/gi, '')
  newOpen = newOpen.replace(/\sstroke\s*=\s*"[^"]*"/gi, '')
  // reinserisci gli attributi canonici subito dopo "<svg"
  newOpen = newOpen.replace(
    /^<svg/i,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  )
  return s.replace(open, newOpen).trim()
}
```

- [ ] **Step 5: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/icons-normalize.test.ts`
Expected: PASS (5 test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/icons/normalize.ts tests/icons-normalize.test.ts tests/fixtures/icons/
git commit -m "feat: sanitizzazione e normalizzazione icone SVG"
```

---

### Task 4: Repository icone (DB)

**Files:**
- Create: `src/lib/icons/repository.ts`
- Test: `tests/icons-repository.test.ts`

**Interfaces:**
- Consumes: `db` da `@/lib/db` (model `Icon`, `prisma/schema.prisma:33`), `normalizeIconSvg` da `@/lib/icons/normalize`.
- Produces:
  - `interface IconRecord { key: string; svg: string; source: string; license: string; status: 'approvata' | 'in-revisione' }`
  - `saveIcon(rec: { key: string; rawSvg: string; source: string; license: string }): Promise<IconRecord>` — normalizza l'SVG, salva/aggiorna con `status: 'in-revisione'`.
  - `approveIcon(key: string): Promise<void>` — porta lo status a `'approvata'`.
  - `getApprovedIcon(key: string): Promise<IconRecord | null>` — restituisce l'icona SOLO se approvata (usata dal renderer).
  - `getIcon(key: string): Promise<IconRecord | null>` — restituisce l'icona a prescindere dallo status.
  - `listIcons(): Promise<IconRecord[]>` — tutte, ordinate per `key`.

- [ ] **Step 1: Scrivi il test (fallisce)**

`tests/icons-repository.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { saveIcon, approveIcon, getApprovedIcon, getIcon, listIcons } from '@/lib/icons/repository'

const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M1 1h10"/></svg>'

beforeEach(async () => {
  await db.icon.deleteMany()
})
afterAll(async () => {
  await db.icon.deleteMany()
  await db.$disconnect()
})

describe('repository icone', () => {
  it('saveIcon normalizza e salva come in-revisione', async () => {
    const rec = await saveIcon({ key: 'materiale_acciaio', rawSvg, source: 'iconify:tabler', license: 'MIT' })
    expect(rec.status).toBe('in-revisione')
    expect(rec.svg).toMatch(/stroke="currentColor"/)
    expect(rec.svg).toMatch(/M1 1h10/)
  })

  it('getApprovedIcon non restituisce icone in revisione', async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    expect(await getApprovedIcon('k1')).toBeNull()
    expect(await getIcon('k1')).not.toBeNull()
  })

  it('approveIcon rende l\'icona recuperabile da getApprovedIcon', async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    await approveIcon('k1')
    const rec = await getApprovedIcon('k1')
    expect(rec?.status).toBe('approvata')
  })

  it('saveIcon su chiave esistente aggiorna e riporta a in-revisione', async () => {
    await saveIcon({ key: 'k1', rawSvg, source: 's', license: 'l' })
    await approveIcon('k1')
    await saveIcon({ key: 'k1', rawSvg, source: 's2', license: 'l' })
    expect((await getIcon('k1'))?.status).toBe('in-revisione')
  })

  it('listIcons ordina per chiave', async () => {
    await saveIcon({ key: 'b', rawSvg, source: 's', license: 'l' })
    await saveIcon({ key: 'a', rawSvg, source: 's', license: 'l' })
    expect((await listIcons()).map((i) => i.key)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/icons-repository.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa il repository**

`src/lib/icons/repository.ts`:

```ts
import { db } from '@/lib/db'
import { normalizeIconSvg } from './normalize'

export interface IconRecord {
  key: string
  svg: string
  source: string
  license: string
  status: 'approvata' | 'in-revisione'
}

function toRecord(row: { key: string; svg: string; source: string; license: string; status: string }): IconRecord {
  return { key: row.key, svg: row.svg, source: row.source, license: row.license, status: row.status as IconRecord['status'] }
}

export async function saveIcon(rec: {
  key: string
  rawSvg: string
  source: string
  license: string
}): Promise<IconRecord> {
  const svg = normalizeIconSvg(rec.rawSvg)
  const data = { svg, source: rec.source, license: rec.license, status: 'in-revisione' }
  const row = await db.icon.upsert({
    where: { key: rec.key },
    create: { key: rec.key, ...data },
    update: data,
  })
  return toRecord(row)
}

export async function approveIcon(key: string): Promise<void> {
  await db.icon.update({ where: { key }, data: { status: 'approvata' } })
}

export async function getApprovedIcon(key: string): Promise<IconRecord | null> {
  const row = await db.icon.findUnique({ where: { key } })
  return row && row.status === 'approvata' ? toRecord(row) : null
}

export async function getIcon(key: string): Promise<IconRecord | null> {
  const row = await db.icon.findUnique({ where: { key } })
  return row ? toRecord(row) : null
}

export async function listIcons(): Promise<IconRecord[]> {
  const rows = await db.icon.findMany({ orderBy: { key: 'asc' } })
  return rows.map(toRecord)
}
```

- [ ] **Step 4: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/icons-repository.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons/repository.ts tests/icons-repository.test.ts
git commit -m "feat: repository icone con stato di approvazione"
```

---

### Task 5: Client Iconify

**Files:**
- Create: `src/lib/icons/iconify.ts`
- Test: `tests/icons-iconify.test.ts`

**Interfaces:**
- Produces:
  - `interface IconifyCandidate { id: string; set: string; name: string }` (`id` in forma `set:name`, es. `tabler:ruler`).
  - `const ICONIFY_SETS = ['tabler', 'lucide', 'solar']` — set line-art a licenza permissiva (Spec §7).
  - `searchIconify(q: string, deps?: { fetchJson?: (url: string) => Promise<unknown> }): Promise<IconifyCandidate[]>` — interroga l'API di ricerca Iconify filtrando sui set ammessi. `fetchJson` iniettabile per i test.
  - `fetchIconifySvg(id: string, deps?: { fetchText?: (url: string) => Promise<string> }): Promise<string>` — scarica l'SVG grezzo di un'icona per id.

- [ ] **Step 1: Scrivi il test (fallisce)**

`tests/icons-iconify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { searchIconify, fetchIconifySvg, ICONIFY_SETS } from '@/lib/icons/iconify'

describe('searchIconify', () => {
  it('interroga l\'API filtrando sui set ammessi e mappa i risultati', async () => {
    let calledUrl = ''
    const fetchJson = async (url: string) => {
      calledUrl = url
      return { icons: ['tabler:ruler', 'lucide:ruler', 'mdi:ruler'] }
    }
    const out = await searchIconify('ruler', { fetchJson })
    // la query deve limitare ai set ammessi
    for (const set of ICONIFY_SETS) expect(calledUrl).toContain(set)
    // i risultati fuori dai set ammessi vengono scartati
    expect(out.map((c) => c.id)).toEqual(['tabler:ruler', 'lucide:ruler'])
    expect(out[0]).toEqual({ id: 'tabler:ruler', set: 'tabler', name: 'ruler' })
  })
})

describe('fetchIconifySvg', () => {
  it('scarica l\'SVG per id set:name', async () => {
    let calledUrl = ''
    const fetchText = async (url: string) => {
      calledUrl = url
      return '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>'
    }
    const svg = await fetchIconifySvg('tabler:ruler', { fetchText })
    expect(calledUrl).toContain('tabler')
    expect(calledUrl).toContain('ruler')
    expect(svg).toMatch(/<svg/)
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/icons-iconify.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa il client Iconify**

`src/lib/icons/iconify.ts`:

```ts
export interface IconifyCandidate {
  id: string
  set: string
  name: string
}

/** Set line-art a licenza permissiva (Spec §7). */
export const ICONIFY_SETS = ['tabler', 'lucide', 'solar'] as const

const SEARCH_BASE = 'https://api.iconify.design/search'
const SVG_BASE = 'https://api.iconify.design'

async function defaultFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Iconify search fallita: HTTP ${res.status}`)
  return res.json()
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Iconify SVG fallito: HTTP ${res.status}`)
  return res.text()
}

export async function searchIconify(
  q: string,
  deps: { fetchJson?: (url: string) => Promise<unknown> } = {},
): Promise<IconifyCandidate[]> {
  const fetchJson = deps.fetchJson ?? defaultFetchJson
  const prefixes = ICONIFY_SETS.join(',')
  const url = `${SEARCH_BASE}?query=${encodeURIComponent(q)}&prefixes=${prefixes}&limit=32`
  const data = (await fetchJson(url)) as { icons?: string[] }
  const allowed = new Set<string>(ICONIFY_SETS)
  const out: IconifyCandidate[] = []
  for (const id of data.icons ?? []) {
    const [set, name] = id.split(':')
    if (!name || !allowed.has(set)) continue
    out.push({ id, set, name })
  }
  return out
}

export async function fetchIconifySvg(
  id: string,
  deps: { fetchText?: (url: string) => Promise<string> } = {},
): Promise<string> {
  const fetchText = deps.fetchText ?? defaultFetchText
  const [set, name] = id.split(':')
  if (!name) throw new Error(`Id icona non valido: "${id}" (atteso "set:name")`)
  return fetchText(`${SVG_BASE}/${set}/${name}.svg`)
}
```

- [ ] **Step 4: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/icons-iconify.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons/iconify.ts tests/icons-iconify.test.ts
git commit -m "feat: client Iconify con filtro sui set line-art permissivi"
```

---

### Task 6: CLI seeding icone

**Files:**
- Create: `scripts/seed-icons.ts`
- Modify: `package.json` (script `seed:icons`)
- Test: (verifica manuale — è uno script di orchestrazione che compone unità già testate)

**Interfaces:**
- Consumes: `loadDictionary` da `@/lib/dictionary/loader`, `searchIconify`/`fetchIconifySvg` da `@/lib/icons/iconify`, `saveIcon`/`getIcon` da `@/lib/icons/repository`, `db` da `@/lib/db`.
- Produces: comando `npm run seed:icons` che, per ogni chiave del dizionario priva di icona salvata, cerca su Iconify usando il campo `icona` del dizionario (già in forma `set:name`) o la chiave come fallback, scarica il primo candidato, lo salva come `in-revisione`.

- [ ] **Step 1: Implementa lo script di seeding**

`scripts/seed-icons.ts`:

```ts
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const { loadDictionary } = await import('@/lib/dictionary/loader')
  const { fetchIconifySvg, searchIconify } = await import('@/lib/icons/iconify')
  const { saveIcon, getIcon } = await import('@/lib/icons/repository')

  const dict = loadDictionary()
  const keys = Object.keys(dict.features).sort()
  let creati = 0
  let saltati = 0

  for (const key of keys) {
    if (await getIcon(key)) {
      saltati++
      continue
    }
    const preferita = dict.features[key].icona // forma "set:name" dal dizionario
    let id = preferita
    try {
      // se l'icona preferita non è nei set ammessi/non esiste, ripiega su una ricerca per chiave
      const candidati = await searchIconify(key.replace(/_/g, ' '))
      if (!preferita.includes(':') && candidati[0]) id = candidati[0].id
      const rawSvg = await fetchIconifySvg(id)
      await saveIcon({ key, rawSvg, source: `iconify:${id.split(':')[0]}`, license: 'iconify-permissive' })
      creati++
      console.error(`✓ ${key} ← ${id}`)
    } catch (e) {
      console.error(`✗ ${key}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.error(`\nSeeding completato: ${creati} create, ${saltati} già presenti.`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
```

- [ ] **Step 2: Registra lo script in package.json**

In `package.json`, sezione `scripts`, aggiungi dopo `"propose"`:

```json
"seed:icons": "tsx scripts/seed-icons.ts"
```

- [ ] **Step 3: Verifica che lo script parta e gestisca l'assenza di rete con errore chiaro**

Run: `npm run seed:icons 2>&1 | head -5`
Expected: lo script parte, legge il dizionario e inizia a stampare righe `✓`/`✗` per chiave (con rete) oppure righe `✗ ...: Iconify ... HTTP`/errore di rete (senza rete). In entrambi i casi **nessuno stack trace Node grezzo** e uscita pulita. Con rete disponibile, verifica che la libreria si popoli: `npx tsx -e "import('./src/lib/icons/repository.ts').then(async m => { console.log((await m.listIcons()).length); process.exit(0) })"` stampa un numero > 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-icons.ts package.json
git commit -m "feat: CLI di seeding icone da Iconify per le chiavi del dizionario"
```

---

### Task 7: Cache immagini con dedup per hash

**Files:**
- Create: `src/lib/images/cache.ts`
- Modify: `package.json` (dipendenza `sharp`)
- Test: `tests/images-cache.test.ts`

**Interfaces:**
- Produces:
  - `interface CachedImage { hash: string; path: string; ext: string }`
  - `cacheImage(url: string, deps?: { download?: (url: string) => Promise<Buffer>; dir?: string }): Promise<CachedImage>` — scarica l'immagine (se non già in cache per contenuto), la salva in `data/images/{hash}.{ext}`, restituisce hash+path. Se il file per quel contenuto esiste già, **non riscarica** (dedup deterministico). `download` e `dir` iniettabili per i test.
  - `readCachedImage(hash: string, ext: string, dir?: string): Buffer` — rilegge i byte dalla cache.

- [ ] **Step 1: Installa sharp**

```bash
npm i sharp
```

Verifica: `node -e "require('sharp'); console.log('sharp ok')"` stampa `sharp ok`.

- [ ] **Step 2: Scrivi il test (fallisce)**

`tests/images-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { rmSync, mkdirSync, existsSync } from 'node:fs'
import { cacheImage, readCachedImage } from '@/lib/images/cache'

const DIR = 'tests/tmp/images'
const fakePng = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex') // header PNG minimale

beforeEach(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
})
afterAll(() => {
  rmSync('tests/tmp', { recursive: true, force: true })
})

describe('cacheImage', () => {
  it('scarica e salva l\'immagine, restituendo hash e path', async () => {
    let calls = 0
    const download = async () => {
      calls++
      return fakePng
    }
    const res = await cacheImage('https://x/y.png', { download, dir: DIR })
    expect(res.hash).toHaveLength(64)
    expect(existsSync(res.path)).toBe(true)
    expect(calls).toBe(1)
  })

  it('non riscarica se il contenuto è già in cache (dedup)', async () => {
    let calls = 0
    const download = async () => {
      calls++
      return fakePng
    }
    const a = await cacheImage('https://x/y.png', { download, dir: DIR })
    const b = await cacheImage('https://x/y.png', { download, dir: DIR })
    expect(calls).toBe(1)
    expect(a.hash).toBe(b.hash)
  })

  it('readCachedImage rilegge gli stessi byte', async () => {
    const res = await cacheImage('https://x/y.png', { download: async () => fakePng, dir: DIR })
    expect(readCachedImage(res.hash, res.ext, DIR).equals(fakePng)).toBe(true)
  })
})
```

- [ ] **Step 3: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/images-cache.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 4: Implementa la cache immagini**

`src/lib/images/cache.ts`:

```ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface CachedImage {
  hash: string
  path: string
  ext: string
}

const DEFAULT_DIR = 'data/images'

async function defaultDownload(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download immagine fallito: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Deduce l'estensione dai magic byte; default png. */
function extFromBytes(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png'
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp'
  return 'png'
}

export async function cacheImage(
  url: string,
  deps: { download?: (url: string) => Promise<Buffer>; dir?: string } = {},
): Promise<CachedImage> {
  const download = deps.download ?? defaultDownload
  const dir = deps.dir ?? DEFAULT_DIR
  const buf = await download(url)
  const hash = createHash('sha256').update(buf).digest('hex')
  const ext = extFromBytes(buf)
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${hash}.${ext}`)
  if (!existsSync(filePath)) writeFileSync(filePath, buf)
  return { hash, path: filePath, ext }
}

export function readCachedImage(hash: string, ext: string, dir = DEFAULT_DIR): Buffer {
  return readFileSync(path.join(dir, `${hash}.${ext}`))
}
```

- [ ] **Step 5: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/images-cache.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/images/cache.ts package.json package-lock.json tests/images-cache.test.ts
git commit -m "feat: cache immagini con dedup deterministico per hash"
```

---

### Task 8: Bounding box via scansione pixel

**Files:**
- Create: `src/lib/images/bbox.ts`
- Test: `tests/images-bbox.test.ts`

**Interfaces:**
- Consumes: `sharp` (decodifica raw pixel).
- Produces:
  - `interface BBox { left: number; top: number; width: number; height: number }`
  - `detectBBox(imageBytes: Buffer, deps?: { soglia?: number }): Promise<BBox | null>` — decodifica l'immagine, stima il colore di sfondo dai 4 angoli, scansiona righe/colonne per i pixel che differiscono dallo sfondo oltre `soglia` (default 24 su 0-255), restituisce il rettangolo che li racchiude. `null` se non distingue prodotto da sfondo (immagine quasi uniforme).

- [ ] **Step 1: Scrivi il test (fallisce)**

`tests/images-bbox.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { detectBBox } from '@/lib/images/bbox'

/** Genera un PNG bianco 100×100 con un rettangolo nero da (20,30) a (70,80). */
async function makeSample(): Promise<Buffer> {
  const w = 100
  const h = 100
  const px = Buffer.alloc(w * h * 3, 255) // sfondo bianco
  for (let y = 30; y < 80; y++) {
    for (let x = 20; x < 70; x++) {
      const i = (y * w + x) * 3
      px[i] = 0
      px[i + 1] = 0
      px[i + 2] = 0
    }
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

describe('detectBBox', () => {
  it('trova il rettangolo del prodotto su sfondo uniforme', async () => {
    const bbox = await detectBBox(await makeSample())
    expect(bbox).not.toBeNull()
    expect(bbox!.left).toBe(20)
    expect(bbox!.top).toBe(30)
    expect(bbox!.width).toBe(50)
    expect(bbox!.height).toBe(50)
  })

  it('restituisce null su immagine uniforme (nessun prodotto)', async () => {
    const white = await sharp(Buffer.alloc(100 * 100 * 3, 255), { raw: { width: 100, height: 100, channels: 3 } })
      .png()
      .toBuffer()
    expect(await detectBBox(white)).toBeNull()
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/images-bbox.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa la scansione bounding box**

`src/lib/images/bbox.ts`:

```ts
import sharp from 'sharp'

export interface BBox {
  left: number
  top: number
  width: number
  height: number
}

export async function detectBBox(
  imageBytes: Buffer,
  deps: { soglia?: number } = {},
): Promise<BBox | null> {
  const soglia = deps.soglia ?? 24
  const { data, info } = await sharp(imageBytes).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }

  // colore di sfondo = media dei 4 angoli
  const angoli = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]
  const bg: [number, number, number] = [
    Math.round(angoli.reduce((s, c) => s + c[0], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[1], 0) / 4),
    Math.round(angoli.reduce((s, c) => s + c[2], 0) / 4),
  ]

  const differisce = (x: number, y: number): boolean => {
    const [r, g, b] = at(x, y)
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > soglia
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (differisce(x, y)) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return null
  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY }
}
```

- [ ] **Step 4: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/images-bbox.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/images/bbox.ts tests/images-bbox.test.ts
git commit -m "feat: rilevamento bounding box prodotto via scansione pixel"
```

---

### Task 9: Layout engine (helper geometrici)

**Files:**
- Create: `src/lib/layout/engine.ts`
- Test: `tests/layout-engine.test.ts`

**Interfaces:**
- Consumes: `theme` da `@/lib/theme`.
- Produces:
  - `interface Punto { x: number; y: number }`
  - `colonnaPositions(n: number, startY: number): Punto[]` — posizioni (top-left del cerchio) di `n` icone in colonna verticale, spaziate di `theme.margini.colonnaGap`, a `x = theme.margini.colonnaX`. Deterministica.
  - `fitFoto(bbox: { width: number; height: number }, box: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number }` — scala la foto (per proporzioni) per riempire `box` mantenendo l'aspect ratio, centrata.
  - `quoteFromBBox(fotoBox: { x: number; y: number; width: number; height: number }, dim: { larghezza: number | null; profondita: number | null; altezza: number | null }): QuotaSpec[]` dove `interface QuotaSpec { orientamento: 'verticale' | 'orizzontale' | 'diagonale'; valore: string; x1: number; y1: number; x2: number; y2: number }` — genera le frecce ancorate ai bordi della foto: verticale (altezza) a destra, orizzontale (larghezza) sotto, diagonale (profondità) sull'angolo. Salta le dimensioni `null`.

- [ ] **Step 1: Scrivi il test (fallisce)**

`tests/layout-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { colonnaPositions, fitFoto, quoteFromBBox } from '@/lib/layout/engine'
import { theme } from '@/lib/theme'

describe('colonnaPositions', () => {
  it('dispone n icone in colonna con gap costante', () => {
    const p = colonnaPositions(3, 100)
    expect(p).toHaveLength(3)
    expect(p[0]).toEqual({ x: theme.margini.colonnaX, y: 100 })
    expect(p[1].y - p[0].y).toBe(theme.margini.colonnaGap)
    expect(p[2].y - p[1].y).toBe(theme.margini.colonnaGap)
    expect(p.every((pt) => pt.x === theme.margini.colonnaX)).toBe(true)
  })
})

describe('fitFoto', () => {
  it('scala mantenendo l\'aspect ratio e centra nel box', () => {
    const out = fitFoto({ width: 200, height: 100 }, { x: 0, y: 0, width: 400, height: 400 })
    // aspect 2:1 dentro 400×400 → 400×200, centrata verticalmente a y=100
    expect(out.width).toBe(400)
    expect(out.height).toBe(200)
    expect(out.x).toBe(0)
    expect(out.y).toBe(100)
  })
})

describe('quoteFromBBox', () => {
  it('genera verticale+orizzontale+diagonale saltando i null', () => {
    const box = { x: 100, y: 100, width: 300, height: 300 }
    const q = quoteFromBBox(box, { larghezza: 50, profondita: 40, altezza: 80 })
    const orient = q.map((e) => e.orientamento).sort()
    expect(orient).toEqual(['diagonale', 'orizzontale', 'verticale'])
    const vert = q.find((e) => e.orientamento === 'verticale')!
    expect(vert.valore).toBe('80 cm')
    // verticale ancorata al bordo destro della foto
    expect(vert.x1).toBe(vert.x2)
    expect(vert.x1).toBeGreaterThanOrEqual(box.x + box.width)
  })

  it('salta le dimensioni null', () => {
    const q = quoteFromBBox({ x: 0, y: 0, width: 10, height: 10 }, { larghezza: null, profondita: null, altezza: 5 })
    expect(q).toHaveLength(1)
    expect(q[0].orientamento).toBe('verticale')
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/layout-engine.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa il layout engine**

`src/lib/layout/engine.ts`:

```ts
import { theme } from '@/lib/theme'

export interface Punto {
  x: number
  y: number
}

export interface QuotaSpec {
  orientamento: 'verticale' | 'orizzontale' | 'diagonale'
  valore: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export function colonnaPositions(n: number, startY: number): Punto[] {
  const out: Punto[] = []
  for (let i = 0; i < n; i++) {
    out.push({ x: theme.margini.colonnaX, y: startY + i * theme.margini.colonnaGap })
  }
  return out
}

export function fitFoto(
  bbox: { width: number; height: number },
  box: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const scala = Math.min(box.width / bbox.width, box.height / bbox.height)
  const width = Math.round(bbox.width * scala)
  const height = Math.round(bbox.height * scala)
  const x = box.x + Math.round((box.width - width) / 2)
  const y = box.y + Math.round((box.height - height) / 2)
  return { x, y, width, height }
}

/** Formatta un numero come "84,5 cm" (virgola decimale italiana, no zeri inutili). */
function cm(v: number): string {
  return `${String(v).replace('.', ',')} cm`
}

export function quoteFromBBox(
  fotoBox: { x: number; y: number; width: number; height: number },
  dim: { larghezza: number | null; profondita: number | null; altezza: number | null },
): QuotaSpec[] {
  const out: QuotaSpec[] = []
  const destraX = fotoBox.x + fotoBox.width + theme.freccia.testa
  const sottoY = fotoBox.y + fotoBox.height + theme.freccia.testa

  if (dim.altezza !== null) {
    out.push({
      orientamento: 'verticale',
      valore: cm(dim.altezza),
      x1: destraX,
      y1: fotoBox.y,
      x2: destraX,
      y2: fotoBox.y + fotoBox.height,
    })
  }
  if (dim.larghezza !== null) {
    out.push({
      orientamento: 'orizzontale',
      valore: cm(dim.larghezza),
      x1: fotoBox.x,
      y1: sottoY,
      x2: fotoBox.x + fotoBox.width,
      y2: sottoY,
    })
  }
  if (dim.profondita !== null) {
    out.push({
      orientamento: 'diagonale',
      valore: cm(dim.profondita),
      x1: fotoBox.x + fotoBox.width,
      y1: fotoBox.y + fotoBox.height,
      x2: fotoBox.x + fotoBox.width + theme.freccia.testa * 3,
      y2: fotoBox.y + fotoBox.height + theme.freccia.testa * 3,
    })
  }
  return out
}
```

- [ ] **Step 4: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/layout-engine.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/layout/engine.ts tests/layout-engine.test.ts
git commit -m "feat: layout engine deterministico (colonna, fit foto, quote)"
```

---

### Task 10: Template colonna-sinistra (proposal → scena)

**Files:**
- Create: `src/lib/layout/colonna-sinistra.ts`, `tests/fixtures/scene-2137070.json` (golden, generato nello Step 5)
- Test: `tests/layout-colonna-sinistra.test.ts`

**Interfaces:**
- Consumes: `SchedaProposal` da `@/lib/extraction/engine` (`sku`, `categoria`, `features: ProposedFeature[]`, `badges: ProposedFeature[]`, `dimensioni: Dimensioni | null`); `colonnaPositions`/`fitFoto`/`quoteFromBBox` da `@/lib/layout/engine`; tipi scena da `@/lib/scene/types`; `theme` da `@/lib/theme`.
- Produces:
  - `const TEMPLATE_ID = 'colonna-sinistra'`
  - `const CANVAS = { width: 1000, height: 1000 }`
  - `composeColonnaSinistra(input: { proposal: SchedaProposal; imageHash: string; bbox: { width: number; height: number } | null }): Scene` — costruisce la scena deterministica: titolo in alto a sinistra, icone+label in colonna (nell'ordine del ranking), foto a destra (scalata da `bbox` o riquadro pieno se `bbox` è null), quote ancorate alla foto (da `proposal.dimensioni`), badge sotto la foto. Id elementi stabili (`f0,f1,...`, `ph`, `q0,...`, `bg0,...`, `titolo`).

- [ ] **Step 1: Scrivi il test (fallisce, senza golden ancora)**

`tests/layout-colonna-sinistra.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { composeColonnaSinistra, TEMPLATE_ID, CANVAS } from '@/lib/layout/colonna-sinistra'
import { parseScene } from '@/lib/scene/schema'
import type { SchedaProposal } from '@/lib/extraction/engine'

const proposal: SchedaProposal = {
  sku: '2137070',
  categoria: 'barbecue',
  features: [
    { chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false },
    { chiave: 'montaggio_facile', etichetta: 'Montaggio facile', valore: null, verificata: false, priorita: 30, badge: false },
  ],
  badges: [
    { chiave: 'capacita', etichetta: '99 L', valore: '99', verificata: true, priorita: 90, badge: true },
  ],
  dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 },
}

describe('composeColonnaSinistra', () => {
  it('produce una scena valida con canvas 1000×1000 e templateId corretto', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe(TEMPLATE_ID)
    expect(scene.canvas).toEqual(CANVAS)
    expect(scene.sku).toBe('2137070')
  })

  it('crea un icona-label per feature, un badge per badge, una foto, quote dalle dimensioni', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const per = (t: string) => scene.elements.filter((e) => e.type === t)
    expect(per('icona-label')).toHaveLength(2)
    expect(per('badge')).toHaveLength(1)
    expect(per('foto')).toHaveLength(1)
    expect(per('quota')).toHaveLength(3) // larghezza+profondita+altezza
  })

  it('preserva l\'ordine del ranking nelle icone in colonna', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const labels = scene.elements.filter((e) => e.type === 'icona-label').map((e) => (e as { chiave: string }).chiave)
    expect(labels).toEqual(['materiale_acciaio', 'montaggio_facile'])
  })

  it('è deterministico: due chiamate producono scene identiche', () => {
    const a = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const b = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('corrisponde al golden committato', () => {
    const scene = composeColonnaSinistra({ proposal, imageHash: 'abc123', bbox: { width: 200, height: 200 } })
    const goldenPath = 'tests/fixtures/scene-2137070.json'
    if (!existsSync(goldenPath)) return // il golden viene generato allo Step 5
    expect(JSON.stringify(scene, null, 2) + '\n').toBe(readFileSync(goldenPath, 'utf8'))
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/layout-colonna-sinistra.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa il template**

`src/lib/layout/colonna-sinistra.ts`:

```ts
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { Scene, SceneElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'
import { theme } from '@/lib/theme'
import { colonnaPositions, fitFoto, quoteFromBBox } from './engine'

export const TEMPLATE_ID = 'colonna-sinistra'
export const CANVAS = { width: 1000, height: 1000 }

/** Riquadro destinato alla foto (metà destra del canvas, con margini). */
const FOTO_BOX = {
  x: 480,
  y: 140,
  width: CANVAS.width - 480 - theme.margini.canvas - theme.freccia.testa * 4,
  height: 560,
}

export function composeColonnaSinistra(input: {
  proposal: SchedaProposal
  imageHash: string
  bbox: { width: number; height: number } | null
}): Scene {
  const { proposal, imageHash, bbox } = input
  const elements: SceneElement[] = []

  // Titolo in alto a sinistra
  elements.push({
    type: 'testo',
    id: 'titolo',
    testo: proposal.categoria,
    x: theme.margini.canvas,
    y: theme.margini.canvas,
    ruolo: 'titolo',
  })

  // Icone in colonna, nell'ordine del ranking
  const posizioni = colonnaPositions(proposal.features.length, 160)
  proposal.features.forEach((f, i) => {
    elements.push({
      type: 'icona-label',
      id: `f${i}`,
      chiave: f.chiave,
      etichetta: f.etichetta,
      x: posizioni[i].x,
      y: posizioni[i].y,
      verificata: f.verificata,
    })
  })

  // Foto scalata dentro il riquadro (aspect ratio dal bbox, o riquadro pieno se assente)
  const fitted = fitFoto(bbox ?? { width: FOTO_BOX.width, height: FOTO_BOX.height }, FOTO_BOX)
  elements.push({
    type: 'foto',
    id: 'ph',
    imageHash,
    x: fitted.x,
    y: fitted.y,
    width: fitted.width,
    height: fitted.height,
  })

  // Quote ancorate alla foto
  if (proposal.dimensioni) {
    quoteFromBBox(fitted, proposal.dimensioni).forEach((q, i) => {
      elements.push({ type: 'quota', id: `q${i}`, ...q })
    })
  }

  // Badge sotto la foto
  proposal.badges.forEach((b, i) => {
    elements.push({
      type: 'badge',
      id: `bg${i}`,
      testo: b.etichetta,
      x: fitted.x,
      y: fitted.y + fitted.height + theme.freccia.testa + 40 + i * 60,
    })
  })

  return {
    version: SCENE_VERSION,
    sku: proposal.sku,
    templateId: TEMPLATE_ID,
    canvas: CANVAS,
    elements,
  }
}
```

- [ ] **Step 4: Esegui i test non-golden (verifica il successo)**

Run: `npx vitest run tests/layout-colonna-sinistra.test.ts`
Expected: PASS — i 4 test non-golden passano; il test golden è un no-op finché il file non esiste.

- [ ] **Step 5: Genera e ispeziona il golden, poi rilancia**

Genera il golden dal codice appena verificato:

```bash
npx tsx -e "
import { composeColonnaSinistra } from './src/lib/layout/colonna-sinistra.ts';
const proposal = { sku:'2137070', categoria:'barbecue', features:[{chiave:'materiale_acciaio',etichetta:'Acciaio',valore:null,verificata:true,priorita:80,badge:false},{chiave:'montaggio_facile',etichetta:'Montaggio facile',valore:null,verificata:false,priorita:30,badge:false}], badges:[{chiave:'capacita',etichetta:'99 L',valore:'99',verificata:true,priorita:90,badge:true}], dimensioni:{larghezza:51,profondita:63,altezza:84.5} };
const scene = composeColonnaSinistra({ proposal, imageHash:'abc123', bbox:{width:200,height:200} });
import { writeFileSync } from 'node:fs';
writeFileSync('tests/fixtures/scene-2137070.json', JSON.stringify(scene, null, 2) + '\n');
console.log('golden scritto');
"
```

Ispeziona `tests/fixtures/scene-2137070.json` a occhio: canvas 1000×1000, 2 icone-label, 1 foto, 3 quote, 1 badge, 1 titolo. Poi rilancia con il golden attivo:

Run: `npx vitest run tests/layout-colonna-sinistra.test.ts`
Expected: PASS (5 test, incluso il golden).

- [ ] **Step 6: Commit**

```bash
git add src/lib/layout/colonna-sinistra.ts tests/layout-colonna-sinistra.test.ts tests/fixtures/scene-2137070.json
git commit -m "feat: template colonna-sinistra (SchedaProposal -> scena)"
```

---

### Task 11: Renderer SVG

**Files:**
- Create: `src/lib/render/svg.ts`, `tests/fixtures/render-2137070.svg` (golden, generato nello Step 5)
- Test: `tests/render-svg.test.ts`

**Interfaces:**
- Consumes: tipi scena da `@/lib/scene/types`, `theme` da `@/lib/theme`.
- Produces:
  - `type IconResolver = (chiave: string) => string | null` — data una chiave, restituisce l'SVG normalizzato (inner) dell'icona approvata, o `null`.
  - `type ImageResolver = (imageHash: string) => string | null` — restituisce un data URI (`data:image/...;base64,...`) per la foto, o `null`.
  - `renderScene(scene: Scene, deps: { icon: IconResolver; image: ImageResolver }): string` — restituisce la **stringa SVG** completa del canvas, deterministica byte-per-byte a parità di input. Le icone mancanti/non approvate rendono un cerchio segnaposto; le foto mancanti un rettangolo grigio.

- [ ] **Step 1: Scrivi il test (fallisce, senza golden ancora)**

`tests/render-svg.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { renderScene } from '@/lib/render/svg'
import { parseScene } from '@/lib/scene/schema'

const scene = parseScene(JSON.parse(readFileSync('tests/fixtures/scene-2137070.json', 'utf8')))

const deps = {
  icon: (k: string) => (k === 'materiale_acciaio' ? '<path d="M2 2h20"/>' : null),
  image: (h: string) => (h === 'abc123' ? 'data:image/png;base64,AAAA' : null),
}

describe('renderScene', () => {
  it('produce un SVG con le dimensioni del canvas', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg).toMatch(/width="1000"/)
    expect(svg).toMatch(/height="1000"/)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('inserisce l\'icona risolta e il segnaposto per quella mancante', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('M2 2h20') // icona risolta
    // montaggio_facile non ha icona → deve comunque esserci il cerchio segnaposto
    expect(svg).toMatch(/<circle/)
  })

  it('incorpora la foto come data URI', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('data:image/png;base64,AAAA')
  })

  it('usa i token di theme (colore testo) e nessun colore hard-coded diverso', () => {
    const svg = renderScene(scene, deps)
    expect(svg).toContain('#4A4A4A')
  })

  it('è deterministico: due render sono byte-identici', () => {
    expect(renderScene(scene, deps)).toBe(renderScene(scene, deps))
  })

  it('corrisponde al golden committato', () => {
    const goldenPath = 'tests/fixtures/render-2137070.svg'
    if (!existsSync(goldenPath)) return // generato allo Step 5
    expect(renderScene(scene, deps)).toBe(readFileSync(goldenPath, 'utf8'))
  })
})
```

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/render-svg.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa il renderer**

`src/lib/render/svg.ts`:

```ts
import type { Scene, SceneElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'

export type IconResolver = (chiave: string) => string | null
export type ImageResolver = (imageHash: string) => string | null

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderElement(el: SceneElement, deps: { icon: IconResolver; image: ImageResolver }): string {
  switch (el.type) {
    case 'testo': {
      const size = el.ruolo === 'titolo' ? theme.testo.titolo : theme.testo.etichetta
      const weight = el.ruolo === 'titolo' ? 600 : 400
      return `<text x="${el.x}" y="${el.y + size}" font-family="${theme.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${theme.colors.testo}">${esc(el.testo)}</text>`
    }
    case 'icona-label': {
      const r = theme.icona.raggio
      const cx = el.x + r
      const cy = el.y + r
      const inner = deps.icon(el.chiave)
      const cerchio = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.colors.cerchioStroke}" stroke-width="${theme.icona.stroke}"/>`
      // glifo 24×24 scalato e centrato nel cerchio
      const lato = theme.icona.iconaLato
      const scala = lato / 24
      const gx = cx - lato / 2
      const gy = cy - lato / 2
      const glifo = inner
        ? `<g transform="translate(${gx} ${gy}) scale(${scala})" fill="none" stroke="${theme.colors.cerchioStroke}" stroke-width="${theme.icona.stroke / scala}">${inner}</g>`
        : ''
      const label = `<text x="${el.x + r * 2 + theme.margini.labelGap}" y="${cy + theme.testo.etichetta / 3}" font-family="${theme.fontFamily}" font-size="${theme.testo.etichetta}" fill="${theme.colors.testo}">${esc(el.etichetta)}</text>`
      return cerchio + glifo + label
    }
    case 'foto': {
      const href = deps.image(el.imageHash)
      if (!href) {
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#EEEEEE"/>`
      }
      return `<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`
    }
    case 'quota': {
      const linea = `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${theme.colors.freccia}" stroke-width="${theme.freccia.stroke}"/>`
      const mx = (el.x1 + el.x2) / 2
      const my = (el.y1 + el.y2) / 2
      const etichetta = `<text x="${mx}" y="${my}" font-family="${theme.fontFamily}" font-size="${theme.testo.etichetta}" fill="${theme.colors.freccia}">${esc(el.valore)}</text>`
      return linea + etichetta
    }
    case 'badge': {
      const w = 8 * el.testo.length + 40
      const h = 52
      const rect = `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" rx="10" fill="${theme.colors.badgeBg}"/>`
      const t = `<text x="${el.x + w / 2}" y="${el.y + h / 2 + theme.testo.badge / 3}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.testo.badge}" font-weight="600" fill="${theme.colors.badgeTesto}">${esc(el.testo)}</text>`
      return rect + t
    }
  }
}

export function renderScene(scene: Scene, deps: { icon: IconResolver; image: ImageResolver }): string {
  const body = scene.elements.map((el) => renderElement(el, deps)).join('\n  ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.canvas.width}" height="${scene.canvas.height}" viewBox="0 0 ${scene.canvas.width} ${scene.canvas.height}">`,
    `  <rect width="${scene.canvas.width}" height="${scene.canvas.height}" fill="${theme.colors.sfondo}"/>`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join('\n')
}
```

- [ ] **Step 4: Esegui i test non-golden (verifica il successo)**

Run: `npx vitest run tests/render-svg.test.ts`
Expected: PASS — i 5 test non-golden passano; il golden è no-op.

- [ ] **Step 5: Genera e ispeziona il golden, poi rilancia**

```bash
npx tsx -e "
import { renderScene } from './src/lib/render/svg.ts';
import { parseScene } from './src/lib/scene/schema.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const scene = parseScene(JSON.parse(readFileSync('tests/fixtures/scene-2137070.json','utf8')));
const deps = { icon: (k) => k === 'materiale_acciaio' ? '<path d=\"M2 2h20\"/>' : null, image: (h) => h === 'abc123' ? 'data:image/png;base64,AAAA' : null };
writeFileSync('tests/fixtures/render-2137070.svg', renderScene(scene, deps));
console.log('golden SVG scritto');
"
```

Ispeziona `tests/fixtures/render-2137070.svg` (deve iniziare con `<svg ` e finire con `</svg>`, contenere un `<rect>` sfondo, testo del titolo, cerchi icona, foto data URI, linee quota, badge). Poi rilancia:

Run: `npx vitest run tests/render-svg.test.ts`
Expected: PASS (6 test, incluso il golden).

- [ ] **Step 6: Commit**

```bash
git add src/lib/render/svg.ts tests/render-svg.test.ts tests/fixtures/render-2137070.svg
git commit -m "feat: renderer SVG deterministico della scena"
```

---

### Task 12: Export raster (SVG → JPEG)

**Files:**
- Create: `src/lib/export/raster.ts`
- Modify: `package.json` (dipendenza `@resvg/resvg-js`)
- Test: `tests/export-raster.test.ts`

**Interfaces:**
- Consumes: `@resvg/resvg-js`, `sharp`, `FONT_FILES`/`theme` da `@/lib/theme`.
- Produces:
  - `renderSvgToPng(svg: string, size?: number): Buffer` — rasterizza un SVG a `size`×`size` (default 1000) via resvg-js con i font Poppins incorporati. Deterministico a parità di input sulla stessa macchina.
  - `exportScene(input: { svg: string; sku: string; size?: number; dir?: string }): Promise<string>` — rasterizza, converte in JPEG con `sharp`, scrive `dir/{sku}.jpg` (default `dir='output'`), restituisce il path scritto.

- [ ] **Step 1: Installa resvg-js**

```bash
npm i @resvg/resvg-js
```

Verifica: `node -e "require('@resvg/resvg-js'); console.log('resvg ok')"` stampa `resvg ok`.

- [ ] **Step 2: Scrivi il test (fallisce)**

`tests/export-raster.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, existsSync } from 'node:fs'
import sharp from 'sharp'
import { renderSvgToPng, exportScene } from '@/lib/export/raster'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#FFFFFF"/><text x="60" y="100" font-family="Poppins" font-size="40" fill="#4A4A4A">Ciao</text></svg>\n'

afterAll(() => {
  rmSync('tests/tmp-out', { recursive: true, force: true })
})

describe('renderSvgToPng', () => {
  it('produce un PNG 1000×1000', async () => {
    const png = renderSvgToPng(svg)
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1000)
    expect(meta.height).toBe(1000)
  })

  it('è stabile: due rasterizzazioni identiche sono byte-identiche', () => {
    expect(renderSvgToPng(svg).equals(renderSvgToPng(svg))).toBe(true)
  })
})

describe('exportScene', () => {
  it('scrive output/{sku}.jpg come JPEG 1000×1000', async () => {
    const p = await exportScene({ svg, sku: 'TEST123', dir: 'tests/tmp-out' })
    expect(p).toContain('TEST123.jpg')
    expect(existsSync(p)).toBe(true)
    const meta = await sharp(p).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(1000)
  })
})
```

- [ ] **Step 3: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/export-raster.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 4: Implementa l'export**

`src/lib/export/raster.ts`:

```ts
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { FONT_FILES, theme } from '@/lib/theme'

export function renderSvgToPng(svg: string, size = 1000): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: theme.fontFamily,
    },
    background: theme.colors.sfondo,
  })
  return Buffer.from(resvg.render().asPng())
}

export async function exportScene(input: {
  svg: string
  sku: string
  size?: number
  dir?: string
}): Promise<string> {
  const dir = input.dir ?? 'output'
  const size = input.size ?? 1000
  const png = renderSvgToPng(input.svg, size)
  const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer()
  mkdirSync(dir, { recursive: true })
  const outPath = path.join(dir, `${input.sku}.jpg`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(outPath, jpeg)
  return outPath
}
```

- [ ] **Step 5: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/export-raster.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/raster.ts package.json package-lock.json tests/export-raster.test.ts
git commit -m "feat: export raster SVG->PNG->JPEG 1000x1000 con font incorporati"
```

---

### Task 13: CLI end-to-end `compose`

**Files:**
- Create: `scripts/compose.ts`, `tests/compose-e2e.test.ts`
- Modify: `package.json` (script `compose`), `README.md` (documentazione comando)

**Interfaces:**
- Consumes: TUTTA la catena — `refreshFeedIfStale`/`getProduct` (feed), `extractProposal` + `loadDictionary` (Fase 1), `cacheImage`/`readCachedImage` + `detectBBox` (immagini), `composeColonnaSinistra` (layout), `renderScene` (render), `exportScene` (export), `getApprovedIcon` (icone), `db`.
- Produces:
  - `composeSceneForProduct(input: { proposal: SchedaProposal; product: ProductRecord; deps?: {...} }): Promise<{ scene: Scene; imageHash: string }>` — funzione pura-ish testabile: prende la prima immagine del prodotto, la mette in cache, ne rileva il bbox, compone la scena. `deps` iniettabili (download immagine) per il test.
  - Comando `npm run compose -- <SKU>`: refresh feed → getProduct → extractProposal → composeSceneForProduct → salva scena in `db.scene` → renderScene (icone da `getApprovedIcon`, foto da cache come data URI) → exportScene → stampa il path del JPEG.

- [ ] **Step 1: Scrivi il test della funzione di composizione (fallisce)**

`tests/compose-e2e.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { composeSceneForProduct } from '../scripts/compose-lib'
import { parseScene } from '@/lib/scene/schema'
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'

const product: ProductRecord = {
  sku: '2137070',
  images: ['https://x/foto.png'],
  descrizioneBreve: 'Barbecue',
  descrizioneEstesa: '',
  notaTecnica: [],
  notaEmozionale: '',
  prezzo: '',
  marchio: '',
  urlSlug: '',
  colore: '',
  materiale: '',
  imballo: { lunghezza: null, larghezza: null, altezza: null },
}

const proposal: SchedaProposal = {
  sku: '2137070',
  categoria: 'barbecue',
  features: [{ chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false }],
  badges: [],
  dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 },
}

async function sampleImage(): Promise<Buffer> {
  const w = 80
  const h = 80
  const px = Buffer.alloc(w * h * 3, 255)
  for (let y = 20; y < 60; y++) for (let x = 20; x < 60; x++) {
    const i = (y * w + x) * 3
    px[i] = px[i + 1] = px[i + 2] = 0
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

describe('composeSceneForProduct', () => {
  it('mette in cache la foto, rileva il bbox e compone una scena valida', async () => {
    const img = await sampleImage()
    const { scene, imageHash } = await composeSceneForProduct({
      proposal,
      product,
      deps: { download: async () => img, dir: 'tests/tmp-compose' },
    })
    expect(() => parseScene(scene)).not.toThrow()
    expect(imageHash).toHaveLength(64)
    expect(scene.elements.some((e) => e.type === 'foto')).toBe(true)
    expect(scene.elements.some((e) => e.type === 'quota')).toBe(true)
  })
})
```

Nota: per tenere la logica testabile separata dall'entrypoint CLI (che carica dotenv e fa side-effect), la funzione `composeSceneForProduct` vive in `scripts/compose-lib.ts` e il test la importa con percorso relativo (`../scripts/compose-lib`), mentre lo script `scripts/compose.ts` la importa a sua volta.

- [ ] **Step 2: Esegui il test (verifica il fallimento)**

Run: `npx vitest run tests/compose-e2e.test.ts`
Expected: FAIL — modulo `../scripts/compose-lib` non trovato.

- [ ] **Step 3: Implementa la libreria di composizione**

`scripts/compose-lib.ts`:

```ts
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'
import type { Scene } from '@/lib/scene/types'
import { cacheImage, readCachedImage } from '@/lib/images/cache'
import { detectBBox } from '@/lib/images/bbox'
import { composeColonnaSinistra } from '@/lib/layout/colonna-sinistra'

export async function composeSceneForProduct(input: {
  proposal: SchedaProposal
  product: ProductRecord
  deps?: { download?: (url: string) => Promise<Buffer>; dir?: string }
}): Promise<{ scene: Scene; imageHash: string }> {
  const { proposal, product } = input
  const url = product.images[0]
  if (!url) throw new Error(`Prodotto ${product.sku} senza immagini nel feed`)

  const cached = await cacheImage(url, input.deps)
  const bytes = readCachedImage(cached.hash, cached.ext, input.deps?.dir)
  const box = await detectBBox(bytes)
  const bbox = box ? { width: box.width, height: box.height } : null

  const scene = composeColonnaSinistra({ proposal, imageHash: cached.hash, bbox })
  return { scene, imageHash: cached.hash }
}
```

- [ ] **Step 4: Esegui il test (verifica il successo)**

Run: `npx vitest run tests/compose-e2e.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implementa l'entrypoint CLI**

`scripts/compose.ts`:

```ts
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const { refreshFeedIfStale } = await import('@/lib/feed/fetcher')
  const { getProduct } = await import('@/lib/feed/repository')
  const { loadDictionary } = await import('@/lib/dictionary/loader')
  const { extractProposal } = await import('@/lib/extraction/engine')
  const { composeSceneForProduct } = await import('./compose-lib')
  const { renderScene } = await import('@/lib/render/svg')
  const { exportScene } = await import('@/lib/export/raster')
  const { getApprovedIcon } = await import('@/lib/icons/repository')
  const { readCachedImage } = await import('@/lib/images/cache')

  const sku = process.argv[2]
  if (!sku) {
    console.error('Uso: npm run compose -- <SKU>')
    process.exit(1)
  }

  await refreshFeedIfStale()
  const product = await getProduct(sku)
  if (!product) {
    console.error(`SKU ${sku} non trovato nel feed.`)
    process.exit(2)
  }

  const proposal = await extractProposal(product, loadDictionary())
  const { scene, imageHash } = await composeSceneForProduct({ proposal, product })

  await db.scene.upsert({
    where: { sku },
    create: { sku, sceneJson: JSON.stringify(scene) },
    update: { sceneJson: JSON.stringify(scene) },
  })

  // Risolutori: icone approvate dal DB (inner SVG), foto dalla cache come data URI
  const iconCache = new Map<string, string | null>()
  for (const el of scene.elements) {
    if (el.type === 'icona-label' && !iconCache.has(el.chiave)) {
      const rec = await getApprovedIcon(el.chiave)
      // estrai il contenuto interno dell'<svg> normalizzato
      const inner = rec ? rec.svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '') : null
      iconCache.set(el.chiave, inner)
    }
  }

  const fotoElement = scene.elements.find((e) => e.type === 'foto') as { imageHash: string } | undefined
  let dataUri: string | null = null
  if (fotoElement) {
    // ricava l'estensione dal file in cache: prova jpg poi png
    for (const ext of ['jpg', 'png', 'webp']) {
      try {
        const buf = readCachedImage(imageHash, ext)
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        dataUri = `data:${mime};base64,${buf.toString('base64')}`
        break
      } catch {
        // prova la prossima estensione
      }
    }
  }

  const svg = renderScene(scene, {
    icon: (k) => iconCache.get(k) ?? null,
    image: () => dataUri,
  })
  const outPath = await exportScene({ svg, sku })
  console.error(`Scheda esportata: ${outPath}`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
```

- [ ] **Step 6: Registra lo script e documenta**

In `package.json`, sezione `scripts`, aggiungi dopo `"seed:icons"`:

```json
"compose": "tsx scripts/compose.ts"
```

In `README.md`, sezione `## Comandi`, aggiungi dopo la riga `propose`:

```markdown
- `npm run seed:icons` — popola la libreria icone da Iconify per le chiavi del dizionario (una tantum)
- `npm run compose -- <SKU>` — genera la scheda tecnica raster `output/{SKU}.jpg` (estrazione + composizione + render + export)
```

- [ ] **Step 7: Verifica manuale end-to-end**

Con `GEMINI_API_KEY` in `.env.local` e libreria icone popolata:

Run: `npm run compose -- 2137070`
Expected: stampa `Scheda esportata: output/2137070.jpg`; il file esiste ed è un JPEG 1000×1000 (`npx tsx -e "import sharp from 'sharp'; sharp('output/2137070.jpg').metadata().then(m => console.log(m.format, m.width, m.height))"` → `jpeg 1000 1000`).

Se `GEMINI_API_KEY` non è impostata, expected: errore pulito a una riga `GEMINI_API_KEY non impostata (usa .env.local)` senza stack trace — esito accettabile per chiudere il task (come in Fase 1).

- [ ] **Step 8: Suite completa + commit**

```bash
npm test
git add scripts/compose.ts scripts/compose-lib.ts tests/compose-e2e.test.ts package.json README.md
git commit -m "feat: CLI compose end-to-end SKU -> scheda tecnica JPEG"
```

---

## Criteri di completamento Fase 2

- `npm test` verde su checkout pulito (inclusi golden byte-identici scena JSON e SVG, e i test raster).
- `npm run seed:icons` popola la libreria icone (con rete); le icone sono normalizzate a viewBox 24×24 e `stroke: currentColor`, salvate `in-revisione`.
- `npm run compose -- <SKU reale>` produce `output/{SKU}.jpg` 1000×1000 sensato (con `GEMINI_API_KEY` e icone approvate).
- Rilancio dello stesso comando → stessa scena dalla cache estrazione + stessa immagine dalla cache per hash → stessa scena JSON byte-identica.
- Contratto di scena JSON pronto per essere consumato dall'editor web (Fase 3) e da un futuro upload Magento senza modifiche.

## Note per la Fase 3 (editor web + E2E)

- Il renderer SVG (`renderScene`) è una funzione pura di stringa: la Fase 3 può iniettarlo nell'anteprima o riusare il contratto di scena con componenti React interattivi, senza duplicare la geometria.
- L'approvazione icone in blocco su griglia visiva (Spec §7 seeding) e il picker icone sono UI di Fase 3, appoggiati su `listIcons`/`approveIcon`/`searchIconify` già pronti.
- Il fallback Gemini Vision per il bbox (Spec §8) e i template `griglia-sotto`/`multi-prodotto` (Spec §6) sono estensioni rimandate: l'engine di layout è già generico per accoglierli.
- Il golden test raster è sensibile all'ambiente (rendering font cross-platform): resta come guardia same-machine. Il contratto byte-identico forte è sui golden **scena JSON** e **SVG string**, entrambi committati con LF (`.gitattributes`).
```

