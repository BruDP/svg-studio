# SVG Studio — Fase 3a — Pipeline web read-only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare la catena della Fase 2 dentro il browser: l'operatrice apre l'app locale, cerca uno SKU, vede l'anteprima SVG della scheda proposta e la esporta in `output/{SKU}.jpg` — tutto via UI, senza editing (l'editing è la Fase 3b).

**Architecture:** UI Next.js 16 (App Router, React 19). Tutte le operazioni Node (feed, Gemini, DB, sharp, resvg) girano in **server actions** (`'use server'`). L'anteprima riusa il renderer canonico della Fase 2 (`renderScene`) **eseguito lato server** dentro l'action: l'action risolve il "render bundle" (icone approvate + foto data URI), chiama `renderScene` e restituisce al client la **stringa SVG già pronta**, che il client mostra così com'è. Così l'anteprima è **byte-identica** all'SVG che l'export rasterizza (stesso identico render server-side) e il client NON importa `theme`/`renderScene` — importante perché `theme.ts` (Fase 2) usa `node:path`/`process.cwd()` per `FONT_FILES` e non è client-safe. (Il rendering client-side per l'editing live sarà introdotto nella Fase 3b, che farà lo split necessario di `theme`.) Un flag d'ambiente (`SVG_STUDIO_FAKE`) inietta Gemini e download immagine finti per rendere l'E2E deterministico e offline.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Tailwind (già nello scaffold), Vitest (unit), **@playwright/test** (E2E, nuovo). Riusa tutta la Fase 1+2.

## Decisioni di scope della Fase 3a (prese dal planner)

- **Read-only**: nessuna mutazione della scena in questa fase (riordino/icone/drag/foto/template → Fase 3b). Qui si vede e si esporta ciò che il motore propone.
- **Anteprima = stringa SVG renderizzata dal server** (dall'action, con `renderScene`), mostrata dal client via `dangerouslySetInnerHTML`. NON si costruiscono componenti React SVG paralleli (duplicherebbero la geometria e rischierebbero preview≠export), e NON si esegue `renderScene` nel client in questa fase (evita di importare `theme`/`node:path` nel bundle browser). (Spec §4 "renderizzato come SVG": qui l'SVG è quello canonico del renderer.)
- **Server actions**, non route handlers: le operazioni sono mutazioni/derivazioni legate alla pagina. (Next 16, `'use server'`.)
- **E2E offline e deterministico** via `SVG_STUDIO_FAKE=1`: Gemini finto (estrazione canned) + download immagine finto (PNG di fixture), Product seedato nel DB dal global-setup di Playwright. Nessuna chiave API né rete nell'E2E.

## Global Constraints

- **Determinismo preservato end-to-end**: anteprima ed export derivano dallo **stesso** `renderScene` server-side sulla stessa scena e stesso render-bundle → stesso SVG. Nessuna logica di layout/stile nell'UI: viene tutta dai moduli Fase 2 (`theme`, `renderScene`, `composeColonnaSinistra`). L'export continua a passare da `exportScene` (resvg + font Poppins incorporati).
- **Confine server/client netto**: sharp, resvg, `@prisma/client`, `@google/genai`, `node:fs`, `renderScene`/`theme` (per via di `node:path` in `theme.ts`) girano SOLO in server actions / moduli server. I componenti client importano SOLO tipi (`ProposeResult`, `Scene`) e ricevono l'SVG come stringa già renderizzata. Nessun import di `renderScene`/`theme`/`sharp`/`resvg`/`prisma`/`fs` nei file `'use client'`.
- **Validare gli input delle server actions** (lo SKU, la scena): sono endpoint POST pubblici. Rifiutare input non validi con errore chiaro; validare la scena con `parseScene`.
- **Solo icone `approvata` in scheda**: il render-bundle risolve le icone via `getApprovedIcon` (mai `getIcon`). Un'icona non approvata → il renderer disegna il cerchio segnaposto.
- **Riuso Fase 1/2 immutato**: `refreshFeedIfStale`, `getProduct`, `searchProducts`, `extractProposal`, `loadDictionary`, `composeSceneForProduct` (da `scripts/compose-lib.ts`), `renderScene`, `exportScene`, `getApprovedIcon`, `readCachedImage`, `parseScene`, `theme`. Non modificare questi moduli; se un adattamento è indispensabile, fermarsi e segnalarlo.
- **Output**: `output/{SKU}.jpg` 1000×1000 (via `exportScene`, invariato). `output/` resta gitignored.
- **Next.js 16 ha breaking changes** rispetto ai modelli noti: PRIMA di scrivere codice App-Router/server-action, l'implementer legge la doc pertinente in `node_modules/next/dist/docs/01-app/` (in particolare `02-guides/server-actions.md`, `03-api-reference/01-directives/use-server.md`). Non indovinare le API.
- **Node 20+, npm.** Alias `@/* → src/*`. Commenti/UI in italiano. Commit in italiano, prefissi `feat:`/`test:`/`chore:`/`fix:`. `.gitattributes` forza LF (invariato).

## File Structure

```
src/
  app/
    layout.tsx              # Task 1 — shell (aggiorna metadata/lingua)
    page.tsx                # Task 1 — redirect/landing verso /studio
    globals.css             # invariato (Tailwind)
    studio/
      page.tsx              # Task 5 — pagina studio (server component che monta il client)
      StudioClient.tsx      # Task 5 — client: ricerca SKU, propone, mostra preview, esporta
    actions.ts              # Task 3 — server actions: proposeSceneAction, exportSceneAction ('use server')
  lib/
    render/
      bundle.ts             # Task 2 — resolveRenderBundle + renderSceneServer (server-only)
    ui/
      types.ts              # Task 3 — ProposeResult (DTO condiviso, NON 'use server')
      ScenePreview.tsx      # Task 4 — client component "muto": mostra la stringa SVG
      mime.ts               # Task 2 — extToMime(ext)
tests/
  render-bundle.test.ts     # Task 2
e2e/
  fixtures/
    prodotto-2137070.json   # Task 6 — ProductRecord seed (da fixture reale Fase 1)
    foto-test.png           # Task 6 — PNG sintetico per il download finto
    estrazione-2137070.json # Task 6 — RawExtraction canned per il Gemini finto
  global-setup.ts           # Task 6 — seed DB Product + attiva SVG_STUDIO_FAKE
  studio.spec.ts            # Task 6 — E2E SKU→preview→export
playwright.config.ts        # Task 6
src/lib/testing/fake.ts     # Task 3 — fakeGenerate + fakeDownload gated da SVG_STUDIO_FAKE
```

---

### Task 1: Shell dell'app e pulizia scaffold

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Delete: asset scaffold inutilizzati (`public/next.svg`, `public/vercel.svg` restano innocui — NON rimuovere `favicon.ico`)

**Interfaces:**
- Consumes: —
- Produces: pagina `/` che rimanda a `/studio`; layout con lingua `it` e titolo "SVG Studio".

- [ ] **Step 1: Aggiorna il layout**

`src/app/layout.tsx` — imposta lingua italiana e metadata (mantieni l'import dei font/globals già presente; NON rimuovere `import './globals.css'` se c'è). Sostituisci il contenuto con:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SVG Studio',
  description: 'Generatore di schede tecniche prodotto da feed Magento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Home → studio**

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/studio')
}
```

- [ ] **Step 3: Verifica build dell'app**

Run: `npx next build`
Expected: build completa senza errori (la pagina `/studio` non esiste ancora → verrà creata al Task 5; il redirect a una rotta assente NON rompe la build, ma se `next build` fallisse perché `/studio` non esiste, crea un placeholder minimale `src/app/studio/page.tsx` che esporta `export default function Studio(){ return <main>Studio</main> }` e nota che verrà sostituito al Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/studio/page.tsx 2>/dev/null
git commit -m "feat: shell app SVG Studio con redirect a /studio"
```

---

### Task 2: Render bundle (risoluzione icone + foto per l'anteprima)

**Files:**
- Create: `src/lib/render/bundle.ts`, `src/lib/ui/mime.ts`, `tests/render-bundle.test.ts`

**Interfaces:**
- Consumes: `Scene`/`SceneElement` da `@/lib/scene/types`; `getApprovedIcon` da `@/lib/icons/repository`; `readCachedImage` da `@/lib/images/cache`.
- Produces:
  - `extToMime(ext: string): string` in `mime.ts` (`'jpg'→'image/jpeg'`, `'png'→'image/png'`, `'webp'→'image/webp'`, default `'image/png'`).
  - `interface RenderBundle { iconMap: Record<string, string>; imageDataUri: string | null }`
  - `resolveRenderBundle(scene: Scene, deps?: { getIcon?: (k: string) => Promise<{ svg: string } | null>; readImage?: (hash: string) => { bytes: Buffer; ext: string } | null }): Promise<RenderBundle>` — per ogni `icona-label` risolve l'icona APPROVATA e ne estrae l'inner SVG (togliendo il wrapper `<svg>`); per l'elemento `foto` costruisce il data URI dai byte in cache. `deps` iniettabili per i test. Le icone non approvate/non trovate NON entrano nella mappa (il renderer disegnerà il segnaposto).
  - `renderSceneServer(scene: Scene, deps?: …stessi deps di resolveRenderBundle): Promise<string>` — risolve il bundle e chiama `renderScene` restituendo la stringa SVG. È il render canonico usato SIA dalla preview (via action) SIA dall'export, così sono identici. Vive lato server (importa `renderScene`→`theme`, non client-safe).

Questo modulo è server-only (importa `getApprovedIcon`→DB e `readCachedImage`→fs). Il ponte verso il client è la STRINGA SVG restituita da `renderSceneServer`, non il bundle grezzo.

- [ ] **Step 1: mime helper**

`src/lib/ui/mime.ts`:

```ts
export function extToMime(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}
```

- [ ] **Step 2: Scrivi il test (fallisce)**

`tests/render-bundle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveRenderBundle } from '@/lib/render/bundle'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

const scene: Scene = {
  version: SCENE_VERSION,
  sku: 'X1',
  templateId: 'colonna-sinistra',
  canvas: { width: 1000, height: 1000 },
  elements: [
    { type: 'icona-label', id: 'f0', chiave: 'k_ok', etichetta: 'A', x: 60, y: 160, verificata: true },
    { type: 'icona-label', id: 'f1', chiave: 'k_no', etichetta: 'B', x: 60, y: 256, verificata: false },
    { type: 'foto', id: 'ph', imageHash: 'abc', x: 480, y: 140, width: 400, height: 400 },
  ],
}

const deps = {
  getIcon: async (k: string) =>
    k === 'k_ok' ? { svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></svg>' } : null,
  readImage: (h: string) => (h === 'abc' ? { bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), ext: 'png' } : null),
}

describe('resolveRenderBundle', () => {
  it('mappa solo le icone approvate, estraendone l\'inner SVG', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(Object.keys(b.iconMap)).toEqual(['k_ok'])
    expect(b.iconMap.k_ok).toContain('M1 1')
    expect(b.iconMap.k_ok).not.toMatch(/<svg/i) // solo inner
  })

  it('costruisce il data URI della foto dai byte in cache', async () => {
    const b = await resolveRenderBundle(scene, deps)
    expect(b.imageDataUri).toMatch(/^data:image\/png;base64,/)
  })

  it('imageDataUri null se la foto non è in cache', async () => {
    const b = await resolveRenderBundle(scene, { ...deps, readImage: () => null })
    expect(b.imageDataUri).toBeNull()
  })

  it('renderSceneServer produce l\'SVG canonico usando il bundle', async () => {
    const { renderSceneServer } = await import('@/lib/render/bundle')
    const svg = await renderSceneServer(parseScene(scene), deps)
    expect(svg).toMatch(/^<svg /)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('M1 1') // icona approvata inserita
    expect(svg).toContain('data:image/png;base64,') // foto incorporata
  })
})
```

- [ ] **Step 3: Esegui il test (fallisce)**

Run: `npx vitest run tests/render-bundle.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 4: Implementa il bundle**

`src/lib/render/bundle.ts`:

```ts
import type { Scene } from '@/lib/scene/types'
import { getApprovedIcon } from '@/lib/icons/repository'
import { readCachedImage } from '@/lib/images/cache'
import { renderScene } from '@/lib/render/svg'
import { extToMime } from '@/lib/ui/mime'

export interface RenderBundle {
  iconMap: Record<string, string>
  imageDataUri: string | null
}

type BundleDeps = {
  getIcon?: (k: string) => Promise<{ svg: string } | null>
  readImage?: (hash: string) => { bytes: Buffer; ext: string } | null
}

/** Estrae il contenuto interno di un SVG normalizzato (rimuove il wrapper <svg>…</svg>). */
function innerSvg(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
}

export async function resolveRenderBundle(scene: Scene, deps: BundleDeps = {}): Promise<RenderBundle> {
  const getIcon = deps.getIcon ?? ((k: string) => getApprovedIcon(k))
  const readImage =
    deps.readImage ??
    ((hash: string) => {
      for (const ext of ['jpg', 'png', 'webp']) {
        try {
          return { bytes: readCachedImage(hash, ext), ext }
        } catch {
          // prova la prossima estensione
        }
      }
      return null
    })

  const iconMap: Record<string, string> = {}
  let imageDataUri: string | null = null

  for (const el of scene.elements) {
    if (el.type === 'icona-label' && !(el.chiave in iconMap)) {
      const rec = await getIcon(el.chiave)
      if (rec) iconMap[el.chiave] = innerSvg(rec.svg)
    }
    if (el.type === 'foto' && imageDataUri === null) {
      const img = readImage(el.imageHash)
      if (img) imageDataUri = `data:${extToMime(img.ext)};base64,${img.bytes.toString('base64')}`
    }
  }

  return { iconMap, imageDataUri }
}

/** Render canonico server-side: bundle + renderScene → stringa SVG. Usato da preview ed export. */
export async function renderSceneServer(scene: Scene, deps: BundleDeps = {}): Promise<string> {
  const bundle = await resolveRenderBundle(scene, deps)
  return renderScene(scene, {
    icon: (k) => bundle.iconMap[k] ?? null,
    image: () => bundle.imageDataUri,
  })
}
```

- [ ] **Step 5: Esegui il test (passa)**

Run: `npx vitest run tests/render-bundle.test.ts`
Expected: PASS (4 test).

- [ ] **Step 6: Suite completa + commit**

```bash
npm test
git add src/lib/render/bundle.ts src/lib/ui/mime.ts tests/render-bundle.test.ts
git commit -m "feat: render bundle (icone approvate + foto data URI) per l'anteprima client"
```

---

### Task 3: Server actions (propose, export, search)

**Files:**
- Create: `src/app/actions.ts`, `src/lib/testing/fake.ts`, `src/lib/ui/types.ts`

**Interfaces:**
- Consumes: `refreshFeedIfStale`, `getProduct`, `searchProducts` (feed), `extractProposal`+`loadDictionary` (Fase 1), `composeSceneForProduct` (`scripts/compose-lib`), `resolveRenderBundle` (Task 2), `renderScene`, `exportScene`, `readCachedImage`, `parseScene`, tipi `Scene`/`ProductRecord`/`SchedaProposal`.
- Produces:
  - In `src/lib/ui/types.ts` (modulo NON `'use server'`, perché un file `'use server'` può esportare SOLO funzioni async — un `export interface` lì è un errore di Next 16): `export interface ProposeResult { scene: Scene; svg: string; prodotto: { sku: string; descrizioneBreve: string } }`
  - Server actions in `src/app/actions.ts`:
  - `proposeSceneAction(sku: string): Promise<ProposeResult>` — refresh feed → getProduct → extractProposal → composeSceneForProduct → `renderSceneServer` (restituisce la scena + l'SVG già renderizzato). Lancia errore chiaro se SKU vuoto/non trovato.
  - `exportSceneAction(sceneJson: string): Promise<{ path: string; thumbDataUri: string }>` — valida con `parseScene`, `renderSceneServer`, `exportScene`, e produce una miniatura (JPEG ridimensionato) come data URI di conferma.

  (La ricerca-per-nome — Spec §8, fallback SKU assente — è rimandata alla 3b, dove verrà anche cablata nell'UI; non introdurre `searchSkuAction` qui: sarebbe codice non usato.)

- [ ] **Step 1: Modo finto per test/E2E (Gemini + download)**

`src/lib/testing/fake.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Dictionary } from '@/lib/dictionary/types'

/** Attivo quando SVG_STUDIO_FAKE=1: rende la pipeline deterministica e offline (E2E). */
export function isFake(): boolean {
  return process.env.SVG_STUDIO_FAKE === '1'
}

/** Generatore Gemini finto: restituisce l'estrazione canned di fixture (ignora il prompt). */
export function fakeGenerate(): (prompt: string, dict: Dictionary) => Promise<string> {
  return async () => readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/estrazione-2137070.json'), 'utf8')
}

/** Download immagine finto: restituisce il PNG di fixture per qualunque URL. */
export function fakeDownload(): (url: string) => Promise<Buffer> {
  return async () => readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/foto-test.png'))
}
```

- [ ] **Step 2: Tipo DTO condiviso**

`src/lib/ui/types.ts` (modulo semplice, importabile sia dalle server actions sia dai client component — NON deve avere `'use server'`):

```ts
import type { Scene } from '@/lib/scene/types'

export interface ProposeResult {
  scene: Scene
  svg: string
  prodotto: { sku: string; descrizioneBreve: string }
}
```

- [ ] **Step 3: Le server actions**

`src/app/actions.ts`:

```ts
'use server'

import sharp from 'sharp'
import { refreshFeedIfStale } from '@/lib/feed/fetcher'
import { getProduct } from '@/lib/feed/repository'
import { loadDictionary } from '@/lib/dictionary/loader'
import { extractProposal } from '@/lib/extraction/engine'
import { composeSceneForProduct } from '../../scripts/compose-lib'
import { renderSceneServer } from '@/lib/render/bundle'
import { exportScene } from '@/lib/export/raster'
import { parseScene } from '@/lib/scene/schema'
import type { Scene } from '@/lib/scene/types'
import type { ProposeResult } from '@/lib/ui/types'
import { isFake, fakeGenerate, fakeDownload } from '@/lib/testing/fake'

export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(s)
  if (!product) throw new Error(`SKU ${s} non trovato nel feed`)

  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, loadDictionary(), generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

  const svg = await renderSceneServer(scene)
  return {
    scene,
    svg,
    prodotto: { sku: product.sku, descrizioneBreve: product.descrizioneBreve },
  }
}

export async function exportSceneAction(sceneJson: string): Promise<{ path: string; thumbDataUri: string }> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  const svg = await renderSceneServer(scene)
  const path = await exportScene({ svg, sku: scene.sku })
  const thumb = await sharp(path).resize(240, 240).jpeg({ quality: 80 }).toBuffer()
  return { path, thumbDataUri: `data:image/jpeg;base64,${thumb.toString('base64')}` }
}
```

Nota: `refreshFeedIfStale` in modo finto riceve un `download` che ritorna stringa vuota — così se il feed è già seedato nel DB (dal global-setup E2E) e recente, non scarica; se non lo fosse, `parseFeed('')` darebbe zero prodotti e `getProduct` fallirebbe con errore chiaro. Il global-setup dell'E2E (Task 6) garantisce il Product seedato e un `FeedMeta` recente perché `refreshFeedIfStale` salti il download.

- [ ] **Step 4: Verifica typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore di tipo (le action compilano; `import` di `../../scripts/compose-lib` risolve — se `tsc` si lamentasse del path relativo fuori da `src`, usa `@/`-alias solo se `scripts` è mappato; altrimenti mantieni il relativo, che `next build` risolve. Se emergono errori, segnalali). Verifica anche che `actions.ts` NON esporti nulla che non sia una funzione async (regola `'use server'`): il tipo `ProposeResult` è importato, non ri-esportato.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts src/lib/testing/fake.ts src/lib/ui/types.ts
git commit -m "feat: server actions propose/export/search per lo studio web"
```

---

### Task 4: Componente anteprima SVG

**Files:**
- Create: `src/lib/ui/ScenePreview.tsx`

**Interfaces:**
- Consumes: — (nessun modulo Node/server; riceve l'SVG già pronto come prop).
- Produces: `<ScenePreview svg={string} />` — client component "muto" che mostra la stringa SVG (renderizzata dal server) responsiva (max 1000×1000, scala a contenitore).

- [ ] **Step 1: Implementa il componente**

`src/lib/ui/ScenePreview.tsx`:

```tsx
'use client'

export function ScenePreview({ svg }: { svg: string }) {
  return (
    <div
      className="w-full max-w-[1000px] aspect-square border border-zinc-200 bg-white"
      // l'SVG è generato SERVER-SIDE dal renderer canonico (stesso output dell'export) —
      // non è input utente arbitrario: il testo è già XML-escapato e le icone sono sanitizzate/approvate
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
```

Nota sicurezza: l'SVG proviene dal nostro `renderScene` (server), che XML-escapa il testo utente (Task 11 Fase 2) e usa solo icone già sanitizzate/approvate. Non si inietta markup arbitrario dell'utente. Il componente NON importa `renderScene`/`theme` (che non sono client-safe).

- [ ] **Step 2: Verifica typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/ScenePreview.tsx
git commit -m "feat: componente anteprima SVG (renderScene puro nel client)"
```

---

### Task 5: Pagina studio (ricerca SKU → anteprima → export)

**Files:**
- Create/replace: `src/app/studio/page.tsx`, `src/app/studio/StudioClient.tsx`

**Interfaces:**
- Consumes: `proposeSceneAction`, `exportSceneAction` (Task 3); `ScenePreview` (Task 4); tipo `ProposeResult`.
- Produces: la UI operativa read-only.

- [ ] **Step 1: Pagina server che monta il client**

`src/app/studio/page.tsx`:

```tsx
import { StudioClient } from './StudioClient'

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-800">SVG Studio</h1>
      <StudioClient />
    </main>
  )
}
```

- [ ] **Step 2: Client dello studio**

`src/app/studio/StudioClient.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { proposeSceneAction, exportSceneAction } from '../actions'
import type { ProposeResult } from '@/lib/ui/types'
import { ScenePreview } from '@/lib/ui/ScenePreview'

export function StudioClient() {
  const [sku, setSku] = useState('')
  const [data, setData] = useState<ProposeResult | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, startTransition] = useTransition()

  function proponi() {
    setErrore(null)
    setThumb(null)
    startTransition(async () => {
      try {
        setData(await proposeSceneAction(sku))
      } catch (e) {
        setData(null)
        setErrore(e instanceof Error ? e.message : 'Errore sconosciuto')
      }
    })
  }

  function esporta() {
    if (!data) return
    setErrore(null)
    startTransition(async () => {
      try {
        const res = await exportSceneAction(JSON.stringify(data.scene))
        setThumb(res.thumbDataUri)
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore export')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          aria-label="SKU"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Inserisci SKU (es. 2137070)"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && proponi()}
        />
        <button
          className="rounded bg-zinc-800 px-4 py-2 text-white disabled:opacity-50"
          onClick={proponi}
          disabled={inCorso || sku.trim() === ''}
        >
          {inCorso ? 'Elaboro…' : 'Proponi'}
        </button>
      </div>

      {errore && <p role="alert" className="text-red-600">{errore}</p>}

      {data && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <ScenePreview svg={data.svg} />
          </div>
          <aside className="w-full md:w-72">
            <h2 className="font-medium text-zinc-700">{data.prodotto.descrizioneBreve}</h2>
            <p className="mb-2 text-sm text-zinc-500">SKU {data.prodotto.sku}</p>
            <ul className="mb-4 space-y-1 text-sm">
              {data.scene.elements
                .filter((el) => el.type === 'icona-label')
                .map((el) => (
                  <li key={el.id} className={'verificata' in el && !el.verificata ? 'text-amber-600' : 'text-zinc-700'}>
                    {'etichetta' in el ? el.etichetta : ''}
                    {'verificata' in el && !el.verificata ? ' ⚠︎' : ''}
                  </li>
                ))}
            </ul>
            <button
              className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              onClick={esporta}
              disabled={inCorso}
            >
              Esporta JPEG
            </button>
            {thumb && (
              <div className="mt-3">
                <p className="text-sm text-zinc-500">Esportata:</p>
                {/* miniatura di conferma; è un data URI generato da noi */}
                <img alt="Anteprima esportata" src={thumb} className="mt-1 border border-zinc-200" width={240} height={240} />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verifica build**

Run: `npx next build`
Expected: build completa senza errori; la rotta `/studio` compilata.

- [ ] **Step 4: Verifica manuale rapida (con feed reale e chiave, se disponibile)**

Se `GEMINI_API_KEY` è in `.env.local`: `npm run dev`, apri `http://localhost:3000/studio`, cerca `2137070`, verifica che appaia l'anteprima e che "Esporta JPEG" produca `output/2137070.jpg` + miniatura. Se la chiave non c'è, questo passo si salta (l'E2E del Task 6 copre il flusso in modo finto/offline). NON bloccare il task sull'assenza della chiave.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/
git commit -m "feat: pagina studio read-only (SKU -> anteprima -> export)"
```

---

### Task 6: E2E Playwright (SKU → anteprima → export) offline

**Files:**
- Create: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/studio.spec.ts`, `e2e/fixtures/prodotto-2137070.json`, `e2e/fixtures/foto-test.png`, `e2e/fixtures/estrazione-2137070.json`
- Modify: `package.json` (script `e2e`), `.gitignore` (ignora `playwright-report/`, `test-results/`), `vitest.config.ts` (escludi `e2e/**` da Vitest)

**Interfaces:**
- Consumes: l'app (server actions + pagina studio) in modo `SVG_STUDIO_FAKE=1`.
- Produces: `npm run e2e` che avvia il dev server, semina il DB, e verifica il flusso completo offline.

- [ ] **Step 1: Installa Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

Verifica: `npx playwright --version` stampa una versione. (Se `playwright install` non può scaricare il browser in questo ambiente, segnala BLOCKED — l'E2E richiede il browser.)

- [ ] **Step 2: Escludi e2e da Vitest**

In `vitest.config.ts`, aggiungi `exclude` per non far raccogliere gli spec Playwright a Vitest. Nella sezione `test`, aggiungi:

```ts
      exclude: ['e2e/**', 'node_modules/**'],
```

(mantieni `include: ['tests/**/*.test.ts']` già presente; l'exclude è una rete di sicurezza.)

- [ ] **Step 3: Fixture — ProductRecord, PNG, estrazione canned**

`e2e/fixtures/prodotto-2137070.json` — un `ProductRecord` valido (adatta i campi al tipo reale di `@/lib/feed/types`; almeno `sku`, `images` con un URL fittizio, `descrizioneBreve`, `descrizioneEstesa`, `notaTecnica` con una riga dimensioni tipo `"l. 51 x p. 63 x h. 84,5 cm"`, e gli altri campi stringa vuoti / `imballo` con null):

```json
{
  "sku": "2137070",
  "images": ["https://esempio.local/foto.png"],
  "descrizioneBreve": "Barbecue a carbone",
  "descrizioneEstesa": "Barbecue in acciaio con montaggio facile.",
  "notaTecnica": ["Materiale: acciaio", "Dimensioni: l. 51 x p. 63 x h. 84,5 cm"],
  "notaEmozionale": "",
  "prezzo": "",
  "marchio": "",
  "urlSlug": "",
  "colore": "",
  "materiale": "acciaio",
  "imballo": { "lunghezza": null, "larghezza": null, "altezza": null }
}
```

`e2e/fixtures/estrazione-2137070.json` — una `RawExtraction` canned coerente col dizionario reale (categoria valida + 1-2 feature con `chiave` esistente nel dizionario, `valore` e `testoSorgente` tracciabili nel testo del prodotto sopra, così il validatore le marca `verificata: true`). ESEMPIO da adattare alle chiavi reali di `dictionary/features.yaml`:

```json
{
  "categoria": "barbecue",
  "features": [
    { "chiave": "materiale_acciaio", "valore": null, "testoSorgente": "Barbecue in acciaio" }
  ]
}
```

L'implementer DEVE aprire `dictionary/features.yaml` e `dictionary/categories.yaml` e scegliere una `categoria` e almeno una `chiave` realmente esistenti e applicabili, altrimenti il ranking scarta tutto. Documenta nel report quali chiavi ha usato.

`e2e/fixtures/foto-test.png` — genera un PNG 400×400 con un rettangolo scuro su sfondo bianco (così `detectBBox` trova un box), via uno script una-tantum:

```bash
npx tsx -e "import sharp from 'sharp'; const w=400,h=400,px=Buffer.alloc(w*h*3,255); for(let y=80;y<320;y++)for(let x=80;x<320;x++){const i=(y*w+x)*3;px[i]=px[i+1]=px[i+2]=40;} sharp(px,{raw:{width:w,height:h,channels:3}}).png().toFile('e2e/fixtures/foto-test.png').then(()=>console.log('png ok'))"
```

Verifica: `e2e/fixtures/foto-test.png` esiste ed è > 0 byte.

- [ ] **Step 4: Global setup — semina DB e attiva il modo finto**

`e2e/global-setup.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export default async function globalSetup() {
  process.env.SVG_STUDIO_FAKE = '1'
  const { db } = await import('@/lib/db')
  const record = JSON.parse(readFileSync(path.resolve('e2e/fixtures/prodotto-2137070.json'), 'utf8'))
  const payload = JSON.stringify(record)
  const rowHash = createHash('sha256').update(payload).digest('hex')
  const searchText = `${record.sku} ${record.descrizioneBreve}`.toLowerCase()
  await db.product.upsert({
    where: { sku: record.sku },
    create: { sku: record.sku, payload, rowHash, searchText },
    update: { payload, rowHash, searchText },
  })
  // FeedMeta recente → refreshFeedIfStale salta il download nel modo finto
  await db.feedMeta.create({ data: { sourceHash: 'e2e' } })
  await db.$disconnect()
}
```

- [ ] **Step 5: playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/studio',
    reuseExistingServer: false,
    env: { SVG_STUDIO_FAKE: '1' },
    timeout: 120_000,
  },
})
```

- [ ] **Step 6: Lo spec E2E**

`e2e/studio.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('SKU → anteprima → export', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('2137070')
  await page.getByRole('button', { name: 'Proponi' }).click()

  // l'anteprima SVG appare
  await expect(page.locator('svg')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('SKU 2137070')).toBeVisible()

  // export → miniatura di conferma
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('SKU inesistente → errore chiaro', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('SKU-CHE-NON-ESISTE')
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(page.getByRole('alert')).toContainText('non trovato')
})
```

- [ ] **Step 7: Script e gitignore**

In `package.json` scripts, aggiungi dopo `compose`:

```json
"e2e": "playwright test"
```

In `.gitignore`, aggiungi:

```
playwright-report/
test-results/
/e2e/.cache/
```

(NON ignorare `e2e/fixtures/` — le fixture vanno committate. La `foto-test.png` è binaria: assicurati che `.gitattributes` la tratti come binario — aggiungi `*.png binary` se non già coperto, per evitare corruzione da autocrlf.)

- [ ] **Step 8: Esegui l'E2E**

```bash
npm run e2e
```

Expected: entrambi i test verdi. Il primo prova il flusso completo offline (feed seedato, Gemini finto, download foto finto, compose, render, export → miniatura). Se il browser non è installabile nell'ambiente, segnala BLOCKED con l'errore; l'E2E è il criterio di accettazione di questa fase.

- [ ] **Step 9: Suite unit + commit**

```bash
npm test
git add playwright.config.ts e2e/ package.json package-lock.json .gitignore .gitattributes vitest.config.ts
git commit -m "test: E2E Playwright del flusso studio read-only (offline, Gemini finto)"
```

---

## Criteri di completamento Fase 3a

- `npm run dev` → `/studio`: cercare uno SKU reale (con `GEMINI_API_KEY`) mostra l'anteprima della scheda e l'export produce `output/{SKU}.jpg` + miniatura.
- **Anteprima == export**: l'SVG mostrato nel browser è quello prodotto da `renderScene`, lo stesso che `exportScene` rasterizza (nessuna divergenza).
- `npm run e2e` verde offline (`SVG_STUDIO_FAKE=1`): SKU→proposta→anteprima→export, più lo scenario SKU inesistente.
- `npm test` verde (unit invariati + `render-bundle`).
- Confine server/client rispettato: nessun import di sharp/resvg/prisma/genai/fs in componenti client.

## Note per la Fase 3b (editing interattivo — piano successivo)

- Stato scena editabile con `useReducer` + mutazioni tipizzate (Spec §6): riordina/rimuovi/aggiungi feature, modifica etichetta, sostituisci icona (picker su `searchIconify`+`listIcons`), trascina frecce quota (overlay con mapping coord schermo→viewBox 0..1000), cambia foto (tra `product.images`), cambia template (oggi solo `colonna-sinistra`).
- Griglia di approvazione icone (`/icone`): `listIcons`/`approveIcon`/`searchIconify` — la sessione di seeding di massa della Spec §7.
- Persistenza scene editate in `db.scene` (upsert per sku) e riapertura.
- Per l'editing live, la 3b sposterà il rendering nel client: `proposeSceneAction` restituirà ANCHE il render-bundle (`iconMap`+`imageDataUri`, già disponibile server-side via `resolveRenderBundle`), e il client eseguirà `renderScene` a ogni mutazione. Questo richiede rendere `theme` client-safe: **split di `theme.ts`** — separare `FONT_FILES` (che usa `node:path`/`process.cwd()`, server-only) dai token di stile puri (client-safe). È l'unica modifica prevista ai moduli Fase 2, da fare all'inizio della 3b. Nuove icone scelte nel picker richiedono un round-trip per aggiungerle a `iconMap`.
- Ricerca-per-nome (Spec §8, fallback SKU assente): `searchSkuAction` che wrappa `searchProducts`, cablata nell'UI come dropdown/autocomplete.
- E2E editing: SKU→proposta→riordino/modifica→export, verificando che l'export rifletta le modifiche.
