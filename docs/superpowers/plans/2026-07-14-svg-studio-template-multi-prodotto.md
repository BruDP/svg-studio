# SVG Studio — Template multi-prodotto — Piano A (schema + template + estrazione pulita) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> oppure superpowers:executing-plans per implementare questo piano task-by-task. Gli step usano checkbox
> (`- [ ]`). Spec di riferimento: `docs/superpowers/specs/2026-07-14-svg-studio-template-multi-prodotto-design.md`.

**Goal:** Aggiungere il template `multi-prodotto` per le schede di **set**: N sotto-prodotti (2-3) con
foto+quote+badge ciascuno + lista icone condivisa in griglia sotto. Questo Piano A consegna schema,
mutazioni, layout, template, orchestrazione compose e UI, con estrazione limitata al **caso pulito con
corroborazione capacità** (set valigie, SKU reale `5926962`). Il caso sporco (giardino `2188908`) è nel
**Piano B** (`2026-07-14-svg-studio-template-multi-prodotto-B-estrazione.md`), che dipende da questo.

**Architecture:** File del template **nuovo** (`src/lib/layout/multi-prodotto.ts`); `colonna-sinistra.ts`
e `renderScene` **non cambiano** (golden intatti). La scena guadagna un campo **opzionale** `gruppo?` su
`foto`/`quota`/`badge` (`types.ts` + `schema.ts`), `SCENE_VERSION` resta 1. `SchedaProposal` guadagna
`sottoProdotti?` (additivo). `compose-lib.ts` sceglie il template su `sottoProdotti.length ≥ 2`. La
mutazione `imposta-foto` e `cambiaFotoAction` guadagnano un `gruppo?` per l'editing mirato. Estrazione:
nuovo `parseSetDimensions` (pulito, gate su capacità). Golden nuovo dedicato su `5926962`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Prisma/SQLite, `sharp`, `zod`. Node 20+, npm,
alias `@/* → src/*`, `.gitattributes` LF. Riusa immutati `resolveBBox`, `fitFoto`, `quoteFromBBox`,
`FOTO_BOX`, `parseDimensions`, `rankFeatures`.

## Global Constraints

- **`colonna-sinistra` e renderer intatti**: `src/lib/layout/colonna-sinistra.ts`,
  `src/lib/render/svg.ts` NON cambiano → `tests/render-svg.test.ts` e
  `tests/layout-colonna-sinistra.test.ts` byte-identici, golden barbecue (`tests/fixtures/scene-2137070.json`,
  `tests/fixtures/render-2137070.svg`) invariato. Verificarli, non rigenerarli.
- **Scena additiva e retrocompatibile**: `gruppo?` opzionale su foto/quota/badge; icone/testo senza
  gruppo; `SCENE_VERSION` = 1. Scene esistenti (prodotto singolo, senza `gruppo`) restano valide sotto lo
  zod esteso; il renderer ignora `gruppo`. `tests/scene-schema.test.ts` esteso, non stravolto.
- **`SchedaProposal` additivo**: `sottoProdotti?` opzionale; `dimensioni`/`features`/`badges` invariati.
  Percorso prodotto singolo (`sottoProdotti` assente) byte-identico a oggi.
- **`parseSetDimensions` conservativo (Piano A)**: produce `sottoProdotti` SOLO con ≥2 blocchi
  `Misure <etichetta>` la cui etichetta compare anche in `Capacità <etichetta>: <N> L`. Non deve
  "sparare" su set sporchi (giardino) né su prodotti singoli. Puro e deterministico.
- **`parseDimensions` e `rankFeatures`/`MAX_ICON_FEATURES` invariati** (icone condivise).
- **Mutazioni pure**: `applyMutation` senza I/O; `imposta-foto` con `gruppo` filtra per gruppo; senza
  `gruppo` = comportamento odierno. Non muta l'input.
- **`resolveBBox` invariato**: la pipeline crop per gruppo lo riusa così com'è (in Piano A tutte le celle
  partono da `images[0]`).
- **Degrado, non blocco**: bbox nullo per una cella ⇒ immagine intera in quella cella; cambio foto di un
  gruppo con degrado Vision ⇒ immagine intera, altri gruppi intatti; nessun crash.
- **Tutti i test offline e deterministici**: nessuna rete, nessuna `GEMINI_API_KEY`, DB isolato o deps
  iniettate/fake.
- **Codice/commenti/commit in italiano.**

## Modello di esecuzione per-task

Il giudizio architetturale è nella spec. In esecuzione: i task di **estrazione/schema/mutazioni** portano
giudizio (parser deterministico su dati reali sporchi, casi limite, purezza) → **Sonnet**. I task di
**layout/geometria** e **UI** sono trascrivibili con codice quasi completo nel piano ma richiedono
taratura e verifica → **Sonnet** (nessun task è pura trascrizione di codice già collaudato → niente
Haiku). Review per-task **Sonnet**. **Review finale whole-branch: Opus.**

| Task | Contenuto | Esecuzione | Review |
|---|---|---|---|
| 1 | Scena: `gruppo?` su foto/quota/badge (`types.ts`+`schema.ts`) + test schema | Sonnet | Sonnet |
| 2 | `SchedaProposal.sottoProdotti?` + `parseSetDimensions` (caso pulito, gate capacità) + test | Sonnet (parser su dati reali) | Sonnet |
| 3 | Engine: `celleProdotti` + `grigliaPositions` + test | Sonnet (geometria) | Sonnet |
| 4 | Template `multi-prodotto.ts` (`composeMultiProdotto`) + unit test + GOLDEN `5926962` | Sonnet | Sonnet |
| 5 | `compose-lib.ts`: selezione template + loop `resolveBBox` per gruppo + e2e offline | Sonnet | Sonnet |
| 6 | Mutazione `imposta-foto` con `gruppo` + `cambiaFotoAction(sku,url,{gruppo}) ` + test | Sonnet (mutazione pura, ri-derivazione pezzo) | Sonnet |
| 7 | UI: selezione sotto-prodotto nel `PhotoPicker`/`StudioClient` per cambio foto per gruppo | Sonnet | Sonnet |
| 8 | Verifica determinismo (golden colonna-sinistra intatto) + `tsc` + suite | Sonnet | Sonnet |

Review finale whole-branch: **Opus.**

## File Structure

```
src/lib/scene/
  types.ts               # Task 1 — + gruppo? su FotoElement/QuotaElement/BadgeElement
  schema.ts              # Task 1 — + gruppo optional negli zod foto/quota/badge
  mutations.ts           # Task 6 — imposta-foto con gruppo? (filtro per gruppo)
src/lib/extraction/
  dimensions.ts          # Task 2 — + parseSetDimensions (caso pulito)
  engine.ts              # Task 2 — SchedaProposal.sottoProdotti?; popolamento in extractProposal
src/lib/layout/
  engine.ts              # Task 3 — + celleProdotti, grigliaPositions (fitFoto/quoteFromBBox invariati)
  multi-prodotto.ts      # Task 4 — NUOVO: composeMultiProdotto, TEMPLATE_ID='multi-prodotto'
scripts/
  compose-lib.ts         # Task 5 — selezione template + crop per gruppo
src/app/
  actions.ts             # Task 6 — cambiaFotoAction esteso con gruppo?
src/app/studio/
  PhotoPicker.tsx        # Task 7 — selezione sotto-prodotto attivo
  StudioClient.tsx       # Task 7 — stato gruppoAttivo; dispatch imposta-foto con gruppo
tests/
  scene-schema.test.ts           # Task 1
  dimensions.test.ts             # Task 2 (+ parseSetDimensions)
  layout-engine.test.ts          # Task 3
  layout-multi-prodotto.test.ts  # Task 4 (NUOVO) + fixtures/scene-5926962.json
  compose-e2e.test.ts            # Task 5 (ramo set offline)
  scene-mutations.test.ts        # Task 6
  layout-colonna-sinistra.test.ts / render-svg.test.ts  # Task 8 — verificati, NON modificati
```

---

### Task 1: Campo `gruppo?` nella scena

Aggiunge un campo opzionale additivo `gruppo?: string` a `foto`, `quota`, `badge` per indirizzare i pezzi
di un set. Icone/testo invariati. `SCENE_VERSION` resta 1. Retrocompatibile.

**Files:** Modify `src/lib/scene/types.ts`, `src/lib/scene/schema.ts`; Test `tests/scene-schema.test.ts`.

**Interfaces:** `FotoElement`/`QuotaElement`/`BadgeElement` con `gruppo?: string`.

- [ ] **Step 1 (test prima):** in `tests/scene-schema.test.ts` aggiungi:
  - una scena con `foto`/`quota`/`badge` che hanno `gruppo: 'g0'` → `parseScene` NON lancia e conserva `gruppo`.
  - una scena esistente (senza `gruppo`) → resta valida (retrocompat).
  - `gruppo` di tipo errato (numero) → `parseScene` lancia.
- [ ] **Step 2: esegui (fallisce).** `npx vitest run tests/scene-schema.test.ts` → FAIL sul test che
  verifica la conservazione di `gruppo`.
- [ ] **Step 3: implementa.** In `types.ts` aggiungi `gruppo?: string` a `FotoElement`, `QuotaElement`,
  `BadgeElement`. In `schema.ts` aggiungi `gruppo: z.string().optional()` agli oggetti zod `foto`, `quota`,
  `badge`. `SCENE_VERSION` invariato. La guardia `_sceneTypeGuard` deve continuare a compilare.
- [ ] **Step 4: esegui (passa) + tsc.** `npx vitest run tests/scene-schema.test.ts && npx tsc --noEmit`.
- [ ] **Step 5: commit.**
  ```bash
  git add src/lib/scene/types.ts src/lib/scene/schema.ts tests/scene-schema.test.ts
  git commit -m "feat(scene): campo opzionale gruppo su foto/quota/badge per i set (retrocompatibile, SCENE_VERSION invariato)"
  ```

---

### Task 2: `SchedaProposal.sottoProdotti` + `parseSetDimensions` (caso pulito)

Estende l'estrazione per riconoscere un set dal testo, nel caso pulito valigie-like. Deterministico, puro,
con gate su corroborazione capacità per non sparare su set sporchi/prodotti singoli.

**Files:** Modify `src/lib/extraction/dimensions.ts`, `src/lib/extraction/engine.ts`; Test
`tests/dimensions.test.ts`.

**Interfaces:**
- `SottoProdotto { gruppo: string; etichetta: string; dimensioni: Dimensioni; badges: ProposedFeature[] }`
  (definizione condivisa: mettila in `engine.ts` accanto a `SchedaProposal`, importa `Dimensioni`/`ProposedFeature`).
- `parseSetDimensions(notaTecnica: string[]): SottoProdotto[]` in `dimensions.ts` (ritorna `[]` se non set).
- `SchedaProposal` con `sottoProdotti?: SottoProdotto[]`.

- [ ] **Step 1 (test prima):** in `tests/dimensions.test.ts`, `describe('parseSetDimensions')`, con la
  `notaTecnica` reale delle valigie (copiala nel test come fixture inline):
  ```ts
  const valigie = [
    'Misure valigia piccola: l. 36 x p. 22 x h. 55 cm',
    'Misure valigia media: l. 42 x p. 26 x h. 64 cm',
    'Misure valigia grande: l. 47 x p. 28 x h. 75 cm',
    'Capacità valigia piccola: 38 L',
    'Capacità valigia media: 60 L',
    'Capacità valigia grande: 99 L',
  ]
  ```
  Asserzioni: `parseSetDimensions(valigie)` ha length 3; ordine = ordine di apparizione dei blocchi
  `Misure`; `gruppo` = `g0/g1/g2`; `dimensioni` del piccolo = `{larghezza:36, profondita:22, altezza:55}`;
  il badge del piccolo ha `etichetta:'38 L'` (formato badge capacità). Un prodotto singolo
  (`['l. 51 x p. 63 x h. 84,5 cm']`) → `[]`. La `notaTecnica` del giardino (blocchi `Misure` senza righe
  `Capacità`) → `[]` (gate capacità: Piano A NON gestisce il giardino).
- [ ] **Step 2: esegui (fallisce).** `npx vitest run tests/dimensions.test.ts`.
- [ ] **Step 3: implementa `parseSetDimensions`.** In `dimensions.ts`:
  - Regex `MISURE_ETICHETTATE = /Misure\s+(.+?)\s*:\s*(l\.?\s*NUM\s*x\s*p\.?\s*NUM\s*x\s*h\.?\s*NUM\s*cm)/i`
    (riusa il frammento `NUM`; cattura etichetta + i tre numeri). Raccogli i blocchi in ordine.
  - Regex `CAPACITA = /Capacità\s+(.+?)\s*:\s*NUM\s*L/i` → mappa `etichetta → "<N> L"`.
  - Tieni SOLO i blocchi `Misure` la cui etichetta ha una `Capacità` corrispondente (match esatto della
    stringa etichetta, trim/lowercase). Se restano < 2 blocchi → ritorna `[]`.
  - Costruisci `SottoProdotto[]` con `gruppo: 'g'+i`, `dimensioni` dai tre numeri (`toNum`), `badges`:
    un `ProposedFeature` badge con `etichetta` = capacità (es. `'38 L'`), `chiave:'capacita'`,
    `valore` = numero, `verificata:true`, `priorita:0`, `badge:true`.
  - Pura, nessuna dipendenza da `db`/rete.
  In `engine.ts`: definisci `SottoProdotto`, aggiungi `sottoProdotti?` a `SchedaProposal`, e in
  `extractProposal` popola `const sotto = parseSetDimensions(product.notaTecnica); ... sottoProdotti: sotto.length >= 2 ? sotto : undefined`.
  Nota determinismo: `sottoProdotti` entra nel JSON salvato in `Extraction` → coerente con la cache per
  `inputHash` (nessun cambio a `computeInputHash`, i dati di input sono gli stessi).
- [ ] **Step 4: esegui (passa) + tsc.** `npx vitest run tests/dimensions.test.ts && npx tsc --noEmit`.
- [ ] **Step 5: commit.**
  ```bash
  git add src/lib/extraction/dimensions.ts src/lib/extraction/engine.ts tests/dimensions.test.ts
  git commit -m "feat(extraction): parseSetDimensions (set pulito con corroborazione capacità) + SchedaProposal.sottoProdotti"
  ```

---

### Task 3: Helper di layout `celleProdotti` e `grigliaPositions`

Geometria deterministica per la riga di N celle-foto e per la griglia icone condivisa. `fitFoto`,
`quoteFromBBox`, `colonnaPositions` **non cambiano**.

**Files:** Modify `src/lib/layout/engine.ts`; Test `tests/layout-engine.test.ts`.

**Interfaces:**
- `celleProdotti(n: number, opts?: {...}): { x:number; y:number; width:number; height:number }[]`
- `grigliaPositions(n: number, opts?: {...}): Punto[]`

- [ ] **Step 1 (test prima):** in `tests/layout-engine.test.ts`:
  - `celleProdotti(3)` → 3 rettangoli; tutti dentro il canvas (x≥0, x+width ≤ 1000); larghezze uguali;
    x crescente; gutter > 0 tra celle (per la quota verticale). Deterministico (due chiamate uguali).
  - `grigliaPositions(7)` con 3 colonne → 7 punti; 3 righe (⌈7/3⌉); x su 3 valori distinti ripetuti;
    y crescente per riga; tutti dentro il canvas sotto la zona foto.
- [ ] **Step 2: esegui (fallisce).**
- [ ] **Step 3: implementa** in `engine.ts` con costanti locali (marginX≈40, zona foto y≈120..~540,
  gutter derivato, `cols=3`, gap da `theme.margini` dove sensato). Puri, nessuna dipendenza esterna oltre
  `theme`. Documenta con commento i valori scelti (tarati in Task 4 al golden).
- [ ] **Step 4: esegui (passa) + tsc.**
- [ ] **Step 5: commit.**
  ```bash
  git add src/lib/layout/engine.ts tests/layout-engine.test.ts
  git commit -m "feat(layout): celleProdotti e grigliaPositions per il template multi-prodotto"
  ```

---

### Task 4: Template `multi-prodotto.ts` + golden `5926962`

Il template puro che compone la scena di un set: per gruppo foto+quote+badge; icone condivise in griglia
sotto. `TEMPLATE_ID='multi-prodotto'`, `CANVAS` 1000×1000.

**Files:** New `src/lib/layout/multi-prodotto.ts`; Test `tests/layout-multi-prodotto.test.ts`; Fixture
`tests/fixtures/scene-5926962.json`.

**Interfaces:**
```ts
export function composeMultiProdotto(input: {
  proposal: SchedaProposal              // usa proposal.features (condivise) + proposal.sottoProdotti
  fotoPerGruppo: { gruppo: string; imageHash: string; bbox: { width:number; height:number } | null }[]
}): Scene
```
- Consuma `celleProdotti`, `grigliaPositions`, `fitFoto`, `quoteFromBBox` (`@/lib/layout/engine`),
  `SCENE_VERSION`, `theme`.

- [ ] **Step 1 (test prima):** in `tests/layout-multi-prodotto.test.ts`, con una `SchedaProposal` che ha
  `sottoProdotti` (3 pezzi valigie, da Task 2) + 7 feature condivise, e `fotoPerGruppo` fittizio
  (`imageHash` finto, bbox `{width,height}`):
  - `templateId === 'multi-prodotto'`, `canvas` 1000×1000, scena valida (`parseScene` non lancia).
  - conteggi: `foto` = 3 (una per gruppo, ognuna con `gruppo` corretto), `quota` = 3×(quote del pezzo),
    `badge` = 3 (capacità per pezzo, con `gruppo`), `icona-label` = 7 (condivise, **senza** `gruppo`).
  - id: foto `ph-g0/1/2`, quote `q-g0-0…`, badge `bg-g0-0…`; icone `f0..f6`.
  - determinismo (due chiamate identiche → stesso JSON).
  - golden: confronto byte con `tests/fixtures/scene-5926962.json` se esiste (pattern di
    `layout-colonna-sinistra.test.ts`).
- [ ] **Step 2: esegui (fallisce).**
- [ ] **Step 3: implementa `composeMultiProdotto`.** Ordina i gruppi come in `proposal.sottoProdotti`;
  `const celle = celleProdotti(sottoProdotti.length)`; per ogni gruppo i: `fitFoto(bbox ?? cella, cella)`
  → push `foto` (con `gruppo`); `quoteFromBBox(fitted, dim)` → push `quota` con id `q-g{i}-{j}` e `gruppo`;
  push badge del pezzo (id `bg-g{i}-{j}`, `gruppo`, `x/y` sopra la foto). Poi
  `grigliaPositions(features.length)` → push le `icona-label` condivise (id `f{k}`, **senza** gruppo).
  Puro/deterministico come `composeColonnaSinistra`.
- [ ] **Step 4: genera il golden.** Con `fotoPerGruppo` deterministico fittizio, serializza la scena e
  scrivila in `tests/fixtures/scene-5926962.json` (`JSON.stringify(scene, null, 2) + '\n'`). Rileggi il
  test: golden verde. Ispeziona a occhio il JSON (celle plausibili, id corretti).
- [ ] **Step 5: esegui + tsc.** `npx vitest run tests/layout-multi-prodotto.test.ts && npx tsc --noEmit`.
- [ ] **Step 6: commit.**
  ```bash
  git add src/lib/layout/multi-prodotto.ts tests/layout-multi-prodotto.test.ts tests/fixtures/scene-5926962.json
  git commit -m "feat(layout): template multi-prodotto (composeMultiProdotto) + golden set valigie 5926962"
  ```

---

### Task 5: `compose-lib.ts` — selezione template + crop per gruppo

`composeSceneForProduct` sceglie il template su `sottoProdotti.length ≥ 2` e, per il set, esegue la
pipeline crop per ciascun gruppo (in Piano A tutti su `images[0]`). Il ramo prodotto singolo resta
identico.

**Files:** Modify `scripts/compose-lib.ts`; Test `tests/compose-e2e.test.ts`.

**Interfaces:** `composeSceneForProduct` invariata nella firma; internamente sceglie il compose.

- [ ] **Step 1 (test prima):** in `tests/compose-e2e.test.ts`, ramo offline/fake (immagine bianca,
  `fakeDownload`), con un prodotto set-fixture (`sottoProdotti` di 2-3 pezzi, `images` ≥ 1):
  - la scena ha `templateId === 'multi-prodotto'`, una foto per gruppo, ogni foto ha `gruppo` corretto.
  - un prodotto singolo (fixture esistente) → `templateId === 'colonna-sinistra'` (nessuna regressione).
- [ ] **Step 2: esegui (fallisce).**
- [ ] **Step 3: implementa.** In `compose-lib.ts`:
  ```ts
  if (proposal.sottoProdotti && proposal.sottoProdotti.length >= 2) {
    const fotoPerGruppo = []
    for (const sp of proposal.sottoProdotti) {
      // Piano A: tutti i gruppi partono da images[0]; crop identico a oggi.
      const { imageHash, bbox } = await cropFoto(product.images[0], input.deps) // helper interno
      fotoPerGruppo.push({ gruppo: sp.gruppo, imageHash, bbox })
    }
    const scene = composeMultiProdotto({ proposal, fotoPerGruppo })
    return { scene, imageHash: fotoPerGruppo[0].imageHash }
  }
  // else: ramo colonna-sinistra IDENTICO a oggi
  ```
  Estrai il tratto cache→resolveBBox→sharp.extract in un helper interno `cropFoto(url, deps)` **solo se**
  ciò non modifica il comportamento del ramo colonna-sinistra (behavior-preserving, coperto da
  `compose-e2e`); altrimenti duplica le ~10 righe per non rischiare il golden. In Piano A `images[0]` è
  usato per tutti i gruppi (una sola immagine ritagliata, riusata) → nessun costo extra di rete.
- [ ] **Step 4: esegui + tsc + suite.** `npx tsc --noEmit && npm test`.
- [ ] **Step 5: commit.**
  ```bash
  git add scripts/compose-lib.ts tests/compose-e2e.test.ts
  git commit -m "feat(compose): selezione template multi-prodotto su sottoProdotti; crop foto per gruppo (Piano A: images[0])"
  ```

---

### Task 6: Mutazione `imposta-foto` con `gruppo` + `cambiaFotoAction` esteso

Editing mirato della foto di un singolo sotto-prodotto: la mutazione filtra per `gruppo`; l'action
ri-deriva le dimensioni del pezzo giusto da `parseSetDimensions`.

**Files:** Modify `src/lib/scene/mutations.ts`, `src/app/actions.ts`; Test `tests/scene-mutations.test.ts`.

**Interfaces:** `imposta-foto` con `gruppo?: string`; `cambiaFotoAction(sku, url, opts?: { forzaVision?; gruppo? })`
che ritorna anche `gruppo`.

- [ ] **Step 1 (test prima):** in `tests/scene-mutations.test.ts`, con una scena set (2 gruppi, foto
  `ph-g0`/`ph-g1`, quote `q-g0-*`/`q-g1-*`, badge per gruppo):
  - `imposta-foto` con `gruppo:'g1'` aggiorna SOLO `ph-g1` e le sue quote; `ph-g0`/`q-g0-*`, icone, badge
    e il gruppo g0 restano invariati.
  - `imposta-foto` **senza** `gruppo` su una scena a prodotto singolo → comportamento odierno (i test
    esistenti restano verdi — retrocompat).
  - purezza (input non mutato).
- [ ] **Step 2: esegui (fallisce).**
- [ ] **Step 3: implementa.** In `mutations.ts`, nel case `imposta-foto`: se `action.gruppo` è definito,
  applica l'aggiornamento foto/quote **solo** agli elementi con `el.gruppo === action.gruppo` (il resto
  invariato); la sostituzione posizionale delle quote resta la stessa logica, ristretta alle quote di quel
  gruppo (append usa id `q-<gruppo>-<qi>`). Senza `gruppo`, logica odierna invariata. In `actions.ts`,
  `cambiaFotoAction` accetta `opts.gruppo`; se presente, usa `parseSetDimensions(product.notaTecnica)`,
  trova il `SottoProdotto` con `gruppo === opts.gruppo`, usa la sua `dimensioni` e la **cella** di quel
  gruppo (`celleProdotti(n)[i]`) per `fitFoto`/`quoteFromBBox`; ritorna `{ …, gruppo: opts.gruppo }`. Senza
  `gruppo`, comportamento odierno (colonna-sinistra, `FOTO_BOX`, `parseDimensions`).
- [ ] **Step 4: esegui + tsc.**
- [ ] **Step 5: commit.**
  ```bash
  git add src/lib/scene/mutations.ts src/app/actions.ts tests/scene-mutations.test.ts
  git commit -m "feat(editor): imposta-foto e cambiaFotoAction mirati per gruppo (set), retrocompatibili"
  ```

---

### Task 7: UI — selezione del sotto-prodotto per il cambio foto

Nel set, l'operatore sceglie QUALE pezzo cambiare prima di scegliere la foto. Minimo indispensabile per
rendere usabile il template; nessuna nuova azione oltre quelle del Task 6.

**Files:** Modify `src/app/studio/PhotoPicker.tsx`, `src/app/studio/StudioClient.tsx`.

- [ ] **Step 1:** `StudioClient` deriva i gruppi presenti nella scena
  (`[...new Set(scene.elements.filter(e=>e.gruppo).map(e=>e.gruppo))]`); se ≥1 gruppo, mostra un selettore
  del "gruppo attivo" (stato `gruppoAttivo`, default il primo). Se nessun gruppo (prodotto singolo), UI
  invariata.
- [ ] **Step 2:** `cambiaFoto(url)` passa `gruppoAttivo` a `cambiaFotoAction(sku, url, { gruppo })` e
  dispatcha `{ type:'imposta-foto', imageHash, foto, quote, gruppo }`. Il `PhotoPicker` mostra quale pezzo
  è attivo (etichetta dal `SottoProdotto`, se disponibile via proposal, altrimenti "Pezzo N").
- [ ] **Step 3:** tsc + suite; verifica manuale offline (fake) opzionale, non automatizzata qui.
- [ ] **Step 4: commit.**
  ```bash
  git add src/app/studio/PhotoPicker.tsx src/app/studio/StudioClient.tsx
  git commit -m "feat(studio): selezione sotto-prodotto per il cambio foto nei set"
  ```

---

### Task 8: Verifica determinismo e integrazione

Conferma che `colonna-sinistra` e il renderer non abbiano regressioni e che la suite sia verde.

**Files:** Verify (no-edit) `tests/layout-colonna-sinistra.test.ts`, `tests/render-svg.test.ts`,
`tests/fixtures/scene-2137070.json`, `tests/fixtures/render-2137070.svg`.

- [ ] **Step 1:** `npx vitest run tests/layout-colonna-sinistra.test.ts tests/render-svg.test.ts` →
  golden barbecue **byte-identico**. Se falliscono, NON rigenerare: indagare (non dovrebbero essere
  toccati).
- [ ] **Step 2:** `npx tsc --noEmit && npm test` → pulito e verde sull'intero branch.
- [ ] **Step 3:** commit solo se servono aggiustamenti di verifica (con messaggio esplicativo).

---

## Criteri di completamento (Piano A)

- Scena con `gruppo?` opzionale su foto/quota/badge; icone/testo senza gruppo; `SCENE_VERSION` = 1; scene
  prodotto-singolo valide e invariate; renderer invariato.
- `parseSetDimensions` deterministico per il caso pulito con corroborazione capacità; `sottoProdotti?`
  additivo; `parseDimensions`/`rankFeatures` invariati; il giardino `2188908` → `[]` (rinviato a Piano B).
- Template `multi-prodotto` puro: N foto+quote+badge per gruppo + 7 icone condivise in griglia; id con
  prefisso di gruppo; golden `5926962` byte-identico e committato.
- `compose-lib.ts` seleziona il template su `sottoProdotti.length ≥ 2`; ramo colonna-sinistra invariato;
  crop per gruppo (Piano A: `images[0]`).
- `imposta-foto`/`cambiaFotoAction` mirati per gruppo, puri e retrocompatibili.
- UI: selezione del sotto-prodotto per il cambio foto.
- **Determinismo:** golden `colonna-sinistra`/`render-svg` byte-identici; `tsc` pulito; `npm test` verde;
  tutti i nuovi test offline.

## Backlog residuo (dopo Piano A)

- **Piano B** (`2026-07-14-svg-studio-template-multi-prodotto-B-estrazione.md`): estrazione robusta per set
  sporchi (giardino `2188908`) — filtro accessori, tolleranza separatori, badge portata (Kg), eventuale
  Gemini vincolato + validazione. Golden `2188908`.
- Auto-assegnazione euristica foto per pezzo (oggi `images[0]` per tutti — spec §6/§11).
- Multi-crop da singola foto d'insieme (fuori scope — spec §11).
- Editing strutturale del set (aggiungi/rimuovi pezzo — spec §7.2).
- Variante layout "icone a sinistra + foto asimmetriche" (replica scheda giardino — spec §11).
- Cap/avviso esplicito a N > 3 pezzi.
- Batch senza revisione resta **fuori scope**.
