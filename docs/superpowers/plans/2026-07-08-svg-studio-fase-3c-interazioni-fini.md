# SVG Studio — Fase 3c — Interazioni fini di editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere all'editor (Fase 3b) le interazioni fini della Spec §6 che restano: trascinare le frecce di quotatura, cambiare la foto del prodotto (tra quelle del feed), e cercare un prodotto per nome quando non si conosce lo SKU.

**Architecture:** Si estende l'editor client-side esistente. Le frecce quota si modificano con un **overlay di maniglie trascinabili** sovrapposto all'anteprima SVG (che resta renderizzata da `renderScene`): il drag mappa le coordinate schermo nel sistema viewBox 0..1000 e dispatcha una mutazione `sposta-quota` pura sul reducer, con re-render live. Il cambio foto passa da una **server action** che scarica+mette in cache l'immagine scelta e restituisce hash+data URI (l'anteprima è un percorso client, ma download/cache sono Node). La ricerca-per-nome è una **server action** `cercaSkuAction` che avvolge `searchProducts`, con un dropdown di risultati.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, @playwright/test. Riusa Fase 1/2/3a/3b.

## Decisioni di scope della Fase 3c (prese dal planner)

- **In scope** (Spec §6/§8): drag frecce quota, cambio foto (tra `product.images`), ricerca-per-nome.
- **Rimandato a Fase 3d** (libreria icone, Spec §7): icon picker Iconify (sostituzione icona), salvataggio icone `in-revisione`, regola di rendering "icona marcata", griglia di approvazione `/icone`. È un sottosistema coerente a sé.
- **Foto singola**: si cambia l'unica foto della scena (template `colonna-sinistra`). Il caso multi-foto (`imageDataUri` per-hash) resta rimandato finché non esiste un template multi-prodotto.
- **Cambio template**: fuori scope finché esiste un solo template.

## Global Constraints

- **Determinismo & parità anteprima/export invariati**: dopo ogni modifica (drag/cambio foto), l'anteprima client e l'export server devono restare identici per la stessa scena. Le mutazioni sono **funzioni pure** `Scene → Scene` (nessun `Date`/`random`); il drag aggiorna solo le coordinate degli estremi della quota, dentro i limiti del canvas [0..1000].
- **Le mutazioni restano nel reducer** `applyMutation` (Fase 3b): si estende `SceneAction` con `sposta-quota` e `imposta-foto`; nessuna logica di scena fuori dal reducer.
- **Confine server/client**: il download/cache immagine e `searchProducts` girano SOLO in server action; l'overlay di drag e i picker sono client e non importano moduli Node. `renderScene`/`theme` restano client-safe (Fase 3b).
- **Coordinate**: il canvas è 1000×1000 con viewBox `0 0 1000 1000`. Il mapping schermo→viewBox usa il bounding rect del contenitore dell'anteprima (quadrato, `scale = lato_px / 1000`). Gli estremi trascinati vanno clampati in [0, 1000].
- **Validazione server action**: `cambiaFotoAction` accetta un URL che DEVE appartenere a `product.images` del prodotto corrente (non un URL arbitrario dal client → SSRF); `cercaSkuAction` limita la query. La guard `sku` `^[A-Za-z0-9._-]+$` resta dove già presente.
- **Riuso Fase 1/2/3a/3b immutato**: `searchProducts`, `cacheImage`/`readCachedImage`, `extToMime`, `applyMutation`/`SceneAction`, `renderScene`, tipi scena, le server action esistenti. Estendere `mutations.ts`, `actions.ts`, `ui/types.ts`, l'UI dello studio; NON modificare il motore Fase 1/2. Se un adattamento sembra indispensabile, fermarsi e segnalarlo.
- **Next.js 16**: server action = modulo `'use server'` con solo funzioni async; tipi in `ui/types.ts`. Consultare `node_modules/next/dist/docs/01-app/` prima di toccare App-Router.
- **E2E offline** via `SVG_STUDIO_FAKE=1` (fake feed/Gemini/download di Fase 3a); il seed e il fake vanno estesi se il test lo richiede (es. `product.images` con più URL, `fakeDownload` per il cambio foto).
- **Node 20+, npm.** Alias `@/* → src/*`. UI/commenti italiano. Commit italiani `feat:`/`test:`/`fix:`. `.gitattributes` LF/binary invariato.

## File Structure

```
src/
  lib/
    scene/
      mutations.ts         # Task 1 — +SceneAction 'sposta-quota'|'imposta-foto', +branch in applyMutation
    ui/
      types.ts             # Task 3 — ProposeResult += immagini: string[]
      QuotaOverlay.tsx      # Task 2 — overlay maniglie trascinabili sulle quote (client)
      EditorPreview.tsx     # Task 2 — compone ScenePreview + QuotaOverlay in un contenitore con ref
  app/
    actions.ts             # Task 3/4 — proposeSceneAction (+immagini), cambiaFotoAction, cercaSkuAction
    studio/
      StudioClient.tsx     # Task 2/3/4 — usa EditorPreview, PhotoPicker, SkuSearch
      PhotoPicker.tsx       # Task 3 — thumbnail delle foto del feed (client)
      SkuSearch.tsx         # Task 4 — ricerca per nome (client)
tests/
  scene-mutations.test.ts  # Task 1 — +test sposta-quota / imposta-foto
e2e/
  fixtures/
    prodotto-2137070.json   # Task 3 — aggiungere una 2ª immagine per testare il cambio foto
  studio.spec.ts            # Task 5 — +test drag quota, cambio foto, ricerca
```

---

### Task 1: Mutazioni `sposta-quota` e `imposta-foto` (reducer)

**Files:**
- Modify: `src/lib/scene/mutations.ts`
- Test: `tests/scene-mutations.test.ts`

**Interfaces:**
- Consumes: tipi scena; `applyMutation` esistente.
- Produces: `SceneAction` esteso con `{ type: 'sposta-quota'; id: string; estremo: 'inizio' | 'fine'; x: number; y: number }` e `{ type: 'imposta-foto'; imageHash: string }`. `applyMutation` gestisce i due nuovi rami: `sposta-quota` imposta (x1,y1) se `estremo==='inizio'` oppure (x2,y2) se `'fine'` sulla quota con quell'id, **clampando** x/y in [0, canvas.width/height]; `imposta-foto` imposta `imageHash` sull'elemento `foto`. Entrambi puri, no-op se l'id/elemento non esiste.

- [ ] **Step 1: Aggiungi i test (falliscono)**

Aggiungi a `tests/scene-mutations.test.ts` (la `scenaBase()` esistente ha già una foto `ph`; aggiungi una quota per il test — oppure estendi `scenaBase`). Usa una scena con una quota e la foto:

```ts
import type { QuotaElement, FotoElement } from '@/lib/scene/types'

function scenaConQuota(): Scene {
  const s = scenaBase()
  s.elements.push({ type: 'quota', id: 'q0', orientamento: 'verticale', valore: '84,5 cm', x1: 940, y1: 100, x2: 940, y2: 620 })
  return s
}
const quota = (s: Scene) => s.elements.find((e): e is QuotaElement => e.type === 'quota')!
const foto = (s: Scene) => s.elements.find((e): e is FotoElement => e.type === 'foto')!

describe('sposta-quota', () => {
  it('sposta l\'estremo iniziale', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'inizio', x: 900, y: 150 })
    expect(quota(s).x1).toBe(900)
    expect(quota(s).y1).toBe(150)
    expect(quota(s).x2).toBe(940) // l'altro estremo invariato
  })

  it('sposta l\'estremo finale', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'fine', x: 880, y: 600 })
    expect(quota(s).x2).toBe(880)
    expect(quota(s).y2).toBe(600)
  })

  it('clampa entro il canvas [0..1000]', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'q0', estremo: 'fine', x: 1200, y: -30 })
    expect(quota(s).x2).toBe(1000)
    expect(quota(s).y2).toBe(0)
  })

  it('no-op se la quota non esiste', () => {
    const s = applyMutation(scenaConQuota(), { type: 'sposta-quota', id: 'inesistente', estremo: 'fine', x: 1, y: 1 })
    expect(quota(s).x2).toBe(940)
  })

  it('è pura (non muta l\'input)', () => {
    const orig = scenaConQuota()
    const copia = JSON.parse(JSON.stringify(orig))
    applyMutation(orig, { type: 'sposta-quota', id: 'q0', estremo: 'inizio', x: 1, y: 2 })
    expect(orig).toEqual(copia)
  })
})

describe('imposta-foto', () => {
  it('cambia l\'imageHash della foto', () => {
    const s = applyMutation(scenaBase(), { type: 'imposta-foto', imageHash: 'nuovo-hash' })
    expect(foto(s).imageHash).toBe('nuovo-hash')
  })
  it('no-op se non c\'è foto', () => {
    const senzaFoto: Scene = { ...scenaBase(), elements: scenaBase().elements.filter((e) => e.type !== 'foto') }
    expect(() => applyMutation(senzaFoto, { type: 'imposta-foto', imageHash: 'x' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Esegui (falliscono)**

Run: `npx vitest run tests/scene-mutations.test.ts`
Expected: FAIL sui nuovi describe (rami non gestiti).

- [ ] **Step 3: Estendi `SceneAction` e `applyMutation`**

In `src/lib/scene/mutations.ts`, aggiungi all'unione `SceneAction`:

```ts
  | { type: 'sposta-quota'; id: string; estremo: 'inizio' | 'fine'; x: number; y: number }
  | { type: 'imposta-foto'; imageHash: string }
```

E aggiungi i due `case` in `applyMutation` (dentro lo `switch(action.type)`):

```ts
    case 'sposta-quota': {
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
      const x = clamp(action.x, scene.canvas.width)
      const y = clamp(action.y, scene.canvas.height)
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          el.type === 'quota' && el.id === action.id
            ? action.estremo === 'inizio'
              ? { ...el, x1: x, y1: y }
              : { ...el, x2: x, y2: y }
            : el,
        ),
      }
    }
    case 'imposta-foto': {
      return {
        ...scene,
        elements: scene.elements.map((el) =>
          el.type === 'foto' ? { ...el, imageHash: action.imageHash } : el,
        ),
      }
    }
```

- [ ] **Step 4: Esegui (passano)**

Run: `npx vitest run tests/scene-mutations.test.ts`
Expected: PASS (7 esistenti + 7 nuovi = 14).

- [ ] **Step 5: Suite completa + commit**

```bash
npm test
git add src/lib/scene/mutations.ts tests/scene-mutations.test.ts
git commit -m "feat: mutazioni sposta-quota (con clamp) e imposta-foto nel reducer scena"
```

---

### Task 2: Overlay maniglie quota trascinabili + EditorPreview

**Files:**
- Create: `src/lib/ui/QuotaOverlay.tsx`, `src/lib/ui/EditorPreview.tsx`
- Modify: `src/app/studio/StudioClient.tsx` (usa `EditorPreview` al posto di `ScenePreview`)

**Interfaces:**
- Consumes: `renderScene`/`ScenePreview` (indiretto), tipi scena, `SceneAction`.
- Produces:
  - `EditorPreview({ scene, iconMap, imageDataUri, dispatch }: { scene: Scene; iconMap: Record<string,string>; imageDataUri: string | null; dispatch: (a: SceneAction) => void })` — contenitore quadrato con `ref`, che monta `ScenePreview` (SVG) e sopra `QuotaOverlay`.
  - `QuotaOverlay({ scene, containerRef, dispatch })` — per ogni `quota` disegna due maniglie (inizio/fine) posizionate scalando le coordinate viewBox al box renderizzato; il drag (pointer events) calcola la nuova coordinata viewBox dal rect del contenitore e dispatcha `sposta-quota`.

- [ ] **Step 1: QuotaOverlay**

`src/lib/ui/QuotaOverlay.tsx`:

```tsx
'use client'

import { type RefObject, useCallback } from 'react'
import type { Scene, QuotaElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'

const CANVAS = 1000

export function QuotaOverlay({
  scene,
  containerRef,
  dispatch,
}: {
  scene: Scene
  containerRef: RefObject<HTMLDivElement | null>
  dispatch: (a: SceneAction) => void
}) {
  const quote = scene.elements.filter((e): e is QuotaElement => e.type === 'quota')

  const onDrag = useCallback(
    (id: string, estremo: 'inizio' | 'fine') => (e: React.PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect()
        const x = ((ev.clientX - r.left) / r.width) * CANVAS
        const y = ((ev.clientY - r.top) / r.height) * CANVAS
        dispatch({ type: 'sposta-quota', id, estremo, x, y })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [containerRef, dispatch],
  )

  return (
    <>
      {quote.flatMap((q) => [
        { estremo: 'inizio' as const, x: q.x1, y: q.y1 },
        { estremo: 'fine' as const, x: q.x2, y: q.y2 },
      ].map((h) => (
        <button
          key={`${q.id}-${h.estremo}`}
          data-testid={`quota-${q.id}-${h.estremo}`}
          aria-label={`Estremo ${h.estremo} quota ${q.valore}`}
          onPointerDown={onDrag(q.id, h.estremo)}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-emerald-600 shadow"
          style={{ left: `${(h.x / CANVAS) * 100}%`, top: `${(h.y / CANVAS) * 100}%`, touchAction: 'none' }}
        />
      )))}
    </>
  )
}
```

Nota: le maniglie sono posizionate in percentuale (`left/top` in %), così restano allineate a prescindere dalla dimensione renderizzata del contenitore quadrato; il drag converte i pixel del rect corrente in coordinate viewBox 0..1000.

- [ ] **Step 2: EditorPreview**

`src/lib/ui/EditorPreview.tsx`:

```tsx
'use client'

import { useRef } from 'react'
import type { Scene } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'
import { ScenePreview } from '@/lib/ui/ScenePreview'
import { QuotaOverlay } from '@/lib/ui/QuotaOverlay'

export function EditorPreview({
  scene,
  iconMap,
  imageDataUri,
  dispatch,
}: {
  scene: Scene
  iconMap: Record<string, string>
  imageDataUri: string | null
  dispatch: (a: SceneAction) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="relative w-full max-w-[1000px] aspect-square">
      <ScenePreview scene={scene} iconMap={iconMap} imageDataUri={imageDataUri} />
      <QuotaOverlay scene={scene} containerRef={ref} dispatch={dispatch} />
    </div>
  )
}
```

Nota: `ScenePreview` ha già `w-full max-w-[1000px] aspect-square` sul suo div interno; qui il contenitore esterno con `ref` ha le stesse dimensioni, quindi il suo rect coincide col box dell'SVG per il mapping delle coordinate.

- [ ] **Step 3: Usa EditorPreview in StudioClient**

In `src/app/studio/StudioClient.tsx`, sostituisci `<ScenePreview scene={scene} iconMap={bundle.iconMap} imageDataUri={bundle.imageDataUri} />` con:

```tsx
<EditorPreview scene={scene} iconMap={bundle.iconMap} imageDataUri={bundle.imageDataUri} dispatch={dispatch} />
```

e aggiorna l'import: rimuovi l'import diretto di `ScenePreview` se non più usato altrove e aggiungi `import { EditorPreview } from '@/lib/ui/EditorPreview'`.

- [ ] **Step 4: Verifica build/boundary**

Run: `npx tsc --noEmit && npx next build`
Expected: puliti. `QuotaOverlay`/`EditorPreview` sono `'use client'` e importano solo react + tipi + ScenePreview — nessun modulo Node.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/QuotaOverlay.tsx src/lib/ui/EditorPreview.tsx src/app/studio/StudioClient.tsx
git commit -m "feat: overlay maniglie trascinabili per le frecce quota (sposta-quota live)"
```

---

### Task 3: Cambio foto (server action + picker)

**Files:**
- Modify: `src/lib/ui/types.ts` (ProposeResult += `immagini`), `src/app/actions.ts` (proposeSceneAction ritorna `immagini`; nuova `cambiaFotoAction`), `src/app/studio/StudioClient.tsx` (monta PhotoPicker, gestisce il cambio)
- Create: `src/app/studio/PhotoPicker.tsx`

**Interfaces:**
- Produces:
  - `ProposeResult.immagini: string[]` — gli URL foto del prodotto (`product.images`).
  - `cambiaFotoAction(sku: string, url: string): Promise<{ imageHash: string; imageDataUri: string }>` — verifica che `url ∈ product.images` del prodotto `sku` (anti-SSRF), scarica+mette in cache l'immagine (fake in E2E), restituisce hash + data URI.
  - `PhotoPicker({ immagini, onScegli }: { immagini: string[]; onScegli: (url: string) => void })` — miniature cliccabili.

- [ ] **Step 1: ProposeResult += immagini**

In `src/lib/ui/types.ts`, aggiungi il campo:

```ts
  immagini: string[]
```

- [ ] **Step 2: proposeSceneAction ritorna immagini + cambiaFotoAction**

In `src/app/actions.ts`, in `proposeSceneAction` aggiungi al return `immagini: product.images,`.

Aggiungi la nuova action (riusa `extToMime` da `@/lib/ui/mime`, `cacheImage`/`readCachedImage` da `@/lib/images/cache`, `getProduct`):

```ts
export async function cambiaFotoAction(sku: string, url: string): Promise<{ imageHash: string; imageDataUri: string }> {
  const product = await getProduct((sku ?? '').trim())
  if (!product) throw new Error('Prodotto non trovato')
  if (!product.images.includes(url)) throw new Error('URL immagine non appartenente al prodotto')
  const deps = isFake() ? { download: fakeDownload() } : undefined
  const cached = await cacheImage(url, deps)
  const bytes = readCachedImage(cached.hash, cached.ext)
  const imageDataUri = `data:${extToMime(cached.ext)};base64,${bytes.toString('base64')}`
  return { imageHash: cached.hash, imageDataUri }
}
```

Aggiungi gli import necessari in cima ad `actions.ts`: `cacheImage, readCachedImage` da `@/lib/images/cache`, `extToMime` da `@/lib/ui/mime` (se non già importati).

- [ ] **Step 3: PhotoPicker**

`src/app/studio/PhotoPicker.tsx`:

```tsx
'use client'

export function PhotoPicker({ immagini, onScegli }: { immagini: string[]; onScegli: (url: string) => void }) {
  if (immagini.length <= 1) return null
  return (
    <div>
      <h3 className="font-medium text-zinc-700">Foto</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {immagini.map((url, i) => (
          <button
            key={url}
            aria-label={`Foto ${i + 1}`}
            onClick={() => onScegli(url)}
            className="h-16 w-16 overflow-hidden rounded border border-zinc-300 hover:border-emerald-600"
          >
            {/* miniatura remota: solo anteprima di scelta, non entra nella scena */}
            <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire in StudioClient**

Nel client, tieni `immagini` dal ProposeResult (nel `bundle` o in uno stato dedicato) e monta `<PhotoPicker immagini={...} onScegli={cambiaFoto} />` nell'aside. Handler:

```tsx
function cambiaFoto(url: string) {
  if (!prodotto) return
  start(async () => {
    try {
      const { imageHash, imageDataUri } = await cambiaFotoAction(prodotto.sku, url)
      dispatch({ type: 'imposta-foto', imageHash })
      setBundle((b) => (b ? { ...b, imageDataUri } : b))
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore cambio foto')
    }
  })
}
```

Aggiungi `immagini` al tipo `Bundle` locale e popolalo in `proponi`/`riprendi` (da `r.immagini`; `loadSceneAction` non lo ritorna → passa un array vuoto o estendi anche quella se serve; per 3c basta popolarlo su `proponi`). Importa `cambiaFotoAction` da `../actions` e `PhotoPicker`.

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti; suite invariata (nessun nuovo unit test in questo task — la logica pura è già testata; `cambiaFotoAction` è coperta dall'E2E del Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/types.ts src/app/actions.ts src/app/studio/PhotoPicker.tsx src/app/studio/StudioClient.tsx
git commit -m "feat: cambio foto del prodotto (server action con guard + picker miniature)"
```

---

### Task 4: Ricerca per nome

**Files:**
- Modify: `src/app/actions.ts` (nuova `cercaSkuAction`), `src/app/studio/StudioClient.tsx` (monta SkuSearch)
- Create: `src/app/studio/SkuSearch.tsx`

**Interfaces:**
- Produces:
  - `cercaSkuAction(q: string): Promise<{ sku: string; descrizioneBreve: string }[]>` — trim + minimo 2 caratteri, avvolge `searchProducts`.
  - `SkuSearch({ onScegli }: { onScegli: (sku: string) => void })` — input + pulsante "Cerca", mostra i risultati; click su un risultato chiama `onScegli(sku)`.

- [ ] **Step 1: cercaSkuAction**

In `src/app/actions.ts` (import `searchProducts` da `@/lib/feed/repository` accanto a `getProduct`):

```ts
export async function cercaSkuAction(q: string): Promise<{ sku: string; descrizioneBreve: string }[]> {
  const s = (q ?? '').trim()
  if (s.length < 2) return []
  return searchProducts(s)
}
```

- [ ] **Step 2: SkuSearch**

`src/app/studio/SkuSearch.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { cercaSkuAction } from '../actions'

export function SkuSearch({ onScegli }: { onScegli: (sku: string) => void }) {
  const [q, setQ] = useState('')
  const [risultati, setRisultati] = useState<{ sku: string; descrizioneBreve: string }[]>([])
  const [inCorso, start] = useTransition()

  function cerca() {
    start(async () => setRisultati(await cercaSkuAction(q)))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          aria-label="Cerca per nome"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Cerca per nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && cerca()}
        />
        <button className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 disabled:opacity-50" onClick={cerca} disabled={inCorso || q.trim().length < 2}>
          Cerca
        </button>
      </div>
      {risultati.length > 0 && (
        <ul className="rounded border border-zinc-200">
          {risultati.map((r) => (
            <li key={r.sku}>
              <button aria-label={`Scegli ${r.sku}`} className="block w-full px-3 py-1 text-left text-sm hover:bg-zinc-100" onClick={() => onScegli(r.sku)}>
                <span className="text-zinc-500">{r.sku}</span> — {r.descrizioneBreve}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire in StudioClient**

Sopra o accanto all'input SKU, monta `<SkuSearch onScegli={(sku) => { setSku(sku); proponiSku(sku) }} />`. Poiché `proponi()` legge lo `sku` di stato (aggiornato in modo asincrono), estrai una variante `proponiSku(skuArg: string)` che accetta lo SKU come argomento (o richiama `proposeSceneAction(skuArg)` direttamente), per evitare la race con `setSku`. Minima: rifattorizza `proponi` in `proponiSku(skuArg = sku)` che usa `skuArg`.

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti; suite invariata.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts src/app/studio/SkuSearch.tsx src/app/studio/StudioClient.tsx
git commit -m "feat: ricerca prodotto per nome (cercaSkuAction + UI risultati)"
```

---

### Task 5: E2E interazioni fini

**Files:**
- Modify: `e2e/fixtures/prodotto-2137070.json` (aggiungi una 2ª immagine), `e2e/studio.spec.ts`

**Interfaces:**
- Consumes: l'app in modo `SVG_STUDIO_FAKE=1`. `fakeDownload` restituisce la stessa PNG di fixture per qualunque URL, quindi il cambio foto in E2E produce lo stesso hash (va bene: si verifica che il flusso non erri e l'anteprima resti valida; per verificare un hash diverso servirebbe una 2ª fixture immagine — opzionale).
- Produces: 3 nuovi test E2E (drag quota, cambio foto, ricerca).

- [ ] **Step 1: Aggiungi una 2ª immagine alla fixture prodotto**

In `e2e/fixtures/prodotto-2137070.json`, campo `images`, aggiungi un secondo URL (fittizio, es. `"https://esempio.local/foto2.png"`), così `PhotoPicker` (che si mostra solo con >1 immagine) è visibile e il cambio foto è esercitabile.

- [ ] **Step 2: Aggiungi i test E2E**

In `e2e/studio.spec.ts` (usa l'helper `apriEProponi` esistente):

```ts
test('drag di una maniglia quota sposta l\'estremo', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  const maniglia = page.locator('[data-testid^="quota-"]').first()
  await expect(maniglia).toBeVisible()
  const prima = await maniglia.boundingBox()
  expect(prima).not.toBeNull()

  // trascina la maniglia di ~80px a sinistra e ~40px in basso
  await maniglia.hover()
  await page.mouse.down()
  await page.mouse.move(prima!.x + prima!.width / 2 - 80, prima!.y + prima!.height / 2 + 40, { steps: 8 })
  await page.mouse.up()

  const dopo = await maniglia.boundingBox()
  expect(Math.abs(dopo!.x - prima!.x) + Math.abs(dopo!.y - prima!.y)).toBeGreaterThan(20)

  // l'export riflette comunque la scena modificata
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('cambio foto: selezionare una miniatura non rompe anteprima ed export', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Foto 2' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible()
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('ricerca per nome trova il prodotto e lo carica', async ({ page }) => {
  await page.goto('/studio')
  const cerca = page.getByLabel('Cerca per nome')
  await expect(async () => {
    await cerca.fill('barbecue')
    await expect(page.getByRole('button', { name: 'Cerca' })).toBeEnabled()
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Cerca' }).click()
  await page.getByRole('button', { name: 'Scegli 2137070' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })
})
```

Nota: la fixture `prodotto-2137070.json` ha `descrizioneBreve` "Barbecue a carbone" e `searchText` include "barbecue", quindi `searchProducts('barbecue')` la trova. Se la ricerca non restituisse nulla, verifica che il seed E2E (`e2e/seed.ts`) popoli `searchText` come fa `refreshFeedIfStale` (`${sku} ${descrizioneBreve}` in minuscolo) — già così nel seed di Fase 3a.

- [ ] **Step 3: Esegui E2E (due volte) + unit**

```bash
npm run e2e
npm run e2e
npm test
```

Expected: E2E — i test esistenti (4 di 3a/3b) + i 3 nuovi verdi (7 totali), stabili su due run; unit invariati (14 in scene-mutations, resto uguale). Se il drag test è instabile per il timing dei pointer event, aumenta gli `steps` del mouse.move e/o aggiungi una breve attesa dopo `mouse.up` prima di misurare `boundingBox`. Documenta ogni aggiustamento. Se il browser non è installabile, segnala BLOCKED lasciando committati spec/fixture.

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test: E2E drag quota, cambio foto, ricerca per nome"
```

---

## Criteri di completamento Fase 3c

- `npm run dev` → `/studio`: le frecce di quotatura si trascinano con maniglie, l'anteprima si aggiorna live e l'export riflette le nuove posizioni.
- Il cambio foto (tra le immagini del feed) aggiorna l'anteprima e l'export.
- La ricerca per nome trova un prodotto e lo carica come "Proponi".
- Parità anteprima/export mantenuta; mutazioni pure (unit 14/14 in scene-mutations); boundary client/server intatto (download/cache/searchProducts solo in server action).
- `npm test` verde; `npm run e2e` verde offline (7 test, stabile su due run).

## Note per la Fase 3d (libreria icone — Spec §7)

- **Icon picker** (sostituisci icona su una feature): UI che chiama `searchIconify`+`fetchIconifySvg` (Fase 2) e `listIcons` (locali); alla scelta, `saveIcon` come `in-revisione` e aggiornamento di `iconMap` client (round-trip che ritorna l'inner-SVG normalizzato).
- **Regola "icona marcata"**: in editor le icone `in-revisione` vanno mostrate ma marcate (es. anello/bordo); l'export segnala o blocca se restano icone non approvate. Richiede che il render-bundle distingua approvate vs in-revisione (oggi `getApprovedIcon` filtra: servirà un percorso che porti anche le in-revisione all'editor con un flag, senza rompere la regola d'oro sull'export).
- **Griglia di approvazione** (`/icone`): `listIcons`/`approveIcon` + seeding di massa via `searchIconify` — approvazione in blocco (Spec §7 seeding).
- **Cosmetici ancora aperti**: `imageDataUri` per-hash (multi-foto), template `griglia-sotto`/`multi-prodotto`, dark-mode contrast, E2E su `next build && start`.
