# SVG Studio — Crop/bbox automatico al cambio foto + forza Vision — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Al cambio foto nell'editor, ritagliare la nuova immagine sul bbox del prodotto (pipeline
`resolveBBox`: scansione pixel, fallback Gemini Vision, cache) e ricalcolare le frecce-quota sulla nuova
estensione — invece dell'attuale semplice adattamento senza crop. In più, un pulsante "Ricalcola
ritaglio con Vision" che **forza** la chiamata Vision sulla foto corrente (bypassando gate angoli e cache
in lettura). Spec: `2026-07-13-svg-studio-crop-cambio-foto-design.md`.

**Architecture:** La logica nuova vive in tre punti, tutti **fuori** dal percorso golden di composizione:
(1) `resolveBBox` guadagna un flag additivo `forzaVision`; (2) la mutazione `imposta-foto` si estende per
portare la nuova geometria foto + quote (pura, deterministica); (3) la server action `cambiaFotoAction`
si parametrizza (`opts.forzaVision`) e ritorna la geometria calcolata ri-derivando i numeri con
`parseDimensions(product.notaTecnica)` — nessuna modifica allo schema scena né a `SCENE_VERSION`.
`compose-lib.ts`/`composeColonnaSinistra`/`renderScene` **non cambiano** (golden intatti). Unica modifica
a `colonna-sinistra.ts`: esportare `FOTO_BOX`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Prisma/SQLite, `sharp` (`extract`),
`@google/genai` (solo default reali di `resolveBBox`). Node 20+, npm, alias `@/* → src/*`,
`.gitattributes` LF. Riusa immutati Fasi 1/2/3, i lotti dizionario e la feature Vision bbox appena chiusa.

## Global Constraints

- **Nessuna modifica allo schema scena**: `src/lib/scene/types.ts` (tipo `Scene`, `SceneElement`,
  `SCENE_VERSION`) e `src/lib/scene/schema.ts` (zod) **invariati**. I numeri dimensione si ri-derivano
  da `parseDimensions`, non si salvano nella scena. Le scene già in DB restano valide.
- **Golden determinismo intatto**: `compose-lib.ts`, `composeColonnaSinistra`, `renderScene` non
  cambiano → `tests/render-svg.test.ts`, `tests/layout-colonna-sinistra.test.ts` byte-identici;
  `tests/compose-e2e.test.ts` verde e offline. Verificarli, non rigenerarli.
- **`resolveBBox` retrocompatibile**: `forzaVision` è opzionale (default `false`). `compose-lib.ts` (che
  non lo passa) mantiene comportamento identico. Tutti i test esistenti di `resolveBBox` restano verdi.
- **`imposta-foto` retrocompatibile**: i campi `foto`/`quote` sono opzionali; l'azione con solo
  `imageHash` si comporta come oggi (i 2 test esistenti in `scene-mutations.test.ts` restano verdi).
- **`applyMutation` puro e deterministico**: nessuna I/O, nessun `parseDimensions` dentro il reducer (la
  geometria arriva già calcolata dalla server action). Non muta l'input.
- **Degrado, non blocco**: ogni errore Vision/cache ⇒ immagine intera; la server action non lancia per
  errori Vision (solo per SKU/URL non validi, come oggi). Il pulsante forza-Vision mostra avvisi non
  bloccanti.
- **Ri-derivazione numeri da `parseDimensions(product.notaTecnica)`**: stessa fonte del primo compose;
  la server action ha `product` in scope.
- **URL foto corrente tracciato dal client** (non letto dalla scena): stato `fotoUrlCorrente` in
  `StudioClient`.
- **Nessun batch runner** (fuori scope). Feature per singolo prodotto/singola foto.
- **Tutti i test offline e deterministici**: nessuna rete, nessuna `GEMINI_API_KEY`, DB isolato o deps
  iniettate. La chiamata Vision reale vive solo nei default di produzione e nella validazione (Task 6).
- **UI/commenti/commit in italiano.**

## Modello di esecuzione per-task

Logica delicata (interazione con lavoro manuale già fatto, mutazioni scena pure, semantica cache del
forza-Vision) → **Sonnet** con giudizio esplicito sulla maggior parte dei task. Nessun task è pura
trascrizione con codice già completo e collaudato nel piano (anche gli snippet vanno adattati e testati),
quindi niente Haiku. Review per-task Sonnet. **Review finale whole-branch: Opus.**

| Task | Contenuto | Esecuzione | Review |
|---|---|---|---|
| 1 | `forzaVision` in `resolveBBox` (gate + bypass lettura cache + scrittura) + test | Sonnet (semantica cache delicata) | Sonnet |
| 2 | Estensione azione/mutazione `imposta-foto` (foto+quote, sostituzione posizionale) + test | Sonnet (mutazione pura, casi limite) | Sonnet |
| 3 | Export `FOTO_BOX` + `cambiaFotoAction` parametrizzata (crop+fit+quote+parseDimensions) | Sonnet (orchestrazione, degrado) | Sonnet |
| 4 | UI: `PhotoPicker` (pulsante forza-Vision + highlight) + `StudioClient` (stato URL, dispatch esteso) | Sonnet | Sonnet |
| 5 | Verifica determinismo (golden/e2e) + `tsc` + suite | Sonnet | Sonnet |
| 6 | Validazione end-to-end nell'editor con Vision reale (rete + `GEMINI_API_KEY`) | Sonnet (rete) | Sonnet |

Review finale whole-branch: **Opus.**

## File Structure

```
src/lib/images/
  resolve-bbox.ts         # Task 1 — + forzaVision in ResolveBBoxDeps; bypass gate + lettura cache; scrive cache
src/lib/scene/
  mutations.ts            # Task 2 — azione imposta-foto estesa (foto?, quote?) + sostituzione posizionale quote
src/lib/layout/
  colonna-sinistra.ts     # Task 3 — export FOTO_BOX (nessun'altra modifica)
src/app/
  actions.ts              # Task 3 — cambiaFotoAction(sku, url, opts?) → { imageHash, imageDataUri, foto, quote, ritagliata }
src/app/studio/
  PhotoPicker.tsx         # Task 4 — pulsante "Ricalcola con Vision" + highlight foto corrente
  StudioClient.tsx        # Task 4 — stato fotoUrlCorrente; cambiaFoto/ricalcolaConVision; dispatch esteso
tests/
  images-resolve-bbox.test.ts   # Task 1 — + test forzaVision (esistenti invariati)
  scene-mutations.test.ts       # Task 2 — + test imposta-foto esteso (2 esistenti invariati)
  render-svg.test.ts / layout-colonna-sinistra.test.ts / compose-e2e.test.ts  # Task 5 — verificati, non modificati
```

Nessun file sotto `src/lib/scene/types.ts`, `src/lib/scene/schema.ts`, `src/lib/render`, `scripts/compose-lib.ts` cambia.

---

### Task 1: Flag `forzaVision` in `resolveBBox`

Aggiunge un flag opzionale che, quando `true`, salta il gate "sfondo uniforme" e bypassa la **lettura**
cache (nuovo tentativo Vision), continuando però a **scrivere** il risultato in cache. Additivo e
retrocompatibile.

**Files:**
- Modify: `src/lib/images/resolve-bbox.ts`
- Test: `tests/images-resolve-bbox.test.ts`

**Interfaces:**
- Produces: `ResolveBBoxDeps` con nuovo campo `forzaVision?: boolean` (default `false`). Firma di
  `resolveBBox` invariata (il flag passa dentro `deps`).

- [ ] **Step 1 (test prima): aggiungi i test che falliscono**

In `tests/images-resolve-bbox.test.ts` (riusa `makeSample`/`makeAngoliDiscordi` già presenti):

```ts
it('forzaVision: chiama Vision anche su sfondo uniforme', async () => {
  let chiamate = 0
  const box = await resolveBBox(await makeSample(), 'hf1', {
    forzaVision: true,
    askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.1, y: 0.1, width: 0.5, height: 0.5 }) },
    loadCachedBBox: async () => undefined,
    saveCachedBBox: async () => {},
  })
  expect(chiamate).toBe(1)
  expect(box).toEqual({ left: 10, top: 10, width: 50, height: 50 })
})

it('forzaVision: bypassa la cache in lettura (ignora un vecchio "non trovato")', async () => {
  let chiamate = 0
  const salvati: Array<{ trovato: boolean; box: BBox | null }> = []
  const box = await resolveBBox(await makeAngoliDiscordi(), 'hf2', {
    forzaVision: true,
    loadCachedBBox: async () => ({ trovato: false, box: null }), // cache "non trovato" preesistente
    askVision: async () => { chiamate++; return JSON.stringify({ trovato: true, x: 0.2, y: 0.2, width: 0.5, height: 0.5 }) },
    saveCachedBBox: async (_h, b) => { salvati.push({ trovato: !!b, box: b }) },
  })
  expect(chiamate).toBe(1)                 // ha chiamato Vision nonostante la cache
  expect(box).toEqual({ left: 20, top: 20, width: 50, height: 50 })
  expect(salvati).toHaveLength(1)          // e ha scritto il nuovo risultato in cache
  expect(salvati[0].trovato).toBe(true)
})

it('forzaVision assente: comportamento invariato (sfondo uniforme → nessuna Vision)', async () => {
  let chiamate = 0
  await resolveBBox(await makeSample(), 'hf3', { askVision: async () => { chiamate++; return '' } })
  expect(chiamate).toBe(0)
})
```

- [ ] **Step 2: esegui (fallisce)**

Run: `npx vitest run tests/images-resolve-bbox.test.ts`
Expected: FAIL sui nuovi test `forzaVision` (il flag non è ancora gestito → su sfondo uniforme non chiama
Vision, e sul secondo test ritorna il "non trovato" cachato). Gli 8 test esistenti restano verdi.

- [ ] **Step 3: implementa `forzaVision`**

In `resolve-bbox.ts`: aggiungi `forzaVision?: boolean` a `ResolveBBoxDeps`. Nel corpo, calcola
`const forza = deps.forzaVision ?? false` e modifica due punti:

1. Gate uniforme — salta se forzato:
   ```ts
   if (!forza && scartoAngoli <= sogliaAngoli) {
     return box && bboxPlausibile(box, width, height) ? box : null
   }
   ```
2. Lettura cache — salta se forzato (mantieni intatta la gestione errori esistente):
   ```ts
   let cached: { trovato: boolean; box: BBox | null } | undefined
   if (!forza) {
     try {
       cached = await load(imageHash)
     } catch (e) {
       console.warn('[resolveBBox] lettura cache VisionBBox fallita, degrado a immagine intera:', e)
       return null
     }
     if (cached) return cached.box
   }
   ```
La chiamata Vision, il `parseVisionBBox`, e la **scrittura** cache (best-effort, già con try/catch)
restano identici → il ramo forzato scrive comunque il nuovo risultato (upsert sovrascrive).

- [ ] **Step 4: esegui (passa) + tsc**

Run: `npx vitest run tests/images-resolve-bbox.test.ts && npx tsc --noEmit`
Expected: PASS (11 test: 8 esistenti + 3 nuovi), `tsc` pulito.

- [ ] **Step 5: suite + commit**

```bash
npm test
git add src/lib/images/resolve-bbox.ts tests/images-resolve-bbox.test.ts
git commit -m "feat(images): forzaVision in resolveBBox (bypassa gate angoli e lettura cache, riscrive cache)"
```
Expected: `npm test` verde (golden invariati: `resolve-bbox` non è nel percorso di compose golden).

---

### Task 2: Estensione della mutazione `imposta-foto`

L'azione `imposta-foto` porta ora anche la nuova geometria foto e le nuove quote (opzionali). La
mutazione aggiorna la foto e **sostituisce posizionalmente** le quote (id/ordine preservati), lasciando
intatti icone/badge/testo. Pura e deterministica.

**Files:**
- Modify: `src/lib/scene/mutations.ts`
- Test: `tests/scene-mutations.test.ts`

**Interfaces:**
- Produces: tipo `SceneAction` con `imposta-foto` esteso:
  ```ts
  | { type: 'imposta-foto'; imageHash: string
      foto?: { x: number; y: number; width: number; height: number }
      quote?: { orientamento: 'verticale'|'orizzontale'|'diagonale'; valore: string; x1: number; y1: number; x2: number; y2: number }[] }
  ```

- [ ] **Step 1 (test prima): aggiungi i test che falliscono**

Nel blocco `describe('imposta-foto', …)` di `tests/scene-mutations.test.ts`, usando `scenaConQuota()`
(che ha `foto id:'ph'` + `quota id:'q0'`):

```ts
it('con foto+quote: aggiorna geometria foto e sostituisce le quote (id e ordine preservati)', () => {
  const s = applyMutation(scenaConQuota(), {
    type: 'imposta-foto',
    imageHash: 'crop-hash',
    foto: { x: 500, y: 120, width: 300, height: 700 },
    quote: [{ orientamento: 'verticale', valore: '90 cm', x1: 810, y1: 120, x2: 810, y2: 820 }],
  })
  const f = foto(s)
  expect(f.imageHash).toBe('crop-hash')
  expect({ x: f.x, y: f.y, width: f.width, height: f.height }).toEqual({ x: 500, y: 120, width: 300, height: 700 })
  const q = quota(s)
  expect(q.id).toBe('q0')            // id preservato
  expect(q.valore).toBe('90 cm')
  expect(q.x1).toBe(810)
})

it('con più quote nuove che esistenti: appende con id progressivi', () => {
  const s = applyMutation(scenaConQuota(), {
    type: 'imposta-foto', imageHash: 'h',
    quote: [
      { orientamento: 'verticale', valore: 'A', x1: 1, y1: 2, x2: 3, y2: 4 },
      { orientamento: 'orizzontale', valore: 'B', x1: 5, y1: 6, x2: 7, y2: 8 },
    ],
  })
  const q = s.elements.filter((e) => e.type === 'quota')
  expect(q.map((e) => e.id)).toEqual(['q0', 'q1'])
  expect(q[1].valore).toBe('B')
})

it('con meno quote nuove che esistenti: rimuove quelle in eccesso', () => {
  const due = scenaConQuota()
  due.elements.push({ type: 'quota', id: 'q1', orientamento: 'orizzontale', valore: 'x', x1: 0, y1: 0, x2: 1, y2: 1 })
  const s = applyMutation(due, { type: 'imposta-foto', imageHash: 'h', quote: [
    { orientamento: 'verticale', valore: 'solo', x1: 1, y1: 1, x2: 1, y2: 2 },
  ] })
  expect(s.elements.filter((e) => e.type === 'quota').map((e) => e.id)).toEqual(['q0'])
})

it('non tocca icone/badge/testo', () => {
  const base = scenaConQuota()
  base.elements.push({ type: 'badge', id: 'bg0', testo: '120 KG', x: 500, y: 900 })
  const s = applyMutation(base, {
    type: 'imposta-foto', imageHash: 'h',
    foto: { x: 1, y: 1, width: 1, height: 1 }, quote: [],
  })
  expect(s.elements.filter((e) => e.type === 'icona-label').map((e) => e.id)).toEqual(['f0', 'f1'])
  expect(s.elements.find((e) => e.id === 'bg0')).toBeTruthy()
})

it('è pura: non muta la scena in ingresso', () => {
  const orig = scenaConQuota()
  const copia = JSON.parse(JSON.stringify(orig))
  applyMutation(orig, { type: 'imposta-foto', imageHash: 'h', foto: { x: 1, y: 1, width: 1, height: 1 }, quote: [] })
  expect(orig).toEqual(copia)
})
```

I 2 test esistenti (`cambia l'imageHash`, `no-op se non c'è foto`) devono restare verdi (retrocompat).

- [ ] **Step 2: esegui (fallisce)**

Run: `npx vitest run tests/scene-mutations.test.ts`
Expected: FAIL sui nuovi test (foto/quote non ancora gestite), i 2 esistenti + gli altri verdi.

- [ ] **Step 3: implementa la mutazione estesa**

In `mutations.ts` aggiorna il tipo `SceneAction` (campo `imposta-foto`, vedi Interfaces) e il case:

```ts
case 'imposta-foto': {
  const nuoveQuote = action.quote
  let qi = 0
  const elements: SceneElement[] = []
  for (const el of scene.elements) {
    if (el.type === 'foto') {
      elements.push(
        action.foto
          ? { ...el, imageHash: action.imageHash, x: action.foto.x, y: action.foto.y, width: action.foto.width, height: action.foto.height }
          : { ...el, imageHash: action.imageHash },
      )
    } else if (el.type === 'quota' && nuoveQuote) {
      // sostituzione posizionale: preserva id e ordine; scarta le quote in eccesso
      if (qi < nuoveQuote.length) {
        elements.push({ ...el, ...nuoveQuote[qi] })
        qi++
      }
      // se qi >= nuoveQuote.length: quota in eccesso → non ripushata (rimossa)
    } else {
      elements.push(el)
    }
  }
  // quote nuove oltre quelle esistenti → append con id progressivi
  if (nuoveQuote) {
    for (; qi < nuoveQuote.length; qi++) {
      elements.push({ type: 'quota', id: `q${qi}`, ...nuoveQuote[qi] })
    }
  }
  return { ...scene, elements }
}
```

Nota Sonnet: se `quote` è `undefined`, le quote esistenti non vengono toccate (retrocompat); se `foto` è
`undefined`, si aggiorna solo `imageHash`. L'append usa `q${qi}` per coerenza con `composeColonnaSinistra`.

- [ ] **Step 4: esegui (passa) + tsc**

Run: `npx vitest run tests/scene-mutations.test.ts && npx tsc --noEmit`
Expected: PASS (tutti, inclusi i 2 esistenti), `tsc` pulito.

- [ ] **Step 5: commit**

```bash
git add src/lib/scene/mutations.ts tests/scene-mutations.test.ts
git commit -m "feat(scene): imposta-foto porta geometria foto e quote (sostituzione posizionale, pura)"
```

---

### Task 3: `cambiaFotoAction` parametrizzata (crop + fit + quote)

La server action replica il tratto "foto" del primo compose (cache → `resolveBBox` → crop → `fitFoto` +
`quoteFromBBox`) e ritorna la geometria calcolata, ri-derivando i numeri con `parseDimensions`. Accetta
`opts.forzaVision`. `compose-lib.ts` **non cambia**.

**Files:**
- Modify: `src/lib/layout/colonna-sinistra.ts` (export `FOTO_BOX`)
- Modify: `src/app/actions.ts` (`cambiaFotoAction`)

**Interfaces:**
- Produces: `cambiaFotoAction(sku: string, url: string, opts?: { forzaVision?: boolean }) =>
  Promise<{ imageHash: string; imageDataUri: string; foto: {x,y,width,height}; quote: QuotaSpec[]; ritagliata: boolean }>`.
- Consumes: `resolveBBox` (`@/lib/images/resolve-bbox`), `fitFoto`, `quoteFromBBox`, `QuotaSpec`
  (`@/lib/layout/engine`), `FOTO_BOX` (`@/lib/layout/colonna-sinistra`), `parseDimensions`
  (`@/lib/extraction/dimensions`), `cacheImage`/`readCachedImage`/`writeImageBytes` (`@/lib/images/cache`),
  `extToMime` (`@/lib/ui/mime`), `sharp`.

- [ ] **Step 1: esporta `FOTO_BOX`**

In `src/lib/layout/colonna-sinistra.ts`: cambia `const FOTO_BOX = {…}` in `export const FOTO_BOX = {…}`.
Nessun'altra modifica (il valore e l'uso interno restano identici → golden invariato).

- [ ] **Step 2: riscrivi `cambiaFotoAction`**

In `src/app/actions.ts`, sostituisci l'attuale `cambiaFotoAction` (che ritornava solo l'immagine intera)
con la versione che ritaglia e calcola la geometria:

```ts
import { resolveBBox } from '@/lib/images/resolve-bbox'
import { fitFoto, quoteFromBBox, type QuotaSpec } from '@/lib/layout/engine'
import { FOTO_BOX } from '@/lib/layout/colonna-sinistra'
import { parseDimensions } from '@/lib/extraction/dimensions'
import { writeImageBytes } from '@/lib/images/cache' // aggiungi all'import esistente di cache

export async function cambiaFotoAction(
  sku: string,
  url: string,
  opts?: { forzaVision?: boolean },
): Promise<{ imageHash: string; imageDataUri: string; foto: { x: number; y: number; width: number; height: number }; quote: QuotaSpec[]; ritagliata: boolean }> {
  const product = await getProduct((sku ?? '').trim())
  if (!product) throw new Error('Prodotto non trovato')
  if (!product.images.includes(url)) throw new Error('URL immagine non appartenente al prodotto')

  const deps = isFake() ? { download: fakeDownload() } : undefined
  const cached = await cacheImage(url, deps)
  const bytes = readCachedImage(cached.hash, cached.ext)
  const mime = extToMime(cached.ext)
  const box = await resolveBBox(bytes, cached.hash, { ...deps, mime, forzaVision: opts?.forzaVision })

  let imageHash = cached.hash
  let bytesUsati = bytes
  let bbox: { width: number; height: number } | null = null
  if (box) {
    const cropped = await sharp(bytes)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .png()
      .toBuffer()
    imageHash = writeImageBytes(cropped, deps?.dir).hash
    bytesUsati = cropped
    bbox = { width: box.width, height: box.height }
  }

  const fitted = fitFoto(bbox ?? { width: FOTO_BOX.width, height: FOTO_BOX.height }, FOTO_BOX)
  const dim = parseDimensions(product.notaTecnica)
  const quote = dim ? quoteFromBBox(fitted, dim) : []
  const extUsato = box ? 'png' : cached.ext
  const imageDataUri = `data:${extToMime(extUsato)};base64,${bytesUsati.toString('base64')}`

  return { imageHash, imageDataUri, foto: fitted, quote, ritagliata: box !== null }
}
```

Note Sonnet:
- La logica di crop è identica a `compose-lib.ts` per parità visiva col primo compose, ma
  `compose-lib.ts` **non viene toccato** (duplicazione intenzionale, ~10 righe, per non entrare nel
  percorso golden). Se il reviewer preferisce, si può estrarre un helper condiviso **behavior-preserving**
  coperto da `compose-e2e`, ma NON è richiesto e va evitato se aumenta il rischio sul golden.
- `writeImageBytes` deduce `ext` dai magic byte del cropped (`png`), quindi `extUsato='png'` sul ramo
  ritagliato; sul ramo intero si usa `cached.ext`.
- In fake/offline `resolveBBox` degrada senza rete (ramo uniforme o errore Vision → immagine intera).

- [ ] **Step 3: tsc + suite**

Run: `npx tsc --noEmit && npm test`
Expected: pulito e verde. Golden invariati (nessun tocco a render/scena/compose-lib;
`export const FOTO_BOX` non cambia il valore). Se `tsc` segnala l'import inutilizzato di `detectBBox`
altrove, non ce n'è: `cambiaFotoAction` non usava `detectBBox`.

- [ ] **Step 4: commit**

```bash
git add src/lib/layout/colonna-sinistra.ts src/app/actions.ts
git commit -m "feat(editor): cambiaFotoAction ritaglia sul bbox e ricalcola le quote (parseDimensions), con opts.forzaVision"
```

---

### Task 4: UI — pulsante "Ricalcola con Vision" e dispatch esteso

Collega il crop automatico al cambio foto e aggiunge il pulsante forza-Vision. Traccia l'URL della foto
corrente lato client.

**Files:**
- Modify: `src/app/studio/PhotoPicker.tsx`
- Modify: `src/app/studio/StudioClient.tsx`

**Interfaces:**
- `PhotoPicker` nuove prop: `urlCorrente: string`, `onRicalcola: () => void` (oltre a `immagini`,
  `onScegli`).
- `StudioClient`: nuovo stato `fotoUrlCorrente: string`; funzioni `cambiaFoto(url)` (aggiornata) e
  `ricalcolaConVision()`.

- [ ] **Step 1: `PhotoPicker` — highlight + pulsante**

Aggiungi `urlCorrente` e `onRicalcola` alle prop. Evidenzia la thumbnail il cui `url === urlCorrente`
(es. `border-emerald-600`), e sotto la griglia un pulsante:

```tsx
<button
  type="button"
  onClick={onRicalcola}
  className="mt-2 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-emerald-600"
>
  Ricalcola ritaglio con Vision
</button>
<p className="mt-1 text-xs text-zinc-500">Rifà il rilevamento del prodotto con l'AI di visione, anche su sfondo uniforme.</p>
```

Nota: `PhotoPicker` oggi ritorna `null` se `immagini.length <= 1`. Con una sola foto il cambio-foto non
serve, ma il **forza-Vision sì**. Decidi (giudizio Sonnet): mostra comunque il pulsante forza-Vision
quando c'è ≥1 foto (rendi la griglia condizionale a `>1`, il pulsante a `>=1`). Documenta la scelta nel
commit.

- [ ] **Step 2: `StudioClient` — stato URL e funzioni**

- Aggiungi `const [fotoUrlCorrente, setFotoUrlCorrente] = useState<string>('')`.
- In `proponiSku` (dopo il successo) e in `riprendi`: `setFotoUrlCorrente(r.immagini?.[0] ?? '')`
  (per `riprendi`, `immagini` non è nel ritorno di `loadSceneAction` — usa `bundle?.immagini?.[0]` o il
  primo elemento disponibile; se non disponibile lascia stringa vuota e disabilita il forza-Vision).
- `cambiaFoto(url)` aggiornata:
  ```ts
  function cambiaFoto(url: string) {
    if (!prodotto) return
    start(async () => {
      try {
        const r = await cambiaFotoAction(prodotto.sku, url)
        dispatch({ type: 'imposta-foto', imageHash: r.imageHash, foto: r.foto, quote: r.quote })
        setBundle((b) => (b ? { ...b, imageDataUri: r.imageDataUri } : b))
        setFotoUrlCorrente(url)
        if (!r.ritagliata) setMsg('Bbox non rilevato: uso l\'immagine intera (quote da sistemare a mano).')
      } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore cambio foto') }
    })
  }
  ```
- `ricalcolaConVision()`:
  ```ts
  function ricalcolaConVision() {
    if (!prodotto || !fotoUrlCorrente) return
    setErrore(null); setMsg(null)
    start(async () => {
      try {
        const r = await cambiaFotoAction(prodotto.sku, fotoUrlCorrente, { forzaVision: true })
        dispatch({ type: 'imposta-foto', imageHash: r.imageHash, foto: r.foto, quote: r.quote })
        setBundle((b) => (b ? { ...b, imageDataUri: r.imageDataUri } : b))
        setMsg(r.ritagliata ? 'Ritaglio ricalcolato con Vision.' : 'Vision non ha rilevato un prodotto: uso l\'immagine intera.')
      } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore Vision') }
    })
  }
  ```
- Passa le prop a `PhotoPicker`:
  ```tsx
  <PhotoPicker immagini={bundle.immagini} urlCorrente={fotoUrlCorrente} onScegli={cambiaFoto} onRicalcola={ricalcolaConVision} />
  ```

- [ ] **Step 3: tsc + build + verifica manuale offline**

Run: `npx tsc --noEmit && npm test`
Poi (offline, modalità fake se disponibile) avvia il dev server manualmente **solo se richiesto**
dall'esecutore (non automatizzare qui): cambia foto e verifica che l'anteprima si aggiorni con crop e
quote; il pulsante "Ricalcola con Vision" in fake degrada all'immagine intera con messaggio non
bloccante. La verifica con Vision reale è nel Task 6.

- [ ] **Step 4: commit**

```bash
git add src/app/studio/PhotoPicker.tsx src/app/studio/StudioClient.tsx
git commit -m "feat(editor): crop automatico al cambio foto + pulsante Ricalcola con Vision (dispatch esteso)"
```

---

### Task 5: Verifica determinismo e integrazione

Conferma che i golden e l'e2e restino intatti (non erano nel percorso modificato) e che la suite completa
sia verde.

**Files:**
- Verify (no-edit): `tests/render-svg.test.ts`, `tests/layout-colonna-sinistra.test.ts`,
  `tests/compose-e2e.test.ts`, `tests/scene-schema.test.ts`.

- [ ] **Step 1: golden + e2e**

```bash
npx vitest run tests/render-svg.test.ts tests/layout-colonna-sinistra.test.ts tests/compose-e2e.test.ts tests/scene-schema.test.ts
```
Expected: tutti verdi; golden barbecue (`tests/fixtures/render-2137070.svg`) **byte-identico** (nessuna
rigenerazione). Se falliscono, NON rigenerare: indagare (non dovrebbero essere toccati —
`compose-lib`/`composeColonnaSinistra`/`renderScene`/schema invariati).

- [ ] **Step 2: suite + tsc**

```bash
npx tsc --noEmit && npm test
```
Expected: `tsc` pulito, intera suite verde.

- [ ] **Step 3: commit (se servono aggiustamenti di verifica)**

Se non servono modifiche, nessun commit. Altrimenti commit mirato con messaggio che spiega la verifica.

---

### Task 6: Validazione end-to-end nell'editor con Vision reale

Conferma sul campo il crop al cambio foto e il forza-Vision su foto lifestyle reali. **Rete +
`GEMINI_API_KEY` richieste.**

**Rete + `GEMINI_API_KEY` richieste:** se non disponibili, segnalare **BLOCKED**; i Task 1-5 restano
validi/committati e la pipeline degrada all'immagine intera senza chiave (verificabile offline).

**Files:**
- Nessuna modifica stabile. Eventuale script temporaneo `scripts/_cambiofoto-check.ts` (prefisso `_`,
  non committato).

- [ ] **Step 1: caso reale**

Su uno SKU garden/mare con foto secondarie lifestyle (riusa il campione diagnostico della spec Vision
bbox: dondolo/ombrelloni/lettini), apri l'editor, `Proponi`, poi cambia a una foto secondaria a sfondo
non uniforme. Verifica: il prodotto è ritagliato (non amputato) e le quote combaciano; oppure immagine
intera con messaggio non bloccante — mai un crop sbagliato.

- [ ] **Step 2: forza-Vision su sfondo uniforme**

Su una foto a sfondo uniforme (dove il cambio normale usa la scansione pixel), premi "Ricalcola ritaglio
con Vision": verifica che parta una chiamata Vision (log/tempo), che il risultato aggiorni il crop e che
una seconda pressione **non forzata** (cambio alla stessa foto) usi la cache. Nota che il forza-Vision
bypassa la cache in lettura ma la riscrive.

- [ ] **Step 3: degrado senza chiave**

Con `GEMINI_API_KEY` assente, ripeti su foto non uniforme: il cambio-foto deve usare l'immagine intera
(nessun crash), con messaggio non bloccante.

- [ ] **Step 4: pulizia**

Rimuovi eventuale `scripts/_cambiofoto-check.ts`. Nessun commit di codice (task di validazione). Se
emergono tarature (soglie, posizionamento badge), aprire follow-up mirati con i dati raccolti.

---

## Criteri di completamento

- `resolve-bbox.ts`: `forzaVision` opzionale; su `true` salta il gate uniforme e bypassa la lettura
  cache, ma scrive il nuovo risultato; retrocompat (test esistenti verdi); 3 nuovi test verdi.
- `mutations.ts`: `imposta-foto` porta `foto?`/`quote?`; sostituzione posizionale delle quote (id/ordine
  preservati, append/trim sui casi limite); icone/badge/testo intatti; puro; retrocompat (solo-imageHash
  invariato); nuovi test verdi.
- `colonna-sinistra.ts`: `FOTO_BOX` esportato, valore invariato.
- `actions.ts`: `cambiaFotoAction(sku, url, opts?)` ritaglia sul bbox, ricalcola le quote con
  `parseDimensions(product.notaTecnica)`, ritorna `{imageHash, imageDataUri, foto, quote, ritagliata}`;
  degrada all'immagine intera in ogni errore Vision/cache; non lancia se non per SKU/URL non validi.
- UI: cambio foto applica crop+quote; pulsante "Ricalcola con Vision" forza Vision sulla foto corrente;
  URL corrente tracciato lato client; messaggi non bloccanti sul degrado.
- **Nessuna modifica** a `types.ts`/`schema.ts`; `SCENE_VERSION` invariato; scena persistita
  byte-compatibile con quelle in DB.
- **Determinismo**: `render-svg.test.ts` e `layout-colonna-sinistra.test.ts` verdi, golden barbecue
  byte-identico (nessuna rigenerazione); `compose-e2e.test.ts` verde e offline; `scene-schema.test.ts`
  verde.
- `npx tsc --noEmit` pulito e `npm test` verde sull'intero branch.
- Validazione end-to-end (Task 6) su ≥3 foto lifestyle reali + forza-Vision su sfondo uniforme
  (subordinata a `GEMINI_API_KEY` + rete; se BLOCKED, annotato — la pipeline degrada comunque senza
  chiave).

## Note per fasi successive (backlog residuo)

- Riposizionamento automatico dei **badge** al cambio-foto (oggi lasciati fermi se l'aspect ratio del
  nuovo `fitted` cambia molto — spec §3.2).
- Mutazione per **editare a mano il testo `valore`** di una quota: renderebbe `parseDimensions` non più
  autoritativa → servirebbe salvare il valore numerico nella scena (strada (b) del §3.1, con
  `SCENE_VERSION` da valutare).
- Persistenza dell'**override manuale del bbox** trascinato dall'operatore, così che un cambio-foto non
  lo resetti (già nel backlog della spec Vision bbox).
- Indicatore UI di "foto ritagliata da Vision" (badge sulla thumbnail) e feedback su costo/tempo della
  chiamata forzata.
- Estrazione (opzionale) di un helper condiviso `crop+fit` tra `compose-lib.ts` e `cambiaFotoAction`
  (behavior-preserving, coperto da `compose-e2e`) per eliminare la piccola duplicazione — solo se il
  guadagno supera il rischio sul golden.
- Backlog invariato dai lotti precedenti (spec Vision bbox §10): `promptVersion` in `VisionBBox`,
  taratura `SOGLIA_ANGOLI`/plausibilità, valutazione `gemini-2.5-flash`, template
  `griglia-sotto`/`multi-prodotto`.
- Batch senza revisione resta **fuori scope** (deciso con l'utente).
