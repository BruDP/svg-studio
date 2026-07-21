# Revisione qualità del batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (consigliato) o superpowers:executing-plans. Gli step usano checkbox (`- [ ]`). Spec: `docs/superpowers/specs/2026-07-21-revisione-qualita-batch-design.md`.

**Goal:** Dopo "Genera tutte", ogni scheda ha uno stato qualità con i motivi, così l'operatore corregge solo quelle segnalate; incluso il riempimento onesto fino a 6 icone (feature di categoria marcate "da verificare").

**Architecture:** Una funzione pura `valutaQualita(scene)` produce lo stato; il padding minimo-6 vive in `rankFeatures` (a monte, incide su batch e singolo); `generaSchedaAction` restituisce la qualità e il Banco la mostra per riga.

**Tech Stack:** TypeScript, Next.js, vitest. Nessuna dipendenza nuova.

## Global Constraints
- Codice/commenti/commit in ITALIANO.
- `npx tsc --noEmit` pulito; `DATABASE_URL="file:./data/svg-studio.db" npx vitest run` verde.
- Funzioni di dominio PURE e deterministiche (nessuna I/O in `valutaQualita`/`rankFeatures`).
- Il padding NON deve inventare valori: riempie solo con feature SENZA valore obbligatorio (label senza `{valore}`), non badge, non già presenti.
- Nessun blocco: una scheda "da rivedere" resta generata ed esportabile.

---

### Task 1: `valutaQualita` — valutazione qualità pura

**Files:**
- Create: `src/lib/quality/valuta.ts`
- Test: `tests/quality-valuta.test.ts`

**Interfaces:**
- Produces: `interface Qualita { icone: number; daVerificare: number; problemi: string[]; daRivedere: boolean }` e `function valutaQualita(scene: Scene): Qualita`.

- [ ] **Step 1: test che fallisce** — `tests/quality-valuta.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { valutaQualita } from '@/lib/quality/valuta'
import type { Scene } from '@/lib/scene/types'
import { SCENE_VERSION } from '@/lib/scene/types'

function scena(icone: { verificata: boolean }[]): Scene {
  return {
    version: SCENE_VERSION, sku: 'X', templateId: 'colonna-sinistra',
    canvas: { width: 1000, height: 1000 },
    elements: icone.map((ic, i) => ({
      type: 'icona-label' as const, id: `f${i}`, chiave: `k${i}`, etichetta: 'E', x: 0, y: 0, verificata: ic.verificata,
    })),
  }
}

describe('valutaQualita', () => {
  it('meno di 6 icone → problema "solo N icone"', () => {
    const q = valutaQualita(scena([{ verificata: true }, { verificata: true }, { verificata: true }]))
    expect(q.icone).toBe(3)
    expect(q.problemi.some((p) => p.includes('3') && /icone/.test(p))).toBe(true)
    expect(q.daRivedere).toBe(true)
  })
  it('feature da verificare → problema "N da verificare"', () => {
    const q = valutaQualita(scena([...Array(6)].map((_, i) => ({ verificata: i < 4 }))))
    expect(q.icone).toBe(6)
    expect(q.daVerificare).toBe(2)
    expect(q.problemi.some((p) => /da verificare/.test(p))).toBe(true)
    expect(q.daRivedere).toBe(true)
  })
  it('6 icone tutte verificate → nessun problema', () => {
    const q = valutaQualita(scena([...Array(6)].map(() => ({ verificata: true }))))
    expect(q.problemi).toEqual([])
    expect(q.daRivedere).toBe(false)
  })
})
```

- [ ] **Step 2: esegui, verifica fallimento** — `npx vitest run tests/quality-valuta.test.ts` → FAIL (modulo assente).

- [ ] **Step 3: implementa** — `src/lib/quality/valuta.ts`:
```ts
import type { Scene } from '@/lib/scene/types'

/** Numero minimo di icone-caratteristica desiderato per scheda (vedi padding in rankFeatures). */
export const MIN_ICONE = 6

export interface Qualita {
  icone: number
  daVerificare: number
  problemi: string[]
  daRivedere: boolean
}

/** Valuta la qualità di una scena (pura): conta icone e feature da verificare e produce messaggi. */
export function valutaQualita(scene: Scene): Qualita {
  const icone = scene.elements.filter((e) => e.type === 'icona-label')
  const daVerificare = icone.filter((e) => e.type === 'icona-label' && e.verificata === false).length
  const problemi: string[] = []
  if (icone.length < MIN_ICONE) problemi.push(`solo ${icone.length} icone (min ${MIN_ICONE})`)
  if (daVerificare > 0) problemi.push(`${daVerificare} caratteristiche da verificare`)
  return { icone: icone.length, daVerificare, problemi, daRivedere: problemi.length > 0 }
}
```

- [ ] **Step 4: esegui, verifica pass** — `npx vitest run tests/quality-valuta.test.ts` → PASS.

- [ ] **Step 5: commit**
```bash
git add src/lib/quality/valuta.ts tests/quality-valuta.test.ts
git commit -m "feat(quality): valutaQualita (stato qualita scheda: icone, da-verificare, problemi)"
```

---

### Task 2: Padding minimo 6 icone in `rankFeatures`

**Files:**
- Modify: `src/lib/extraction/ranking.ts`
- Test: `tests/ranking-padding.test.ts` (Create)
- Regenerate goldens: `tests/fixtures/proposal-2137070.json`, `tests/fixtures/scene-2137070.json`, `tests/fixtures/render-2137070.svg` (il barbecue passa da 2 a 3 feature per padding — diff atteso).

**Interfaces:**
- Consumes: `rankFeatures(validated, categoria, dict)` esistente (vedi ranking.ts). `dict.features[k]` ha `label`, `priorita`, `badge`, `categorie`.
- Produces: comportamento invariato per le feature reali; in coda, feature di riempimento con `verificata:false`, `valore:null`, fino a `MIN_ICONE` (o esaurimento categoria).

- [ ] **Step 1: test che fallisce** — `tests/ranking-padding.test.ts`. Usa il dizionario reale (`loadDictionary`) per non duplicare dati. Scegli una categoria ricca (`arredo_interno`) e passa poche feature validate, poi verifica il padding:
```ts
import { describe, it, expect } from 'vitest'
import { rankFeatures } from '@/lib/extraction/ranking'
import { loadDictionary } from '@/lib/dictionary/loader'

const dict = loadDictionary()

describe('rankFeatures padding min 6', () => {
  it('categoria ricca con poche feature reali → riempie fino a 6, il resto verificata=false', () => {
    // 2 feature reali applicabili ad arredo_interno
    const validated = [
      { chiave: 'specchio_figura_intera', valore: null, verificata: true },
      { chiave: 'cornice_legno', valore: null, verificata: true },
    ]
    const { features } = rankFeatures(validated as never, 'arredo_interno', dict)
    expect(features.length).toBe(6)
    // le prime 2 sono le reali (verificate), le successive sono padding (verificata=false)
    expect(features.filter((f) => f.verificata).length).toBe(2)
    expect(features.filter((f) => !f.verificata).length).toBe(4)
    // il padding non contiene badge né feature con valore obbligatorio (label senza {valore})
    for (const f of features.filter((x) => !x.verificata)) {
      expect(f.badge).toBe(false)
      expect(dict.features[f.chiave].label.includes('{valore}')).toBe(false)
    }
    // nessun duplicato di chiave
    expect(new Set(features.map((f) => f.chiave)).size).toBe(features.length)
  })

  it('categoria povera (barbecue, 3 feature totali) → resta sotto 6, non inventa oltre il catalogo', () => {
    const validated = [{ chiave: 'materiale_acciaio', valore: null, verificata: true }]
    const { features } = rankFeatures(validated as never, 'barbecue', dict)
    expect(features.length).toBeLessThanOrEqual(3)
    expect(features.length).toBeGreaterThanOrEqual(1)
  })
})
```
NB: se `materiale_acciaio` non è tra le chiavi barbecue del dizionario, sostituisci con una chiave realmente applicabile a `barbecue` (controlla `dictionary/features.yaml`); l'importante è: 1 feature reale + categoria con <6 feature totali → risultato < 6.

- [ ] **Step 2: esegui, verifica fallimento** — `DATABASE_URL="file:./data/svg-studio.db" npx vitest run tests/ranking-padding.test.ts` → FAIL (oggi non c'è padding).

- [ ] **Step 3: implementa** — in `src/lib/extraction/ranking.ts`, importa `MIN_ICONE` da `@/lib/quality/valuta` (o ridefinisci la costante localmente se preferisci evitare la dipendenza layer — scegli e commenta; consigliato importarla per DRY). Dopo aver calcolato `features` (già `slice(0, MAX_ICON_FEATURES)`), aggiungi il padding PRIMA del `return`:
```ts
import { MIN_ICONE } from '@/lib/quality/valuta'
// ...
const features = proposed.filter((f) => !f.badge).slice(0, MAX_ICON_FEATURES)

if (features.length < MIN_ICONE) {
  const presenti = new Set(proposed.map((f) => f.chiave)) // reali + badge già proposti
  const riempimento: ProposedFeature[] = Object.entries(dict.features)
    .filter(([k, def]) =>
      def.categorie.includes(categoria) &&
      !def.badge &&
      !def.label.includes('{valore}') && // niente feature con valore obbligatorio (label pulita)
      !presenti.has(k),
    )
    .sort(([, a], [, b]) => b.priorita - a.priorita)
    .slice(0, MIN_ICONE - features.length)
    .map(([k, def]) => ({
      chiave: k,
      etichetta: def.label.replace('{valore}', '').trim(),
      valore: null,
      verificata: false, // padding: caratteristica di categoria NON confermata dal testo
      priorita: def.priorita,
      badge: false,
    }))
  features.push(...riempimento)
}

return { features, badges: proposed.filter((f) => f.badge) }
```
(Rimuovi il vecchio `return` inline e sostituiscilo con questo blocco.)

- [ ] **Step 4: esegui, verifica pass** — `DATABASE_URL="file:./data/svg-studio.db" npx vitest run tests/ranking-padding.test.ts` → PASS. Poi `npx tsc --noEmit` pulito.

- [ ] **Step 5: rigenera i golden barbecue** — il barbecue (categoria `barbecue`, 2 feature reali nel fake) ora riceve padding fino a 3 (categoria barbecue ha 3 feature totali). Rigenera con uno script temporaneo `scripts/_regen-golden-temp.ts` (pattern del progetto) che ricrea `proposal-2137070.json` (via `extractProposal` col `fakeGenerate` identico a `tests/engine.test.ts`), `scene-2137070.json` e `render-2137070.svg` (via `composeColonnaSinistra`+`renderScene` come in `tests/layout-colonna-sinistra.test.ts`/`render-svg.test.ts`); POI cancella lo script. Verifica con `git diff` che il diff sia SOLO l'aggiunta della/e feature di padding (verificata:false) e le icone/coordinate derivate — nessun'altra regressione.

- [ ] **Step 6: esegui suite intera** — `DATABASE_URL="file:./data/svg-studio.db" npx vitest run` → verde (i golden aggiornati passano).

- [ ] **Step 7: commit**
```bash
git add src/lib/extraction/ranking.ts tests/ranking-padding.test.ts tests/fixtures/proposal-2137070.json tests/fixtures/scene-2137070.json tests/fixtures/render-2137070.svg
git commit -m "feat(ranking): padding fino a 6 icone con feature di categoria da verificare (min-6 onesto)"
```

---

### Task 3: `generaSchedaAction` ritorna la qualità + il Banco la mostra

**Files:**
- Modify: `src/app/actions.ts` (`generaSchedaAction`)
- Modify: `src/app/studio/Banco.tsx`
- Test: `tests/engine.test.ts` NON tocca generaSchedaAction; aggiungi invece un test mirato in un nuovo `tests/genera-scheda-qualita.test.ts` solo se fattibile offline (vedi nota); altrimenti copertura via `valutaQualita` (Task 1) + verifica manuale UI.

**Interfaces:**
- Consumes: `valutaQualita` + `Qualita` (Task 1).
- Produces: `generaSchedaAction(sku)` ritorna `{ sku; ok; path?; errore?; qualita?: Qualita }`.

- [ ] **Step 1: estendi `generaSchedaAction`** in `src/app/actions.ts`: importa `valutaQualita, type Qualita` da `@/lib/quality/valuta`; cambia la firma di ritorno aggiungendo `qualita?: Qualita`; nel ramo `ok` calcola `const qualita = valutaQualita(scene)` e includilo nel return:
```ts
): Promise<{ sku: string; ok: boolean; path?: string; errore?: string; qualita?: Qualita }> {
  // ...
    const { scene } = await costruisciScena(s, dict)
    const svg = await renderSceneServer(scene)
    const path = await exportScene({ svg, sku: scene.sku })
    return { sku: s, ok: true, path, qualita: valutaQualita(scene) }
  // catch invariato
```

- [ ] **Step 2: mostra lo stato nel Banco** — in `src/app/studio/Banco.tsx`, estendi lo stato di riga con la qualità e mostrala. Nel tipo `StatoRiga`, il caso `fatto` porta anche `qualita?`:
```ts
import type { Qualita } from '@/lib/quality/valuta'
type StatoRiga =
  | { stato: 'in-corso' }
  | { stato: 'fatto'; path: string; qualita?: Qualita }
  | { stato: 'errore'; errore: string }
```
Nel ciclo `generaTutte`, salva `qualita` dal risultato:
```ts
setStatoRighe((prev) => ({ ...prev, [voce.sku]: { stato: 'fatto', path: r.path!, qualita: r.qualita } }))
```
Nella riga "fatto", sostituisci il messaggio con lo stato qualità:
```tsx
{s?.stato === 'fatto' && (
  s.qualita?.daRivedere
    ? <p role="alert" className="text-xs text-amber-700">⚠ da rivedere: {s.qualita.problemi.join('; ')}</p>
    : <p className="text-xs text-emerald-700">✓ fatto</p>
)}
```
E nel riepilogo finale aggiungi il conteggio "da rivedere": accumula in `generaTutte` un contatore `daRivedere` quando `r.qualita?.daRivedere`, e mostralo accanto a "N generate, M errori" → "… , K da rivedere".

- [ ] **Step 3: tsc + suite** — `npx tsc --noEmit` pulito; `DATABASE_URL="file:./data/svg-studio.db" npx vitest run` verde. (Nota: `generaSchedaAction` in modalità reale chiama Gemini; NON aggiungere un test che lo esegue davvero. La logica-chiave `valutaQualita` è già coperta dal Task 1.)

- [ ] **Step 4: verifica E2E** — il test E2E `genera tutte` (`e2e/studio.spec.ts`) deve restare verde; se l'asserzione sul riepilogo "1 generate, 0 errori" cambia forma, aggiornala mantenendo il senso. Esegui `npx playwright test`.

- [ ] **Step 5: commit**
```bash
git add src/app/actions.ts src/app/studio/Banco.tsx e2e/studio.spec.ts
git commit -m "feat(banco): stato qualita per scheda + contatore da-rivedere nel batch"
```

---

## Criteri di completamento
- `valutaQualita` puro e testato; `rankFeatures` riempie fino a 6 (onesto, feature da-verificare) senza inventare valori né superare il catalogo di categoria.
- Il Banco mostra ✓ / ⚠ da rivedere (+ motivi) per riga e il conteggio "da rivedere" nel riepilogo.
- Golden barbecue rigenerati (diff = solo padding). `tsc` pulito, unit + E2E verdi.

## Note
- Onestà: le feature di padding sono `verificata=false` e la coda le segnala; l'operatore le conferma/rimuove prima dell'uso.
- Modello esecuzione: lotto meccanico su spec chiusa → Sonnet per i task, review finale whole-branch.
