# SVG Studio — Fase 3b — Editor strutturale della scena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere la scheda modificabile nel browser: l'operatrice, dopo la proposta (Fase 3a), può riordinare/rimuovere/aggiungere le feature e correggere le etichette, vedere l'anteprima aggiornarsi in tempo reale, salvare la scena e riaprirla, e infine esportare la versione modificata.

**Architecture:** L'anteprima passa dal rendering server-side (3a) al **rendering client-side live**: dopo lo split di `theme.ts` (rimozione della dipendenza `node:path`), la funzione pura `renderScene` (Fase 2) diventa eseguibile nel browser. La scena è il **documento editabile** gestito con `useReducer` + mutazioni tipizzate pure (`applyMutation`), che riflowano la colonna icone tramite `colonnaPositions`. Le server action risolvono una volta il "render bundle" (icone approvate per tutte le feature applicabili alla categoria + foto data URI) e lo passano al client, che poi rende molte volte in locale a ogni modifica — l'export continua a passare da `exportSceneAction` (stesso `renderScene` server-side → parità). Persistenza scene in `db.scene`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, @playwright/test. Riusa Fase 1/2/3a.

## Decisioni di scope della Fase 3b (prese dal planner)

- **Editing strutturale + etichette** (Spec §6): riordina / rimuovi / aggiungi feature, modifica etichetta. Tutte mutazioni che riflowano deterministicamente la colonna via `colonnaPositions`.
- **Rimandato a Fase 3c** (interazioni fini + libreria icone): drag delle frecce quota, cambio foto, icon picker (sostituzione icona via Iconify), griglia di approvazione icone (§7). Raggruppate perché condividono complessità distinte (mapping coordinate schermo→viewBox, round-trip immagini, regola icone-marcate/approvate).
- **Un solo template** (`colonna-sinistra`): il selettore template resta fuori scope finché non esiste un secondo template.
- **Rendering client-side**: reso possibile dallo split di `theme.ts` (prerequisito, Task 1). È l'unica modifica prevista a un modulo Fase 2, già annunciata nelle note di chiusura 3a.

## Global Constraints

- **Determinismo & parità anteprima/export**: l'anteprima client e l'export server devono produrre lo **stesso** SVG per la **stessa scena**. Entrambi usano lo stesso `renderScene` (Fase 2, invariato) e lo stesso render-bundle (icone approvate risolte allo stesso modo). Nessuna logica di layout/stile duplicata nell'UI: le posizioni vengono da `colonnaPositions` (layout engine Fase 2), i colori/font da `theme`.
- **Split `theme.ts` a output invariato**: dopo lo split, `renderScene` deve produrre output **byte-identico** a prima (i golden `render-2137070.svg` e `scene-2137070.json` NON cambiano) — si sposta solo `FONT_FILES`, i token `theme` restano identici. I golden test devono restare verdi senza rigenerazione.
- **Confine server/client**: `sharp`, `resvg`, `@prisma/client`, `@google/genai`, `node:fs`, `node:path`, `FONT_FILES` girano SOLO server-side. Post-split, `theme`, `renderScene`, `layout/engine`, `scene/mutations` sono client-safe (solo TS puro + `theme`). Nessun import Node in file `'use client'`.
- **Solo icone `approvata` in scheda**: il render-bundle risolve via `getApprovedIcon`. Le feature aggiunte la cui icona non è approvata renderizzano il cerchio segnaposto (la gestione "icona marcata/da approvare" è Fase 3c).
- **Mutazioni entro i binari del template** (Spec §6): le mutazioni strutturali riflowano la colonna icone deterministicamente (stesso `colonnaGap`/`colonnaX` del template); `modifica-etichetta` cambia solo il testo. Le mutazioni sono **funzioni pure** `Scene → Scene`, unit-testabili, senza `Date`/`random`.
- **Validazione input server action**: `sku` (già guardato in 3a), scene via `parseScene`; `saveSceneAction` valida la scena prima di persistere. Guard su `sku` (`^[A-Za-z0-9._-]+$`) mantenuto per i path.
- **Riuso Fase 1/2/3a immutato** salvo lo split di `theme.ts` (Task 1). Non modificare `renderScene`, `composeColonnaSinistra`, `scene/schema`, `scene/types`, il motore di estrazione. Se un adattamento sembra indispensabile, fermarsi e segnalarlo.
- **Next.js 16**: prima di toccare App-Router/server-action/client-component, consultare `node_modules/next/dist/docs/01-app/`. Un modulo `'use server'` esporta solo funzioni async (i tipi stanno in `ui/types.ts`).
- **Node 20+, npm.** Alias `@/* → src/*`. UI/commenti in italiano. Commit italiani `feat:`/`test:`/`chore:`/`fix:`. `.gitattributes` LF (invariato). E2E offline via `SVG_STUDIO_FAKE=1`.

## File Structure

```
src/
  lib/
    theme.ts               # Task 1 — SOLO token puri (rimosso node:path/FONT_FILES) → client-safe
    fonts.ts               # Task 1 — NUOVO, server-only: FONT_FILES (node:path)
    scene/
      mutations.ts         # Task 2 — SceneAction + applyMutation (pura, reflow colonna)
    render/
      bundle.ts            # Task 3 — aggiunge resolveIconsForKeys(keys, deps?)
    ui/
      ScenePreview.tsx     # Task 4 — ora rende renderScene client-side da {scene,iconMap,imageDataUri}
      types.ts             # Task 3 — ProposeResult aggiornato (+iconMap,imageDataUri,categoriaFeatures; -svg)
  app/
    actions.ts             # Task 3 — proposeSceneAction aggiornata + saveSceneAction + loadSceneAction
    studio/
      StudioClient.tsx     # Task 5 — editor: useReducer scena, pannello feature, salva/esporta
      FeaturePanel.tsx     # Task 5 — pannello editing feature (riordina/rimuovi/aggiungi/etichetta)
tests/
  scene-mutations.test.ts  # Task 2
  render-bundle.test.ts    # Task 3 — aggiunge test per resolveIconsForKeys
e2e/
  studio.spec.ts           # Task 6 — estende con edit→export + save→reload
  seed.ts                  # Task 6 — eventuale seed di una scena salvata (se serve al test reload)
```

Nota: `src/lib/export/raster.ts` (Fase 2) va aggiornato SOLO nell'import di `FONT_FILES` (Task 1); il resto invariato.

---

### Task 1: Split di `theme.ts` (client-safe) + modulo `fonts.ts`

**Files:**
- Modify: `src/lib/theme.ts` (rimuove `import 'node:path'` e `FONT_FILES`), `src/lib/export/raster.ts` (import di `FONT_FILES` dal nuovo modulo)
- Create: `src/lib/fonts.ts`
- Test: nessun nuovo test — la garanzia è che i test esistenti (golden render/scene, export) restino verdi e che `renderScene` sia ora client-importabile.

**Interfaces:**
- Produces: `theme` invariato in `theme.ts` (senza `FONT_FILES`, senza `node:path`); `FONT_FILES: string[]` in `fonts.ts` (server-only).

- [ ] **Step 1: Crea il modulo font server-only**

`src/lib/fonts.ts`:

```ts
import path from 'node:path'

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')

/** Percorsi dei file font per resvg-js (embedding nel raster). Server-only (usa node:path). */
export const FONT_FILES: string[] = [
  path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
]
```

- [ ] **Step 2: Rendi `theme.ts` client-safe**

In `src/lib/theme.ts`, RIMUOVI la riga `import path from 'node:path'` (riga 1), e RIMUOVI il blocco finale `const FONT_DIR = ...` e `export const FONT_FILES = [...]` (righe ~37-43). Lascia SOLO l'oggetto `theme` (`export const theme = {...} as const`), invariato token per token. Il file non deve più importare nulla da `node:*`.

- [ ] **Step 3: Aggiorna l'import in raster.ts**

In `src/lib/export/raster.ts`, cambia la riga 5 da:

```ts
import { FONT_FILES, theme } from '@/lib/theme'
```

a:

```ts
import { theme } from '@/lib/theme'
import { FONT_FILES } from '@/lib/fonts'
```

Nessun'altra modifica a raster.ts.

- [ ] **Step 4: Verifica che nulla sia cambiato nell'output**

Run: `npm test`
Expected: TUTTI i test verdi, in particolare i golden `tests/render-svg.test.ts` e `tests/layout-colonna-sinistra.test.ts` (l'output di `renderScene` è byte-identico: `theme` è invariato, è cambiato solo dove vive `FONT_FILES`) e `tests/export-raster.test.ts` (usa `FONT_FILES` dal nuovo modulo). Conteggio invariato (89).

Run: `npx tsc --noEmit`
Expected: nessun errore (raster.ts trova `FONT_FILES` in `@/lib/fonts`).

Run: `grep -rn "FONT_FILES" src/` e verifica che l'unico importatore sia `raster.ts` (da `@/lib/fonts`) e la definizione sia in `fonts.ts`. Verifica che `theme.ts` non contenga più `node:path`/`process.cwd`.

- [ ] **Step 5: Verifica client-safety (build)**

Run: `npx next build`
Expected: build pulita. (La client-safety di `theme` sarà esercitata davvero al Task 4 quando un client component importa `renderScene`; qui basta che la build resti verde.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/fonts.ts src/lib/export/raster.ts
git commit -m "refactor: split theme.ts, FONT_FILES in modulo fonts server-only (theme client-safe)"
```

---

### Task 2: Mutazioni della scena (reducer puro)

**Files:**
- Create: `src/lib/scene/mutations.ts`, `tests/scene-mutations.test.ts`

**Interfaces:**
- Consumes: tipi da `@/lib/scene/types`; `colonnaPositions` da `@/lib/layout/engine` (client-safe post-Task-1).
- Produces:
  - `type SceneAction = { type: 'sposta-feature'; id: string; direzione: 'su' | 'giu' } | { type: 'rimuovi'; id: string } | { type: 'aggiungi-feature'; chiave: string; etichetta: string } | { type: 'modifica-etichetta'; id: string; etichetta: string }`
  - `applyMutation(scene: Scene, action: SceneAction): Scene` — pura, restituisce una nuova scena. Le mutazioni strutturali (sposta/rimuovi/aggiungi) riflowano le posizioni di TUTTE le icone-label via `colonnaPositions` (mantenendo lo startY corrente = y della prima icona-label esistente, fallback 160). `modifica-etichetta` cambia solo il testo. `aggiungi-feature` aggiunge in fondo con id univoco (`f-<n>` non collidente), `verificata: false`.

- [ ] **Step 1: Scrivi il test (fallisce)**

`tests/scene-mutations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyMutation } from '@/lib/scene/mutations'
import type { Scene, IconLabelElement } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

function scenaBase(): Scene {
  return {
    version: SCENE_VERSION,
    sku: 'X1',
    templateId: 'colonna-sinistra',
    canvas: { width: 1000, height: 1000 },
    elements: [
      { type: 'testo', id: 'titolo', testo: 'barbecue', x: 60, y: 60, ruolo: 'titolo' },
      { type: 'icona-label', id: 'f0', chiave: 'a', etichetta: 'A', x: 60, y: 160, verificata: true },
      { type: 'icona-label', id: 'f1', chiave: 'b', etichetta: 'B', x: 60, y: 256, verificata: true },
      { type: 'foto', id: 'ph', imageHash: 'h', x: 480, y: 140, width: 400, height: 400 },
    ],
  }
}
const icone = (s: Scene) => s.elements.filter((e): e is IconLabelElement => e.type === 'icona-label')

describe('applyMutation', () => {
  it('sposta-feature giù inverte l\'ordine delle icone e riflowa le y', () => {
    const s = applyMutation(scenaBase(), { type: 'sposta-feature', id: 'f0', direzione: 'giu' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['b', 'a'])
    // le posizioni y restano quelle della colonna (riflow), non seguono l'elemento
    expect(ic[0].y).toBe(160)
    expect(ic[1].y).toBe(256)
  })

  it('sposta-feature su in cima è no-op sull\'ordine', () => {
    const s = applyMutation(scenaBase(), { type: 'sposta-feature', id: 'f0', direzione: 'su' })
    expect(icone(s).map((e) => e.chiave)).toEqual(['a', 'b'])
  })

  it('rimuovi elimina l\'icona e riflowa le rimanenti', () => {
    const s = applyMutation(scenaBase(), { type: 'rimuovi', id: 'f0' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['b'])
    expect(ic[0].y).toBe(160) // riflow dall'inizio colonna
  })

  it('aggiungi-feature appende con id univoco, verificata false, e riflow', () => {
    const s = applyMutation(scenaBase(), { type: 'aggiungi-feature', chiave: 'c', etichetta: 'C' })
    const ic = icone(s)
    expect(ic.map((e) => e.chiave)).toEqual(['a', 'b', 'c'])
    const nuova = ic[2]
    expect(nuova.verificata).toBe(false)
    expect(nuova.y).toBe(352) // 160 + 2*96
    expect(ic.map((e) => e.id).length).toBe(new Set(ic.map((e) => e.id)).size) // id univoci
  })

  it('modifica-etichetta cambia solo il testo, non la posizione', () => {
    const s = applyMutation(scenaBase(), { type: 'modifica-etichetta', id: 'f1', etichetta: 'Nuova' })
    const f1 = icone(s).find((e) => e.id === 'f1')!
    expect(f1.etichetta).toBe('Nuova')
    expect(f1.y).toBe(256)
  })

  it('è pura: non muta la scena in ingresso', () => {
    const orig = scenaBase()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, { type: 'rimuovi', id: 'f0' })
    expect(orig).toEqual(copia)
  })

  it('preserva gli elementi non-icona (titolo, foto)', () => {
    const s = applyMutation(scenaBase(), { type: 'rimuovi', id: 'f0' })
    expect(s.elements.some((e) => e.id === 'titolo')).toBe(true)
    expect(s.elements.some((e) => e.id === 'ph')).toBe(true)
  })
})
```

- [ ] **Step 2: Esegui il test (fallisce)**

Run: `npx vitest run tests/scene-mutations.test.ts`
Expected: FAIL — modulo non trovato.

- [ ] **Step 3: Implementa le mutazioni**

`src/lib/scene/mutations.ts`:

```ts
import type { Scene, SceneElement, IconLabelElement } from '@/lib/scene/types'
import { colonnaPositions } from '@/lib/layout/engine'

export type SceneAction =
  | { type: 'sposta-feature'; id: string; direzione: 'su' | 'giu' }
  | { type: 'rimuovi'; id: string }
  | { type: 'aggiungi-feature'; chiave: string; etichetta: string }
  | { type: 'modifica-etichetta'; id: string; etichetta: string }

function isIcona(el: SceneElement): el is IconLabelElement {
  return el.type === 'icona-label'
}

/** Ricostruisce le posizioni della colonna icone nell'ordine dato, preservando lo startY corrente. */
function riflow(icone: IconLabelElement[], startY: number): IconLabelElement[] {
  const pos = colonnaPositions(icone.length, startY)
  return icone.map((el, i) => ({ ...el, x: pos[i].x, y: pos[i].y }))
}

/** Ricompone gli elementi sostituendo le icone-label (in ordine) e tenendo gli altri al loro posto. */
function conIcone(scene: Scene, nuoveIcone: IconLabelElement[]): Scene {
  let k = 0
  const elements = scene.elements.map((el) => (isIcona(el) ? nuoveIcone[k++] : el))
  // se sono state aggiunte icone oltre a quelle esistenti, appendile in coda
  while (k < nuoveIcone.length) {
    elements.push(nuoveIcone[k++])
  }
  return { ...scene, elements }
}

function startYCorrente(scene: Scene): number {
  const prima = scene.elements.find(isIcona)
  return prima ? prima.y : 160
}

function nuovoId(scene: Scene): string {
  let n = scene.elements.filter(isIcona).length
  const usati = new Set(scene.elements.map((e) => e.id))
  while (usati.has(`f-${n}`)) n++
  return `f-${n}`
}

export function applyMutation(scene: Scene, action: SceneAction): Scene {
  const startY = startYCorrente(scene)
  const icone = scene.elements.filter(isIcona)

  switch (action.type) {
    case 'sposta-feature': {
      const i = icone.findIndex((e) => e.id === action.id)
      if (i < 0) return scene
      const j = action.direzione === 'su' ? i - 1 : i + 1
      if (j < 0 || j >= icone.length) return scene
      const arr = [...icone]
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return conIcone(scene, riflow(arr, startY))
    }
    case 'rimuovi': {
      const arr = icone.filter((e) => e.id !== action.id)
      if (arr.length === icone.length) return scene
      // ricostruisci senza l'elemento rimosso
      const elements = scene.elements.filter((e) => e.id !== action.id)
      const riflowate = riflow(elements.filter(isIcona), startY)
      let k = 0
      return { ...scene, elements: elements.map((el) => (isIcona(el) ? riflowate[k++] : el)) }
    }
    case 'aggiungi-feature': {
      const nuova: IconLabelElement = {
        type: 'icona-label',
        id: nuovoId(scene),
        chiave: action.chiave,
        etichetta: action.etichetta,
        x: 0,
        y: 0,
        verificata: false,
      }
      return conIcone(scene, riflow([...icone, nuova], startY))
    }
    case 'modifica-etichetta': {
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          isIcona(el) && el.id === action.id ? { ...el, etichetta: action.etichetta } : el,
        ),
      }
    }
  }
}
```

- [ ] **Step 4: Esegui il test (passa)**

Run: `npx vitest run tests/scene-mutations.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Suite completa + commit**

```bash
npm test
git add src/lib/scene/mutations.ts tests/scene-mutations.test.ts
git commit -m "feat: mutazioni tipizzate della scena (riordina/rimuovi/aggiungi/etichetta) con reflow"
```

---

### Task 3: Server actions aggiornate + render bundle per chiavi + persistenza

**Files:**
- Modify: `src/lib/render/bundle.ts` (aggiunge `resolveIconsForKeys`), `src/lib/ui/types.ts` (ProposeResult), `src/app/actions.ts`
- Test: `tests/render-bundle.test.ts` (aggiunge test per `resolveIconsForKeys`)

**Interfaces:**
- Produces:
  - In `bundle.ts`: `resolveIconsForKeys(chiavi: string[], deps?: { getIcon?: (k: string) => Promise<{ svg: string } | null> }): Promise<Record<string, string>>` — mappa chiave→inner-SVG per le chiavi con icona APPROVATA (le altre assenti).
  - In `ui/types.ts`: `ProposeResult` diventa `{ scene: Scene; iconMap: Record<string, string>; imageDataUri: string | null; prodotto: { sku: string; descrizioneBreve: string }; categoriaFeatures: { chiave: string; etichetta: string }[]; salvataDisponibile: boolean }` (rimosso `svg`). `categoriaFeatures` = feature del dizionario applicabili alla categoria del prodotto (per il menu "aggiungi").
  - In `actions.ts`: `proposeSceneAction(sku)` aggiornata (iconMap su TUTTE le chiavi applicabili, imageDataUri, categoriaFeatures, flag `salvataDisponibile` se esiste una scena salvata); `saveSceneAction(sceneJson): Promise<void>`; `loadSceneAction(sku): Promise<{ scene: Scene; iconMap; imageDataUri } | null>`.

- [ ] **Step 1: Aggiungi `resolveIconsForKeys` a bundle.ts + test**

In `src/lib/render/bundle.ts`, aggiungi (riusando `innerSvg` già presente e `getApprovedIcon`):

```ts
/** Mappa chiave→inner-SVG per le chiavi con icona approvata (le altre assenti). */
export async function resolveIconsForKeys(
  chiavi: string[],
  deps: { getIcon?: (k: string) => Promise<{ svg: string } | null> } = {},
): Promise<Record<string, string>> {
  const getIcon = deps.getIcon ?? ((k: string) => getApprovedIcon(k))
  const out: Record<string, string> = {}
  for (const k of chiavi) {
    if (k in out) continue
    const rec = await getIcon(k)
    if (rec) out[k] = innerSvg(rec.svg)
  }
  return out
}
```

Aggiungi in `tests/render-bundle.test.ts`:

```ts
describe('resolveIconsForKeys', () => {
  it('mappa solo le chiavi con icona approvata, inner SVG', async () => {
    const { resolveIconsForKeys } = await import('@/lib/render/bundle')
    const getIcon = async (k: string) =>
      k === 'ok' ? { svg: '<svg viewBox="0 0 24 24"><path d="M9 9"/></svg>' } : null
    const map = await resolveIconsForKeys(['ok', 'no', 'ok'], { getIcon })
    expect(Object.keys(map)).toEqual(['ok'])
    expect(map.ok).toContain('M9 9')
    expect(map.ok).not.toMatch(/<svg/i)
  })
})
```

- [ ] **Step 2: Esegui i test bundle (verifica RED sul nuovo, poi GREEN)**

Run: `npx vitest run tests/render-bundle.test.ts`
Expected: prima FAIL sul nuovo describe (funzione assente), poi PASS dopo l'implementazione dello Step 1 (5 test totali nel file).

- [ ] **Step 3: Aggiorna ProposeResult**

`src/lib/ui/types.ts`:

```ts
import type { Scene } from '@/lib/scene/types'

export interface ProposeResult {
  scene: Scene
  iconMap: Record<string, string>
  imageDataUri: string | null
  prodotto: { sku: string; descrizioneBreve: string }
  categoriaFeatures: { chiave: string; etichetta: string }[]
  salvataDisponibile: boolean
}
```

- [ ] **Step 4: Aggiorna le server action**

In `src/app/actions.ts`, sostituisci `proposeSceneAction` e aggiungi save/load. Import aggiuntivi: `resolveRenderBundle, resolveIconsForKeys, renderSceneServer` da `@/lib/render/bundle`; `db` da `@/lib/db`; `loadDictionary`. La versione aggiornata:

```ts
export async function proposeSceneAction(sku: string): Promise<ProposeResult> {
  const s = (sku ?? '').trim()
  if (!s) throw new Error('SKU mancante')

  await refreshFeedIfStale(isFake() ? { download: async () => '' } : {})
  const product = await getProduct(s)
  if (!product) throw new Error(`SKU ${s} non trovato nel feed`)

  const dict = loadDictionary()
  const generate = isFake() ? fakeGenerate() : undefined
  const proposal = await extractProposal(product, dict, generate)

  const composeDeps = isFake() ? { download: fakeDownload() } : undefined
  const { scene } = await composeSceneForProduct({ proposal, product, deps: composeDeps })

  // icone per TUTTE le feature applicabili alla categoria (così "aggiungi" ha già l'icona)
  const applicabili = Object.entries(dict.features)
    .filter(([, def]) => def.categorie.includes(proposal.categoria))
    .map(([chiave, def]) => ({ chiave, etichetta: def.label.replace('{valore}', '') }))
  const bundle = await resolveRenderBundle(scene)
  const iconMapChiavi = await resolveIconsForKeys(applicabili.map((f) => f.chiave))
  const iconMap = { ...iconMapChiavi, ...bundle.iconMap }

  const salvata = await db.scene.findUnique({ where: { sku: s } })
  return {
    scene,
    iconMap,
    imageDataUri: bundle.imageDataUri,
    prodotto: { sku: product.sku, descrizioneBreve: product.descrizioneBreve },
    categoriaFeatures: applicabili,
    salvataDisponibile: salvata !== null,
  }
}

export async function saveSceneAction(sceneJson: string): Promise<void> {
  const scene: Scene = parseScene(JSON.parse(sceneJson))
  if (!/^[A-Za-z0-9._-]+$/.test(scene.sku)) throw new Error('SKU non valido')
  await db.scene.upsert({
    where: { sku: scene.sku },
    create: { sku: scene.sku, sceneJson: JSON.stringify(scene) },
    update: { sceneJson: JSON.stringify(scene) },
  })
}

export async function loadSceneAction(
  sku: string,
): Promise<{ scene: Scene; iconMap: Record<string, string>; imageDataUri: string | null } | null> {
  const s = (sku ?? '').trim()
  if (!/^[A-Za-z0-9._-]+$/.test(s)) throw new Error('SKU non valido')
  const row = await db.scene.findUnique({ where: { sku: s } })
  if (!row) return null
  const scene: Scene = parseScene(JSON.parse(row.sceneJson))
  const dict = loadDictionary()
  const applicabili = Object.keys(dict.features)
  const bundle = await resolveRenderBundle(scene)
  const iconMapChiavi = await resolveIconsForKeys(applicabili)
  return { scene, iconMap: { ...iconMapChiavi, ...bundle.iconMap }, imageDataUri: bundle.imageDataUri }
}
```

Rimuovi `renderSceneServer` dall'import di `proposeSceneAction` SOLO se non più usato lì (l'anteprima ora è client-side); `exportSceneAction` continua a usare `renderSceneServer` — quindi tienilo importato. Verifica che `actions.ts` continui a esportare SOLO funzioni async.

- [ ] **Step 5: Verifica**

Run: `npx vitest run tests/render-bundle.test.ts && npm test`
Expected: verde (90: 89 + 1 nuovo test resolveIconsForKeys).

Run: `npx tsc --noEmit && npx next build`
Expected: puliti; `actions.ts` esporta solo funzioni async.

- [ ] **Step 6: Commit**

```bash
git add src/lib/render/bundle.ts src/lib/ui/types.ts src/app/actions.ts tests/render-bundle.test.ts
git commit -m "feat: propose ritorna bundle+feature applicabili; save/load scena; resolveIconsForKeys"
```

---

### Task 4: Anteprima client-side (renderScene nel browser)

**Files:**
- Modify: `src/lib/ui/ScenePreview.tsx`

**Interfaces:**
- Consumes: `renderScene` da `@/lib/render/svg` (ORA client-safe, post-Task-1), tipo `Scene`.
- Produces: `<ScenePreview scene iconMap imageDataUri />` — client component che calcola l'SVG con `renderScene` in `useMemo` e lo mostra responsivo. Sostituisce la variante 3a che riceveva la stringa già pronta.

- [ ] **Step 1: Riscrivi ScenePreview per il rendering client-side**

`src/lib/ui/ScenePreview.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { renderScene } from '@/lib/render/svg'
import type { Scene } from '@/lib/scene/types'

export function ScenePreview({
  scene,
  iconMap,
  imageDataUri,
}: {
  scene: Scene
  iconMap: Record<string, string>
  imageDataUri: string | null
}) {
  const svg = useMemo(
    () => renderScene(scene, { icon: (k) => iconMap[k] ?? null, image: () => imageDataUri }),
    [scene, iconMap, imageDataUri],
  )
  return (
    <div
      className="w-full max-w-[1000px] aspect-square border border-zinc-200 bg-white"
      // SVG dal renderer canonico (stesso output dell'export) — testo XML-escapato, icone sanitizzate
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
```

- [ ] **Step 2: Verifica client-safety**

Run: `npx next build`
Expected: build pulita. Questo è il vero test dello split del Task 1: un componente `'use client'` (`ScenePreview`) ora importa `renderScene` → `theme`, e la build DEVE riuscire (nessun `node:path` nel grafo client). Se la build fallisse con un errore di modulo Node nel bundle client, lo split del Task 1 è incompleto — fermati e segnala.

Run: `npx tsc --noEmit`
Expected: pulito.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/ScenePreview.tsx
git commit -m "feat: anteprima renderizzata client-side con renderScene (post-split theme)"
```

---

### Task 5: UI editor (pannello feature + reducer + salva/esporta)

**Files:**
- Create: `src/app/studio/FeaturePanel.tsx`
- Modify: `src/app/studio/StudioClient.tsx`

**Interfaces:**
- Consumes: `proposeSceneAction`/`exportSceneAction`/`saveSceneAction`/`loadSceneAction` da `../actions`; `ProposeResult` da `@/lib/ui/types`; `ScenePreview` (Task 4); `applyMutation`/`SceneAction` da `@/lib/scene/mutations`; tipi scena.
- Produces: l'editor. Stato scena con `useReducer(applyMutation, ...)`; pannello `FeaturePanel` che emette `SceneAction`; anteprima live; pulsanti Salva/Esporta; opzione "Riprendi salvata".

- [ ] **Step 1: Pannello feature**

`src/app/studio/FeaturePanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Scene, IconLabelElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'

export function FeaturePanel({
  scene,
  categoriaFeatures,
  dispatch,
}: {
  scene: Scene
  categoriaFeatures: { chiave: string; etichetta: string }[]
  dispatch: (a: SceneAction) => void
}) {
  const [daAggiungere, setDaAggiungere] = useState('')
  const icone = scene.elements.filter((e): e is IconLabelElement => e.type === 'icona-label')
  const presenti = new Set(icone.map((e) => e.chiave))
  const aggiungibili = categoriaFeatures.filter((f) => !presenti.has(f.chiave))

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-zinc-700">Caratteristiche</h3>
      <ul className="space-y-1">
        {icone.map((el, i) => (
          <li key={el.id} className="flex items-center gap-1">
            <input
              aria-label={`Etichetta ${el.chiave}`}
              className={`flex-1 rounded border px-2 py-1 text-sm ${el.verificata ? 'border-zinc-300' : 'border-amber-400'}`}
              value={el.etichetta}
              onChange={(e) => dispatch({ type: 'modifica-etichetta', id: el.id, etichetta: e.target.value })}
            />
            <button aria-label={`Su ${el.chiave}`} disabled={i === 0} className="px-1 disabled:opacity-30"
              onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'su' })}>↑</button>
            <button aria-label={`Giù ${el.chiave}`} disabled={i === icone.length - 1} className="px-1 disabled:opacity-30"
              onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'giu' })}>↓</button>
            <button aria-label={`Rimuovi ${el.chiave}`} className="px-1 text-red-600"
              onClick={() => dispatch({ type: 'rimuovi', id: el.id })}>✕</button>
          </li>
        ))}
      </ul>
      {aggiungibili.length > 0 && (
        <div className="flex gap-1">
          <select aria-label="Aggiungi caratteristica" className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
            value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
            <option value="">+ aggiungi…</option>
            {aggiungibili.map((f) => <option key={f.chiave} value={f.chiave}>{f.etichetta || f.chiave}</option>)}
          </select>
          <button className="rounded bg-zinc-800 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={!daAggiungere}
            onClick={() => {
              const f = aggiungibili.find((x) => x.chiave === daAggiungere)
              if (f) dispatch({ type: 'aggiungi-feature', chiave: f.chiave, etichetta: f.etichetta || f.chiave })
              setDaAggiungere('')
            }}>Aggiungi</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Editor in StudioClient**

Riscrivi `src/app/studio/StudioClient.tsx` per gestire lo stato scena con `useReducer` e montare `FeaturePanel` + `ScenePreview` (client-side). Punti chiave: dopo `proposeSceneAction`, inizializzare il reducer con la scena; l'anteprima usa `scene`+`iconMap`+`imageDataUri`; Salva serializza `scene`; Esporta invia `scene` corrente. Mantieni le stringhe E2E (aria-label "SKU", pulsanti "Proponi"/"Esporta JPEG"/"Salva", role="alert", alt "Anteprima esportata").

```tsx
'use client'

import { useReducer, useState, useTransition } from 'react'
import { proposeSceneAction, exportSceneAction, saveSceneAction, loadSceneAction } from '../actions'
import type { ProposeResult } from '@/lib/ui/types'
import type { Scene } from '@/lib/scene/types'
import { applyMutation } from '@/lib/scene/mutations'
import { ScenePreview } from '@/lib/ui/ScenePreview'
import { FeaturePanel } from './FeaturePanel'

type Bundle = { iconMap: Record<string, string>; imageDataUri: string | null; categoriaFeatures: ProposeResult['categoriaFeatures'] }

export function StudioClient() {
  const [sku, setSku] = useState('')
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [scene, dispatch] = useReducer(
    (s: Scene | null, a: Parameters<typeof applyMutation>[1] | { type: 'reset'; scene: Scene }) =>
      a.type === 'reset' ? a.scene : s ? applyMutation(s, a) : s,
    null,
  )
  const [prodotto, setProdotto] = useState<ProposeResult['prodotto'] | null>(null)
  const [salvataDisponibile, setSalvata] = useState(false)
  const [thumb, setThumb] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, start] = useTransition()

  function proponi() {
    setErrore(null); setThumb(null); setMsg(null)
    start(async () => {
      try {
        const r = await proposeSceneAction(sku)
        dispatch({ type: 'reset', scene: r.scene })
        setBundle({ iconMap: r.iconMap, imageDataUri: r.imageDataUri, categoriaFeatures: r.categoriaFeatures })
        setProdotto(r.prodotto)
        setSalvata(r.salvataDisponibile)
      } catch (e) { setBundle(null); setErrore(e instanceof Error ? e.message : 'Errore') }
    })
  }

  function riprendi() {
    setErrore(null); setThumb(null); setMsg(null)
    start(async () => {
      try {
        const r = await loadSceneAction(sku)
        if (!r) { setMsg('Nessuna scheda salvata per questo SKU'); return }
        dispatch({ type: 'reset', scene: r.scene })
        setBundle((b) => (b ? { ...b, iconMap: r.iconMap, imageDataUri: r.imageDataUri } : b))
      } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore') }
    })
  }

  function salva() {
    if (!scene) return
    start(async () => {
      try { await saveSceneAction(JSON.stringify(scene)); setMsg('Scheda salvata'); setSalvata(true) }
      catch (e) { setErrore(e instanceof Error ? e.message : 'Errore salvataggio') }
    })
  }

  function esporta() {
    if (!scene) return
    setErrore(null)
    start(async () => {
      try { setThumb((await exportSceneAction(JSON.stringify(scene))).thumbDataUri) }
      catch (e) { setErrore(e instanceof Error ? e.message : 'Errore export') }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input aria-label="SKU" className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Inserisci SKU (es. 2137070)" value={sku}
          onChange={(e) => setSku(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && proponi()} />
        <button className="rounded bg-zinc-800 px-4 py-2 text-white disabled:opacity-50"
          onClick={proponi} disabled={inCorso || sku.trim() === ''}>{inCorso ? 'Elaboro…' : 'Proponi'}</button>
      </div>

      {errore && <p role="alert" className="text-red-600">{errore}</p>}
      {msg && <p className="text-emerald-700">{msg}</p>}

      {scene && bundle && prodotto && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1"><ScenePreview scene={scene} iconMap={bundle.iconMap} imageDataUri={bundle.imageDataUri} /></div>
          <aside className="w-full md:w-80 space-y-3">
            <div>
              <h2 className="font-medium text-zinc-700">{prodotto.descrizioneBreve}</h2>
              <p className="text-sm text-zinc-500">SKU {prodotto.sku}</p>
            </div>
            <FeaturePanel scene={scene} categoriaFeatures={bundle.categoriaFeatures} dispatch={dispatch} />
            <div className="flex gap-2">
              <button className="rounded bg-zinc-700 px-4 py-2 text-white disabled:opacity-50" onClick={salva} disabled={inCorso}>Salva</button>
              <button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={esporta} disabled={inCorso}>Esporta JPEG</button>
              {salvataDisponibile && (
                <button className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 disabled:opacity-50" onClick={riprendi} disabled={inCorso}>Riprendi salvata</button>
              )}
            </div>
            {thumb && (
              <div>
                <p className="text-sm text-zinc-500">Esportata:</p>
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

Run: `npx next build && npx tsc --noEmit`
Expected: puliti; rotta `/studio` compilata.

- [ ] **Step 4: Commit**

```bash
git add src/app/studio/StudioClient.tsx src/app/studio/FeaturePanel.tsx
git commit -m "feat: editor scena (pannello feature con reducer, salva/riprendi/esporta, anteprima live)"
```

---

### Task 6: E2E editing (edit→export riflette; save→reload persiste)

**Files:**
- Modify: `e2e/studio.spec.ts`

**Interfaces:**
- Consumes: l'app in modo `SVG_STUDIO_FAKE=1` (feed seedato dal global-setup 3a, Gemini/download finti). Le fixture 3a (prodotto/estrazione con `barbecue` + `struttura_acciaio`/`montaggio_facile`) restano valide.
- Produces: test E2E che un'edit modifica l'anteprima e l'export, e che salva/riprendi persiste.

- [ ] **Step 1: Estendi lo spec E2E**

Aggiungi a `e2e/studio.spec.ts` (mantieni i 2 test 3a esistenti, aggiornando eventuali selettori se la UI è cambiata — la preview resta un `<svg>` filtrabile per la categoria "barbecue"):

```ts
test('modifica: rimuovere una feature aggiorna anteprima ed export', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('2137070')
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  // conteggio etichette prima
  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  expect(primaN).toBeGreaterThan(0)

  // rimuovi la prima feature
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await expect(etichette).toHaveCount(primaN - 1)

  // export continua a funzionare (riflette la scena modificata)
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('salva e riprendi: la scheda modificata persiste', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('2137070')
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Scheda salvata')).toBeVisible({ timeout: 30_000 })

  // ri-proponi e riprendi la salvata → deve avere una feature in meno
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(etichette).toHaveCount(primaN, { timeout: 30_000 }) // proposta fresca = conteggio pieno
  await page.getByRole('button', { name: 'Riprendi salvata' }).click()
  await expect(etichette).toHaveCount(primaN - 1, { timeout: 30_000 }) // salvata = una in meno
})
```

Nota: il secondo test dipende dallo stato DB tra i due `Proponi`. Poiché `saveSceneAction` scrive in `db.scene` e i test girano in sequenza (Playwright, un worker), il record salvato persiste tra i due passi dello STESSO test. Se emergono interferenze tra test (il primo test lascia una scena salvata che altera `salvataDisponibile` nel secondo), aggiungi una pulizia di `db.scene` nel `seed.ts`/global-setup all'avvio, o usa uno SKU dedicato per il test di persistenza. Documenta la scelta.

- [ ] **Step 2: Esegui E2E + unit**

```bash
npm run e2e
npm test
```

Expected: E2E — i 2 test 3a + i 2 nuovi verdi (4 totali); se il browser non è installabile nell'ambiente, segnala BLOCKED ma lascia committati spec/codice. Unit — 90 verdi.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test: E2E editing (rimozione feature riflette in export; salva/riprendi persiste)"
```

---

## Criteri di completamento Fase 3b

- `npm run dev` → `/studio`: dopo "Proponi", l'operatrice può riordinare/rimuovere/aggiungere feature e correggere etichette, con **anteprima aggiornata in tempo reale** (rendering client-side).
- **Parità anteprima/export**: l'export riflette esattamente le modifiche mostrate in anteprima (stesso `renderScene`, stesso bundle).
- **Salva/Riprendi**: la scena modificata si persiste in `db.scene` e si riapre.
- `npm test` verde (90; golden Fase 2 invariati dopo lo split di `theme.ts`).
- `npm run e2e` verde offline (4 test: proposta, SKU inesistente, edit→export, salva→riprendi).
- Confine server/client rispettato: `ScenePreview` (client) importa `renderScene`→`theme` e la build resta pulita (nessun `node:*` nel bundle client).

## Note per la Fase 3c (interazioni fini + libreria icone)

- **Drag frecce quota**: overlay sull'anteprima con mapping puntatore→viewBox (0..1000) via il bounding rect del contenitore; mutazione `sposta-quota(id, estremo, x, y)`.
- **Cambio foto**: scelta tra `product.images`; server action che scarica+mette in cache l'immagine scelta e ritorna hash+dataUri; mutazione `imposta-foto(imageHash)` + aggiornamento `imageDataUri` client; risoluzione `imageDataUri` per-hash (oggi prima-foto-vince).
- **Icon picker (sostituisci icona)**: UI che chiama `searchIconify`+`listIcons`, salva la scelta come `in-revisione` e la aggiunge a `iconMap`; regola di rendering "icona marcata" per le non approvate in editor (l'export segnala/blocca se restano non approvate).
- **Griglia approvazione icone** (`/icone`, Spec §7): `listIcons`/`approveIcon`/seeding via `searchIconify` — approvazione in blocco.
- **Cosmetici da 3a**: dark-mode contrast, `filter` con type-predicate, E2E su `next build && start` per eliminare i filtri dev-mode dei selettori.
