# SVG Studio — Fase 3d — Libreria icone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere la pipeline icone (Spec §7): l'operatrice può sostituire l'icona di una feature scegliendola da Iconify (con anteprima già renderizzata nel cerchio), l'icona nuova appare **marcata come da approvare** nell'editor, e una **griglia di approvazione** `/icone` permette di approvarle in blocco. In scheda esportata vanno **solo icone approvate** — le non approvate vengono segnalate.

**Architecture:** Si estende l'editor (Fase 3b/3c) e si aggiunge una pagina `/icone`. La distinzione approvata/in-revisione è il cuore: l'**editor** vede entrambe (icona scelta subito visibile) tramite un bundle che usa `getIcon` (qualsiasi stato) e restituisce anche l'elenco delle chiavi non approvate; la **marcatura** è un overlay editor-only (come `QuotaOverlay`), non entra nell'SVG; l'**export** continua a risolvere via `getApprovedIcon` (solo approvate → segnaposto per le altre) e restituisce l'elenco delle icone non approvate presenti nella scena, così l'UI avvisa. La regola d'oro (§7: in scheda solo approvate) resta imposta a livello di rendering server, non dall'UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, @playwright/test. Riusa Fase 1/2/3a/3b/3c.

## Decisioni di scope della Fase 3d (prese dal planner)

- **In scope** (Spec §7): icon picker per-feature (Iconify, candidate renderizzate), salvataggio `in-revisione`, regola "icona marcata" in editor + avviso in export, griglia di approvazione `/icone` con approvazione in blocco e seeding di massa dal dizionario.
- **Rendering icone**: resta line-art a stroke (il renderer avvolge `<g fill="none" stroke=…>`). Il supporto a glifi fill (alcuni in `solar`) resta fuori scope; le candidate fill possono risultare vuote — l'operatrice le scarta a vista in fase di scelta/approvazione.
- **Marcatura = overlay editor-only**: non si modifica `renderScene` (Fase 2, frozen); così preview ed export condividono il renderer e la marcatura non "sporca" l'SVG.
- **Offline E2E**: Iconify va finto (`fakeSearchIconify`/`fakeFetchIconifySvg` gated da `SVG_STUDIO_FAKE`), come già feed/Gemini/immagini.

## Global Constraints

- **Regola d'oro §7 imposta dal server**: l'**export** (`renderSceneServer`→`resolveRenderBundle` con `getApprovedIcon`) usa SOLO icone `approvata`; un'icona `in-revisione` referenziata dalla scena rende il segnaposto. L'UI non può bypassarla. `exportSceneAction` restituisce le chiavi non approvate presenti nella scena per l'avviso.
- **Editor mostra le in-revisione, marcate**: il bundle dell'editor usa `getIcon` (qualsiasi stato) → l'icona scelta è subito visibile; le chiavi non approvate sono elencate e marcate da un overlay. Preview (con in-revisione) ed export (senza) DIVERGONO intenzionalmente per le icone non approvate — la marcatura + l'avviso lo comunicano.
- **Sanitizzazione/normalizzazione**: ogni icona (da Iconify) passa da `saveIcon`→`normalizeIconSvg` (viewBox 24×24, stroke currentColor, sanitizzata) prima di entrare nel DB/editor. Nessun SVG grezzo non sanitizzato reso in pagina.
- **Confine server/client**: Iconify fetch, DB (`@prisma/client`), `node:*` solo in server action; picker/overlay/griglia sono client-safe (react + tipi + azioni). `renderScene`/`theme` restano client-safe.
- **Determinismo dove applicabile**: `saveIcon` normalizza deterministicamente; l'inner-SVG mostrato nell'editor è lo stesso che l'export userebbe una volta approvata l'icona (stessa `normalizeIconSvg`, stesso `innerSvg`), quindi approvare non cambia il glifo, solo lo stato.
- **Validazione input server action**: `scegliIconaAction` accetta una `chiave` che DEVE esistere nel dizionario e un `iconifyId` in forma `set:name` sui set ammessi (`ICONIFY_SETS`); `approveIconAction` accetta una chiave stringa. Niente fetch di id arbitrari fuori dai set ammessi.
- **Riuso immutato**: `searchIconify`/`fetchIconifySvg` (Fase 2), `saveIcon`/`approveIcon`/`getIcon`/`getApprovedIcon`/`listIcons` (Fase 2), `normalizeIconSvg`, `resolveRenderBundle`/`renderSceneServer`, `loadDictionary`. Estendere `bundle.ts` (`innerSvg` export + `resolveEditorIcons`), `actions.ts`, `ui/types.ts`, l'UI. NON modificare `renderScene`, `scene/*`, il motore Fase 1/2. Se un adattamento sembra indispensabile, fermarsi e segnalarlo.
- **Next.js 16**: server action = modulo `'use server'` con solo funzioni async; tipi in `ui/types.ts`. Nuova pagina `/icone` (server component che monta un client). Consultare `node_modules/next/dist/docs/01-app/` prima di toccare App-Router.
- **Node 20+, npm.** Alias `@/* → src/*`. UI/commenti italiano. Commit italiani. `.gitattributes` LF/binary invariato.

## File Structure

```
src/
  lib/
    render/
      bundle.ts            # Task 1 — export innerSvg; +resolveEditorIcons (approvate+in-revisione, +inRevisione[])
    testing/
      fake.ts              # Task 2 — +fakeSearchIconify, +fakeFetchIconifySvg (gated SVG_STUDIO_FAKE)
    ui/
      types.ts             # Task 2 — ProposeResult += iconeNonApprovate; +tipi picker se servono
      IconMarkOverlay.tsx   # Task 4 — badge "da approvare" sulle icone in-revisione (client)
  app/
    actions.ts             # Task 2 — cercaIconeAction, scegliIconaAction, approveIconAction, seedIconeAction;
                           #          proposeSceneAction/loadSceneAction usano resolveEditorIcons + iconeNonApprovate;
                           #          exportSceneAction ritorna iconeNonApprovate
    studio/
      IconPicker.tsx       # Task 3 — modale scelta icona da Iconify (client)
      FeaturePanel.tsx     # Task 3 — +pulsante "cambia icona" per feature
      StudioClient.tsx     # Task 3/4 — wire picker, iconeNonApprovate, avviso export
    icone/
      page.tsx             # Task 5 — server component
      IconeClient.tsx      # Task 5 — griglia approvazione (client)
tests/
  render-bundle.test.ts    # Task 1 — +test resolveEditorIcons
e2e/
  seed.ts                  # Task 6 — eventuale seed icona in-revisione per il test approvazione
  icone.spec.ts            # Task 6 — E2E picker→marcata→approva→export
```

---

### Task 1: Bundle per l'editor (approvate + in-revisione, con elenco non approvate)

**Files:**
- Modify: `src/lib/render/bundle.ts` (esporta `innerSvg`; aggiunge `resolveEditorIcons`)
- Test: `tests/render-bundle.test.ts`

**Interfaces:**
- Consumes: `getIcon` da `@/lib/icons/repository` (ritorna il record con `status`, qualsiasi stato).
- Produces:
  - `export function innerSvg(svg: string): string` — rendi PUBBLICA la helper esistente (serve alle action del picker).
  - `resolveEditorIcons(chiavi: string[], deps?: { getIcon?: (k: string) => Promise<{ svg: string; status: 'approvata' | 'in-revisione' } | null> }): Promise<{ iconMap: Record<string, string>; inRevisione: string[] }>` — per ogni chiave con un'icona salvata (QUALSIASI stato) mette l'inner-SVG in `iconMap`; le chiavi con icona `in-revisione` finiscono in `inRevisione`. Le chiavi senza icona non entrano né in map né in lista.

- [ ] **Step 1: Rendi pubblica `innerSvg` + aggiungi il test (fallisce)**

In `src/lib/render/bundle.ts` cambia `function innerSvg` in `export function innerSvg` (nessun'altra modifica alla funzione).

Aggiungi a `tests/render-bundle.test.ts`:

```ts
describe('resolveEditorIcons', () => {
  const getIcon = async (k: string) => {
    if (k === 'appr') return { svg: '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>', status: 'approvata' as const }
    if (k === 'rev') return { svg: '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>', status: 'in-revisione' as const }
    return null
  }

  it('include approvate e in-revisione nella iconMap, elenca solo le in-revisione', async () => {
    const { resolveEditorIcons } = await import('@/lib/render/bundle')
    const r = await resolveEditorIcons(['appr', 'rev', 'assente'], { getIcon })
    expect(Object.keys(r.iconMap).sort()).toEqual(['appr', 'rev'])
    expect(r.iconMap.appr).toContain('M1 1')
    expect(r.iconMap.rev).toContain('M2 2')
    expect(r.iconMap.appr).not.toMatch(/<svg/i) // inner
    expect(r.inRevisione).toEqual(['rev'])
  })

  it('chiave senza icona non entra né in map né in inRevisione', async () => {
    const { resolveEditorIcons } = await import('@/lib/render/bundle')
    const r = await resolveEditorIcons(['assente'], { getIcon })
    expect(r.iconMap).toEqual({})
    expect(r.inRevisione).toEqual([])
  })
})
```

- [ ] **Step 2: Esegui (fallisce)**

Run: `npx vitest run tests/render-bundle.test.ts`
Expected: FAIL sul nuovo describe (funzione assente).

- [ ] **Step 3: Implementa `resolveEditorIcons`**

Aggiungi in `src/lib/render/bundle.ts` (dopo `resolveIconsForKeys`), importando `getIcon`:

```ts
import { getApprovedIcon, getIcon } from '@/lib/icons/repository'
```

```ts
/** Bundle per l'EDITOR: include icone approvate E in-revisione (l'icona scelta è subito visibile),
 *  e restituisce l'elenco delle chiavi non approvate (per la marcatura). L'export usa comunque
 *  solo le approvate (getApprovedIcon in resolveRenderBundle) — regola d'oro §7. */
export async function resolveEditorIcons(
  chiavi: string[],
  deps: { getIcon?: (k: string) => Promise<{ svg: string; status: 'approvata' | 'in-revisione' } | null> } = {},
): Promise<{ iconMap: Record<string, string>; inRevisione: string[] }> {
  const get = deps.getIcon ?? ((k: string) => getIcon(k))
  const iconMap: Record<string, string> = {}
  const inRevisione: string[] = []
  for (const k of chiavi) {
    if (k in iconMap) continue
    const rec = await get(k)
    if (!rec) continue
    iconMap[k] = innerSvg(rec.svg)
    if (rec.status === 'in-revisione') inRevisione.push(k)
  }
  return { iconMap, inRevisione }
}
```

(Nota: `getIcon` da repository ritorna `IconRecord | null` che ha `svg` e `status` — compatibile col tipo di `deps.getIcon`.)

- [ ] **Step 4: Esegui (passa)**

Run: `npx vitest run tests/render-bundle.test.ts`
Expected: PASS (test esistenti + 2 nuovi).

- [ ] **Step 5: Suite completa + commit**

```bash
npm test
git add src/lib/render/bundle.ts tests/render-bundle.test.ts
git commit -m "feat: resolveEditorIcons (approvate+in-revisione, elenco non approvate) + innerSvg pubblica"
```

---

### Task 2: Server actions icone + integrazione propose/export

**Files:**
- Modify: `src/lib/testing/fake.ts` (fake Iconify), `src/lib/ui/types.ts` (ProposeResult += `iconeNonApprovate`), `src/app/actions.ts`
- Test: (nessun unit dedicato — le action sono coperte dall'E2E; verifica tsc+build)

**Interfaces:**
- Produces:
  - In `fake.ts`: `fakeSearchIconify(): (q) => Promise<IconifyCandidate[]>` (ritorna 1-2 candidate canned, es. `tabler:star`) e `fakeFetchIconifySvg(): (id) => Promise<string>` (SVG line-art canned) — gated da `isFake()`.
  - `ProposeResult.iconeNonApprovate: string[]`.
  - `cercaIconeAction(q: string): Promise<{ id: string; innerSvg: string }[]>` — searchIconify (o fake) → per le prime ~12 candidate, fetchIconifySvg + normalizeIconSvg + innerSvg → candidate renderizzabili nel cerchio.
  - `scegliIconaAction(chiave: string, iconifyId: string): Promise<{ innerSvg: string }>` — valida chiave∈dizionario e iconifyId `set:name` sui set ammessi; fetchIconifySvg (o fake) → `saveIcon({key:chiave, rawSvg, source:'iconify:'+set, license:'iconify-permissive'})` (in-revisione) → ritorna l'inner-SVG normalizzato.
  - `approveIconAction(chiave: string): Promise<void>` — `approveIcon`.
  - `seedIconeAction(): Promise<{ create: number; salta: number }>` — per ogni chiave del dizionario priva di icona, cerca su Iconify e salva la 1ª candidata in-revisione (versione UI del CLI seed di Fase 2).
  - `proposeSceneAction`/`loadSceneAction`: usano `resolveEditorIcons` per l'iconMap (invece di getApprovedIcon-only) e ritornano `iconeNonApprovate` (le chiavi della scena che sono in-revisione).
  - `exportSceneAction`: ritorna anche `iconeNonApprovate: string[]` (chiavi icona-label della scena NON approvate).

- [ ] **Step 1: Fake Iconify**

In `src/lib/testing/fake.ts` aggiungi (import `IconifyCandidate` da `@/lib/icons/iconify`):

```ts
export function fakeSearchIconify(): (q: string) => Promise<import('@/lib/icons/iconify').IconifyCandidate[]> {
  return async () => [{ id: 'tabler:star', set: 'tabler', name: 'star' }]
}
export function fakeFetchIconifySvg(): (id: string) => Promise<string> {
  return async () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>'
}
```

- [ ] **Step 2: ProposeResult += iconeNonApprovate**

In `src/lib/ui/types.ts` aggiungi `iconeNonApprovate: string[]`.

- [ ] **Step 3: Le server action**

In `src/app/actions.ts`:
- Import: `searchIconify, fetchIconifySvg, ICONIFY_SETS` da `@/lib/icons/iconify`; `saveIcon, approveIcon, getIcon` da `@/lib/icons/repository`; `resolveEditorIcons, innerSvg` da `@/lib/render/bundle`; `normalizeIconSvg` da `@/lib/icons/normalize`; `fakeSearchIconify, fakeFetchIconifySvg` da `@/lib/testing/fake`.

Aggiungi le action:

```ts
export async function cercaIconeAction(q: string): Promise<{ id: string; innerSvg: string }[]> {
  const s = (q ?? '').trim()
  if (s.length < 2) return []
  const search = isFake() ? { fetchJson: undefined } : {}
  const candidati = isFake() ? await fakeSearchIconify()(s) : await searchIconify(s, search)
  const fetchSvg = isFake() ? fakeFetchIconifySvg() : (id: string) => fetchIconifySvg(id)
  const out: { id: string; innerSvg: string }[] = []
  for (const c of candidati.slice(0, 12)) {
    try {
      const raw = await fetchSvg(c.id)
      out.push({ id: c.id, innerSvg: innerSvg(normalizeIconSvg(raw)) })
    } catch {
      // salta le candidate non scaricabili
    }
  }
  return out
}

export async function scegliIconaAction(chiave: string, iconifyId: string): Promise<{ innerSvg: string }> {
  const dict = loadDictionary()
  if (!(chiave in dict.features)) throw new Error('Chiave non nel dizionario')
  const [set, name] = iconifyId.split(':')
  if (!name || !(ICONIFY_SETS as readonly string[]).includes(set)) throw new Error('Id icona non valido')
  const raw = isFake() ? await fakeFetchIconifySvg()(iconifyId) : await fetchIconifySvg(iconifyId)
  const rec = await saveIcon({ key: chiave, rawSvg: raw, source: `iconify:${set}`, license: 'iconify-permissive' })
  return { innerSvg: innerSvg(rec.svg) }
}

export async function approveIconAction(chiave: string): Promise<void> {
  await approveIcon(chiave)
}

export async function seedIconeAction(): Promise<{ create: number; salta: number }> {
  const dict = loadDictionary()
  let create = 0
  let salta = 0
  for (const chiave of Object.keys(dict.features)) {
    if (await getIcon(chiave)) { salta++; continue }
    try {
      const cand = isFake() ? await fakeSearchIconify()(chiave) : await searchIconify(chiave.replace(/_/g, ' '))
      const id = dict.features[chiave].icona.includes(':') ? dict.features[chiave].icona : cand[0]?.id
      if (!id) { continue }
      const raw = isFake() ? await fakeFetchIconifySvg()(id) : await fetchIconifySvg(id)
      await saveIcon({ key: chiave, rawSvg: raw, source: `iconify:${id.split(':')[0]}`, license: 'iconify-permissive' })
      create++
    } catch {
      // salta la chiave in errore
    }
  }
  return { create, salta }
}
```

Poi, in `proposeSceneAction`, sostituisci il blocco che costruisce `iconMap` (attualmente `resolveRenderBundle` + `resolveIconsForKeys` con getApprovedIcon) con la versione editor:

```ts
  const bundle = await resolveRenderBundle(scene) // resta per imageDataUri
  const editor = await resolveEditorIcons(applicabili.map((f) => f.chiave).concat(
    scene.elements.filter((e) => e.type === 'icona-label').map((e) => (e as { chiave: string }).chiave),
  ))
  const iconMap = editor.iconMap
```

e nel return aggiungi `iconeNonApprovate: editor.inRevisione,` e usa `imageDataUri: bundle.imageDataUri`. (Rimuovi `resolveIconsForKeys` da questo percorso se non più usato — resta usato da `loadSceneAction` finché non lo aggiorni allo stesso modo.)

In `loadSceneAction`, analogamente usa `resolveEditorIcons(Object.keys(dict.features))` per l'iconMap e restituisci anche `iconeNonApprovate` (aggiorna il tipo di ritorno per includerlo, oppure lascia che il client lo ricalcoli — MINIMO: aggiungi `iconeNonApprovate` al ritorno di loadSceneAction).

In `exportSceneAction`, prima del return calcola le chiavi non approvate presenti nella scena e restituiscile:

```ts
  const chiaviScena = [...new Set(scene.elements.filter((e) => e.type === 'icona-label').map((e) => (e as { chiave: string }).chiave))]
  const approvate = await resolveIconsForKeys(chiaviScena) // getApprovedIcon-based
  const iconeNonApprovate = chiaviScena.filter((k) => !(k in approvate))
```

e ritorna `{ path, thumbDataUri, iconeNonApprovate }` (aggiorna la firma).

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti/verdi. `actions.ts` esporta solo funzioni async. Suite invariata sui unit (le nuove action sono coperte dall'E2E Task 6; il nuovo test è in Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/testing/fake.ts src/lib/ui/types.ts src/app/actions.ts
git commit -m "feat: server action icone (cerca/scegli/approva/seed) + iconeNonApprovate in propose/export"
```

---

### Task 3: Icon picker per-feature

**Files:**
- Create: `src/app/studio/IconPicker.tsx`
- Modify: `src/app/studio/FeaturePanel.tsx` (pulsante "cambia icona"), `src/app/studio/StudioClient.tsx` (wire)

**Interfaces:**
- Consumes: `cercaIconeAction`/`scegliIconaAction` (Task 2); tipi.
- Produces:
  - `IconPicker({ chiave, onScelta, onChiudi }: { chiave: string; onScelta: (innerSvg: string) => void; onChiudi: () => void })` — input ricerca → `cercaIconeAction` → griglia di cerchi con l'SVG candidato; click → `scegliIconaAction(chiave, id)` → `onScelta(innerSvg)`.
  - `FeaturePanel`: per ogni feature un pulsante aria-label `Cambia icona <chiave>` che apre il picker per quella chiave.
  - `StudioClient`: gestisce il picker aperto (quale chiave), e alla scelta aggiorna `bundle.iconMap[chiave] = innerSvg` e aggiunge `chiave` a `iconeNonApprovate` (l'icona appena scelta è in-revisione).

- [ ] **Step 1: IconPicker**

`src/app/studio/IconPicker.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { cercaIconeAction, scegliIconaAction } from '../actions'

export function IconPicker({
  chiave,
  onScelta,
  onChiudi,
}: {
  chiave: string
  onScelta: (innerSvg: string) => void
  onChiudi: () => void
}) {
  const [q, setQ] = useState('')
  const [cand, setCand] = useState<{ id: string; innerSvg: string }[]>([])
  const [inCorso, start] = useTransition()

  function cerca() {
    start(async () => setCand(await cercaIconeAction(q)))
  }
  function scegli(id: string) {
    start(async () => {
      const { innerSvg } = await scegliIconaAction(chiave, id)
      onScelta(innerSvg)
      onChiudi()
    })
  }

  return (
    <div role="dialog" aria-label={`Scegli icona per ${chiave}`} className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
        <div className="mb-2 flex gap-2">
          <input aria-label="Cerca icona" className="flex-1 rounded border border-zinc-300 px-2 py-1"
            placeholder="Cerca icona…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cerca()} />
          <button className="rounded bg-zinc-800 px-3 py-1 text-white disabled:opacity-50" onClick={cerca} disabled={inCorso || q.trim().length < 2}>Cerca</button>
          <button aria-label="Chiudi" className="rounded border border-zinc-300 px-3 py-1" onClick={onChiudi}>✕</button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {cand.map((c) => (
            <button key={c.id} aria-label={`Usa ${c.id}`} onClick={() => scegli(c.id)}
              className="flex aspect-square items-center justify-center rounded border border-zinc-200 p-1 hover:border-emerald-600"
              // SVG candidato: normalizzato/sanitizzato lato server (normalizeIconSvg) prima di arrivare qui
              dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" width="100%" height="100%">${c.innerSvg}</svg>` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

Nota sicurezza: `c.innerSvg` proviene da `normalizeIconSvg` server-side (sanitizzato), non è input utente grezzo.

- [ ] **Step 2: Pulsante "cambia icona" in FeaturePanel**

In `src/app/studio/FeaturePanel.tsx`, il componente riceve una nuova prop `onCambiaIcona: (chiave: string) => void` e per ogni feature aggiunge un pulsante:

```tsx
<button aria-label={`Cambia icona ${el.chiave}`} className="px-1" onClick={() => onCambiaIcona(el.chiave)}>🎨</button>
```

(Aggiorna la firma delle props di FeaturePanel e passa `onCambiaIcona` da StudioClient.)

- [ ] **Step 3: Wire in StudioClient**

Stato `const [pickerChiave, setPickerChiave] = useState<string | null>(null)`. Passa `onCambiaIcona={setPickerChiave}` a FeaturePanel. Rendi il picker quando `pickerChiave` è non-null:

```tsx
{pickerChiave && (
  <IconPicker
    chiave={pickerChiave}
    onChiudi={() => setPickerChiave(null)}
    onScelta={(innerSvg) => {
      setBundle((b) => (b ? { ...b, iconMap: { ...b.iconMap, [pickerChiave]: innerSvg }, iconeNonApprovate: [...new Set([...(b.iconeNonApprovate ?? []), pickerChiave])] } : b))
    }}
  />
)}
```

Aggiungi `iconeNonApprovate` al tipo `Bundle` locale e popolalo da `r.iconeNonApprovate` in `proponi` (e `riprendi` se disponibile). Importa `IconPicker`.

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti/verdi; l'anteprima mostra l'icona scelta (via iconMap aggiornato).

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/IconPicker.tsx src/app/studio/FeaturePanel.tsx src/app/studio/StudioClient.tsx
git commit -m "feat: icon picker per-feature (Iconify) con anteprima immediata dell'icona scelta"
```

---

### Task 4: Marcatura icone in-revisione + avviso export

**Files:**
- Create: `src/lib/ui/IconMarkOverlay.tsx`
- Modify: `src/lib/ui/EditorPreview.tsx` (monta l'overlay marcatura), `src/app/studio/StudioClient.tsx` (avviso export)

**Interfaces:**
- Produces:
  - `IconMarkOverlay({ scene, inRevisione }: { scene: Scene; inRevisione: string[] })` — per ogni `icona-label` la cui `chiave ∈ inRevisione`, disegna un badge "da approvare" posizionato sul cerchio dell'icona (in % del contenitore, come QuotaOverlay). Nessuna interazione, solo marcatura visiva.
  - `EditorPreview` riceve `inRevisione: string[]` e monta `IconMarkOverlay` sopra `ScenePreview` (accanto a `QuotaOverlay`).
  - `StudioClient`: dopo l'export, se `iconeNonApprovate.length > 0`, mostra un avviso "N icone non approvate non compaiono nella scheda esportata".

- [ ] **Step 1: IconMarkOverlay**

`src/lib/ui/IconMarkOverlay.tsx`:

```tsx
'use client'

import type { Scene, IconLabelElement } from '@/lib/scene/types'

const CANVAS = 1000
const RAGGIO = 42 // theme.icona.raggio — costante nota del template colonna-sinistra

export function IconMarkOverlay({ scene, inRevisione }: { scene: Scene; inRevisione: string[] }) {
  const marcate = scene.elements.filter(
    (e): e is IconLabelElement => e.type === 'icona-label' && inRevisione.includes(e.chiave),
  )
  return (
    <>
      {marcate.map((el) => (
        <span
          key={el.id}
          data-testid={`icona-marcata-${el.chiave}`}
          title="Icona da approvare"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow"
          style={{ left: `${((el.x + RAGGIO * 2) / CANVAS) * 100}%`, top: `${(el.y / CANVAS) * 100}%` }}
        >
          !
        </span>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Monta l'overlay in EditorPreview**

In `src/lib/ui/EditorPreview.tsx`, aggiungi la prop `inRevisione: string[]` e monta `<IconMarkOverlay scene={scene} inRevisione={inRevisione} />` dentro il contenitore relativo (dopo QuotaOverlay). Importa IconMarkOverlay. Aggiorna la chiamata in StudioClient passando `inRevisione={bundle.iconeNonApprovate ?? []}`.

- [ ] **Step 3: Avviso export in StudioClient**

Cambia `esporta()` per usare il nuovo ritorno di `exportSceneAction` (`{ path, thumbDataUri, iconeNonApprovate }`): dopo l'export, se `iconeNonApprovate.length > 0`, imposta un messaggio d'avviso (es. stato `avvisoExport`), mostrato accanto alla miniatura, tipo: `⚠ {n} icone non approvate non sono nella scheda. Approvale in /icone.` Mantieni la miniatura.

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti/verdi.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/IconMarkOverlay.tsx src/lib/ui/EditorPreview.tsx src/app/studio/StudioClient.tsx
git commit -m "feat: marcatura icone in-revisione in editor + avviso icone non approvate in export"
```

---

### Task 5: Griglia di approvazione icone `/icone`

**Files:**
- Create: `src/app/icone/page.tsx`, `src/app/icone/IconeClient.tsx`
- Modify: `src/app/actions.ts` (già ha approveIconAction/seedIconeAction dal Task 2; aggiungi `listIconeAction` se serve leggere lato client)

**Interfaces:**
- Consumes: `listIcons` (Fase 2) via una `listIconeAction`; `approveIconAction`/`seedIconeAction` (Task 2).
- Produces:
  - `listIconeAction(): Promise<{ key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }[]>` — `listIcons()` → mappa a inner-SVG + status per il rendering.
  - Pagina `/icone` (server component monta `IconeClient`).
  - `IconeClient` — carica le icone, le mostra in griglia (cerchio + chiave + stato); pulsante "Approva" per le in-revisione (→ `approveIconAction`), pulsante "Approva tutte" (blocco), e "Semina dal dizionario" (→ `seedIconeAction`, poi ricarica).

- [ ] **Step 1: listIconeAction**

In `src/app/actions.ts` (import `listIcons` da `@/lib/icons/repository`):

```ts
export async function listIconeAction(): Promise<{ key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }[]> {
  const icone = await listIcons()
  return icone.map((i) => ({ key: i.key, innerSvg: innerSvg(i.svg), status: i.status }))
}
```

- [ ] **Step 2: page.tsx**

`src/app/icone/page.tsx`:

```tsx
import { IconeClient } from './IconeClient'

export default function IconePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-800">Libreria icone</h1>
      <IconeClient />
    </main>
  )
}
```

- [ ] **Step 3: IconeClient**

`src/app/icone/IconeClient.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { listIconeAction, approveIconAction, seedIconeAction } from '../actions'

type Icona = { key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }

export function IconeClient() {
  const [icone, setIcone] = useState<Icona[]>([])
  const [inCorso, start] = useTransition()

  function ricarica() {
    start(async () => setIcone(await listIconeAction()))
  }
  useEffect(ricarica, [])

  function approva(key: string) {
    start(async () => { await approveIconAction(key); setIcone(await listIconeAction()) })
  }
  function approvaTutte() {
    start(async () => {
      for (const i of icone.filter((x) => x.status === 'in-revisione')) await approveIconAction(i.key)
      setIcone(await listIconeAction())
    })
  }
  function semina() {
    start(async () => { await seedIconeAction(); setIcone(await listIconeAction()) })
  }

  const daApprovare = icone.filter((i) => i.status === 'in-revisione').length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button className="rounded border border-zinc-300 px-3 py-1" onClick={semina} disabled={inCorso}>Semina dal dizionario</button>
        <button className="rounded bg-emerald-700 px-3 py-1 text-white disabled:opacity-50" onClick={approvaTutte} disabled={inCorso || daApprovare === 0}>Approva tutte ({daApprovare})</button>
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {icone.map((i) => (
          <div key={i.key} className={`flex flex-col items-center gap-1 rounded border p-2 ${i.status === 'in-revisione' ? 'border-amber-400' : 'border-zinc-200'}`}>
            <div className="h-10 w-10" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" width="100%" height="100%">${i.innerSvg}</svg>` }} />
            <span className="truncate text-[10px] text-zinc-600" title={i.key}>{i.key}</span>
            {i.status === 'in-revisione'
              ? <button aria-label={`Approva ${i.key}`} className="rounded bg-amber-500 px-2 text-xs text-white" onClick={() => approva(i.key)}>Approva</button>
              : <span className="text-[10px] text-emerald-700">approvata</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: puliti/verdi; rotta `/icone` compilata.

- [ ] **Step 5: Commit**

```bash
git add src/app/icone/ src/app/actions.ts
git commit -m "feat: griglia di approvazione icone /icone (approva, approva tutte, semina)"
```

---

### Task 6: E2E libreria icone

**Files:**
- Modify: `e2e/seed.ts` (pulizia db.icon per ripetibilità), `e2e/studio.spec.ts` o nuovo `e2e/icone.spec.ts`

**Interfaces:**
- Consumes: l'app in `SVG_STUDIO_FAKE=1` (fake Iconify dal Task 2). Il DB parte senza icone (il seed E2E non semina icone), quindi le icone-label rendono segnaposto finché non se ne sceglie/approva una.

- [ ] **Step 1: Pulizia db.icon nel seed E2E**

In `e2e/seed.ts` aggiungi `await db.icon.deleteMany()` (accanto a `db.scene.deleteMany(...)`) per run ripetibili — così ogni run parte senza icone.

- [ ] **Step 2: E2E flusso icone**

Nuovo `e2e/icone.spec.ts` (usa l'helper `apriEProponi` — importalo/duplica il minimo necessario, oppure metti il test in `studio.spec.ts`):

```ts
import { test, expect } from '@playwright/test'

test('picker: scegliere un\'icona la mostra marcata; l\'export segnala le non approvate', async ({ page }) => {
  await page.goto('/studio')
  // apri e proponi (helper inline: gestisce la race di idratazione)
  const input = page.getByLabel('SKU')
  await expect(async () => { await input.fill('2137070'); await expect(page.getByRole('button', { name: 'Proponi' })).toBeEnabled() }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  // cambia icona della prima feature
  await page.getByRole('button', { name: /^Cambia icona / }).first().click()
  const cerca = page.getByLabel('Cerca icona')
  await cerca.fill('stella')
  await page.getByRole('button', { name: 'Cerca' }).click()
  await page.getByRole('button', { name: /^Usa / }).first().click()

  // l'icona scelta è marcata "da approvare"
  await expect(page.locator('[data-testid^="icona-marcata-"]').first()).toBeVisible({ timeout: 30_000 })

  // export segnala le non approvate
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByText(/non approvate/i)).toBeVisible({ timeout: 30_000 })
})

test('griglia /icone: approvare rimuove lo stato in-revisione', async ({ page }) => {
  // prima crea un'icona in-revisione via il picker (riusa il flusso), poi vai su /icone
  await page.goto('/icone')
  await page.getByRole('button', { name: 'Semina dal dizionario' }).click()
  // dopo il seed ci sono icone in-revisione: approvale tutte
  const approvaTutte = page.getByRole('button', { name: /^Approva tutte/ })
  await expect(approvaTutte).toBeEnabled({ timeout: 30_000 })
  await approvaTutte.click()
  await expect(page.getByRole('button', { name: /^Approva tutte/ })).toBeDisabled({ timeout: 30_000 })
})
```

Nota: il fake Iconify (Task 2) fa sì che `Semina dal dizionario` crei un'icona in-revisione per ogni chiave del dizionario offline; `cercaIconeAction` ritorna la candidata canned. Se un selettore/tempo risulta instabile, aumenta i timeout e documenta.

- [ ] **Step 3: Esegui E2E (due volte) + unit**

```bash
npm run e2e
npm run e2e
npm test
```

Expected: tutti i test E2E verdi (i precedenti + i 2 nuovi), stabili su due run; unit invariati. Se chromium non è installabile, segnala BLOCKED lasciando committati spec/seed.

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test: E2E libreria icone (picker→marcata→avviso export; griglia approva)"
```

---

## Criteri di completamento Fase 3d

- `/studio`: "Cambia icona" su una feature apre il picker Iconify, la candidata scelta appare subito nell'anteprima **marcata "da approvare"**; l'export produce comunque la scheda ma **segnala** le icone non approvate (che restano segnaposto).
- `/icone`: mostra tutte le icone con stato; "Approva"/"Approva tutte" portano ad approvata; "Semina dal dizionario" popola le mancanti da Iconify.
- Dopo l'approvazione, ri-proponendo lo SKU l'icona approvata compare in anteprima non marcata e nell'export.
- Regola d'oro §7 rispettata: l'export usa SOLO icone approvate (imposta a livello server, non bypassabile dall'UI).
- `npm test` verde; `npm run e2e` verde offline (fake Iconify), stabile su due run; confine server/client intatto; nessun modulo Fase 1/2 modificato.

## Note per fasi successive (backlog residuo)

- Supporto icone **fill** (oggi solo line-art stroke; alcune `solar` risultano vuote).
- `imageDataUri` per-hash (scene multi-foto), template `griglia-sotto`/`multi-prodotto`, fallback Gemini Vision per il bbox.
- `FOTO_BOX`/`testa*3` promossi in `theme`, test RGBA bbox, dark-mode contrast UI, E2E su `next build && start`.
- Upload automatico su Magento (fase 2 della spec).
- `loadSceneAction`: ritornare anche `immagini` e `iconeNonApprovate` per riallineare pienamente l'editor dopo "Riprendi".
