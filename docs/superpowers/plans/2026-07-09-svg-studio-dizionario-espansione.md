# SVG Studio — Espansione dizionario (categorie fallite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliare il dizionario data-driven (spec §6) aggiungendo 3 sotto-categorie clima e 33 chiavi feature, così che i 3 prodotti benchmark falliti (condizionatore portatile 5925927, tavolo mosaico 2195799, specchio 5922547) producano schede ricche (rispettivamente ≥6, ≥4, ≥3 feature pertinenti) senza toccare il motore.

**Architecture:** Nessun nuovo componente. Si estendono due soli file dati versionati in git — `dictionary/categories.yaml` (enum categoria) e `dictionary/features.yaml` (chiavi feature) — più lo script di seeding icone. La pipeline consuma le nuove voci da sé: gli enum `categoria` e `chiave` dello structured output Gemini sono derivati dal dizionario (`src/lib/extraction/gemini.ts`: `enum: dict.categorie` e `enum: Object.keys(dict.features).sort()`), il ranking filtra su `priorita`/`categorie` (`src/lib/extraction/ranking.ts`), il render risolve le icone per chiave dal DB (solo `approvata`, `getApprovedIcon`).

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Prisma/SQLite, YAML + zod. Iconify (`tabler`) per il seeding icone. `@google/genai` (Gemini) per l'estrazione. Riusa Fasi 1/2/3a-3d immutate.

## Global Constraints

Copiati verbatim dalla spec §3 (valori esatti):

- **Golden determinismo intatto**: nessuna nuova chiave è applicabile a `barbecue`. La fixture golden (SKU 2137070, categoria barbecue) deve restare byte-identica. Il render golden non cambia.
- **Bump versione dizionario**: `features.yaml` e `categories.yaml` passano a `version: 2`. Questo invalida la cache estrazioni (`computeInputHash` include `dictVersion` e `dictKeys`) — i prodotti si ri-estraggono alla prossima proposta. Comportamento atteso, non un errore.
- **Test CI dizionario verde**: `dictionary.test.ts` valida schema YAML, assenza di chiavi duplicate, e (dove verificato) coerenza. Ogni nuova chiave deve avere `label`, `icona` (`set:name`), `priorita`, `badge`, `valore`, `categorie` non vuoto. Le categorie referenziate devono esistere in `categories.yaml`.
- **Icone verificate ed esistenti**: tutte le icone `tabler:*` proposte sono già state verificate come esistenti su Iconify (2026-07-09). Il seeding le scarica, normalizza e le salva; devono essere **approvate** perché l'export le usi (regola d'oro §7).
- **Nessuna modifica al motore**: `renderScene`, `scene/*`, l'engine di estrazione/ranking, i template restano invariati. Si toccano solo i file di dizionario (`dictionary/*.yaml`), il seeding icone e (per validazione) uno script di benchmark.
- **Determinismo dell'estrazione preservato**: nessuna modifica a `temperature`/`seed`/prompt. Si aggiungono solo voci enum (chiavi e categorie) allo schema.

Vincoli aggiuntivi verificati sul codebase (da rispettare):

- **Nessuna modifica a loader/types/zod**: `src/lib/dictionary/loader.ts` usa `z.array(z.string())` per `categorie` e `z.record(z.string(), featureSchema)` per le chiavi, `version: z.number()`. Le nuove categorie/chiavi e il bump di versione **non** richiedono modifiche a `loader.ts` né a `types.ts`. Se sembrasse servire, fermarsi e segnalarlo.
- **`dict.version` deriva da `features.yaml`**: `loadDictionary` ritorna `version: feats.version` (riga 33 di `loader.ts`). L'asserzione `dict.version` in `dictionary.test.ts` va portata a `2` **nello stesso task** che bumpa `features.yaml`, non quando si bumpa `categories.yaml`.
- **Icone: `set:name` sui set ammessi**: `ICONIFY_SETS = ['tabler', 'lucide', 'solar']`. Tutte le 33 nuove icone sono `tabler:*` → valide.
- **UI/commenti/commit in italiano. Node 20+, npm. Alias `@/* → src/*`. `.gitattributes` LF invariato.**

---

## Modello di esecuzione per-task

Come nel ledger Fase 3d: il grosso è trascrizione dei valori esatti dalla spec.

| Task | Contenuto | Esecuzione suggerita | Review |
|---|---|---|---|
| 1 | Sotto-categorie clima + test | Sonnet (giudizio sul test) | Sonnet |
| 2 | Chiavi feature clima + bump versione | Haiku (trascrizione) | Sonnet |
| 3 | Chiavi feature arredo + verifica chiave esistente | Haiku (trascrizione) | Sonnet |
| 4 | Seeding + approvazione 33 icone (rete) | Sonnet (script + rete) | Sonnet |
| 5 | Validazione benchmark end-to-end 3 SKU (rete + Gemini) | Sonnet | Sonnet |

Review finale whole-branch: **Opus**.

---

## File Structure

```
dictionary/
  categories.yaml      # Task 1 — version 2; +3 categorie clima (condizionatore_portatile, ventilatore, deumidificatore)
  features.yaml        # Task 2 — version 2; +21 chiavi clima
                       # Task 3 — +12 chiavi arredo (33 totali)
tests/
  dictionary.test.ts   # Task 1 — assert nuove categorie presenti; Task 2 — assert dict.version === 2
scripts/
  seed-icons.ts        # Task 4 — flag --approve: approva le icone appena create (export usa solo approvate)
```

Nessun file sotto `src/` cambia: loader, types, engine, ranking, gemini, render restano intatti (gli enum si allargano da soli dal dizionario).

---

### Task 1: Sotto-categorie clima in `categories.yaml`

Split della categoria clima (spec §5): si aggiungono 3 sotto-categorie all'enum e si bumpa `categories.yaml` a `version: 2`. `condizionatore` (esistente) resta come split fisso / a parete.

**Files:**
- Modify: `dictionary/categories.yaml`
- Test: `tests/dictionary.test.ts`

**Interfaces:**
- Consumes: `loadDictionary()` da `@/lib/dictionary/loader` (nessuna firma cambia).
- Produces: `dict.categorie` contiene `condizionatore_portatile`, `ventilatore`, `deumidificatore`. `dict.version` resta 1 dopo questo task (deriva da `features.yaml`, bumpato al Task 2).

- [ ] **Step 1: Aggiungi le asserzioni sulle nuove categorie (fallisce)**

In `tests/dictionary.test.ts`, dentro il test `'il dizionario reale carica e valida'`, dopo la riga `expect(dict.categorie).toContain('frigorifero')` aggiungi:

```ts
  expect(dict.categorie).toContain('condizionatore_portatile')
  expect(dict.categorie).toContain('ventilatore')
  expect(dict.categorie).toContain('deumidificatore')
```

(Il test `'ogni categoria referenziata esiste'` — riga 19 — copre già l'integrità referenziale richiesta dalla spec §8: ogni categoria usata da una feature deve esistere in `categories.yaml`. Non va aggiunto, va solo mantenuto verde.)

- [ ] **Step 2: Esegui (fallisce)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: FAIL su `'il dizionario reale carica e valida'` — `condizionatore_portatile` non presente in `dict.categorie`. Gli altri 4 test restano verdi.

- [ ] **Step 3: Aggiorna `categories.yaml` (version 2 + 3 categorie)**

Sostituisci l'intero contenuto di `dictionary/categories.yaml` con:

```yaml
version: 2
categorie:
  - frigorifero
  - congelatore
  - lavatrice
  - forno
  - condizionatore
  - condizionatore_portatile
  - ventilatore
  - deumidificatore
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

- [ ] **Step 4: Esegui (passa)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: PASS (5 test). `dict.version` è ancora 1 (features.yaml non bumpato) → l'asserzione `expect(dict.version).toBe(1)` resta verde in questo task.

- [ ] **Step 5: Suite completa + commit**

```bash
npm test
git add dictionary/categories.yaml tests/dictionary.test.ts
git commit -m "feat(dizionario): split categoria clima — condizionatore_portatile, ventilatore, deumidificatore (categories v2)"
```

Expected: `npm test` verde (inclusi `dictionary.test.ts` e `render-svg.test.ts`).

---

### Task 2: Chiavi feature clima in `features.yaml` (version 2)

Aggiunge le 21 chiavi clima (spec §6, sezioni "Clima — modalità e capacità", "Clima — ventilatore", "Clima — condivise e split fisso") e bumpa `features.yaml` a `version: 2`. Questo porta `dict.version` a 2 → cache estrazioni invalidata (atteso).

**Files:**
- Modify: `dictionary/features.yaml`
- Test: `tests/dictionary.test.ts`

**Interfaces:**
- Consumes: `loadDictionary()`. Le nuove chiavi referenziano `condizionatore_portatile`, `ventilatore`, `deumidificatore` (esistenti dal Task 1) e `condizionatore` (esistente).
- Produces: `dict.version === 2`; 21 nuove chiavi in `dict.features`. Gemini `chiave` enum e `categoria` enum si allargano da sé.

- [ ] **Step 1: Porta l'asserzione di versione a 2 (fallisce)**

In `tests/dictionary.test.ts`, nel test `'il dizionario reale carica e valida'`, cambia:

```ts
  expect(dict.version).toBe(1)
```

in:

```ts
  expect(dict.version).toBe(2)
```

- [ ] **Step 2: Esegui (fallisce)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: FAIL — `dict.version` è ancora 1 (features.yaml non bumpato). Confermato che `dict.version` deriva da `features.yaml`.

- [ ] **Step 3: Bump versione + aggiungi le 21 chiavi clima**

In `dictionary/features.yaml`, cambia la prima riga `version: 1` in `version: 2`.

Poi, in coda al file (dopo `alimentazione_carbonella`, mantenendo l'indentazione a 2 spazi per la chiave e 4 per i campi), incolla i tre blocchi seguenti — valori esatti dalla spec §6 (`badge: sì` → `true`, `badge: no` → `false`):

Clima — modalità e capacità:

```yaml
  modalita_raffresca:
    label: "Raffresca"
    icona: tabler:snowflake
    priorita: 92
    badge: false
    valore: assente
    categorie: [condizionatore_portatile, condizionatore]
  modalita_deumidifica:
    label: "Deumidifica"
    icona: tabler:droplet
    priorita: 90
    badge: false
    valore: assente
    categorie: [condizionatore_portatile, deumidificatore, condizionatore]
  modalita_ventila:
    label: "Ventila"
    icona: tabler:wind
    priorita: 88
    badge: false
    valore: assente
    categorie: [condizionatore_portatile, ventilatore, condizionatore]
  potenza_btu:
    label: "{valore} BTU"
    icona: tabler:temperature-snow
    priorita: 85
    badge: true
    valore: obbligatorio
    categorie: [condizionatore_portatile, condizionatore]
  capacita_deumidificazione:
    label: "Assorbe {valore} L al giorno"
    icona: tabler:droplet-half-2
    priorita: 78
    badge: false
    valore: obbligatorio
    categorie: [condizionatore_portatile, deumidificatore]
  capacita_serbatoio:
    label: "Serbatoio acqua {valore} L"
    icona: tabler:bottle
    priorita: 55
    badge: false
    valore: obbligatorio
    categorie: [condizionatore_portatile, deumidificatore]
  intervallo_temperatura:
    label: "Intervallo {valore}"
    icona: tabler:temperature
    priorita: 65
    badge: false
    valore: obbligatorio
    categorie: [condizionatore_portatile, condizionatore]
  sbrinamento_automatico:
    label: "Sbrinamento automatico"
    icona: tabler:snowflake-off
    priorita: 60
    badge: false
    valore: assente
    categorie: [condizionatore_portatile, condizionatore, deumidificatore]
  ruote_pivotanti:
    label: "{valore} ruote pivotanti"
    icona: tabler:circle-dot
    priorita: 50
    badge: false
    valore: obbligatorio
    categorie: [condizionatore_portatile, deumidificatore]
  kit_finestra:
    label: "Kit installazione finestra incluso"
    icona: tabler:window
    priorita: 45
    badge: false
    valore: assente
    categorie: [condizionatore_portatile]
```

Clima — ventilatore:

```yaml
  oscillazione:
    label: "Oscillazione"
    icona: tabler:arrows-horizontal
    priorita: 80
    badge: false
    valore: assente
    categorie: [ventilatore]
  pale_diametro:
    label: "Pale Ø {valore} cm"
    icona: tabler:propeller
    priorita: 72
    badge: false
    valore: obbligatorio
    categorie: [ventilatore]
  testa_inclinabile:
    label: "Testa inclinabile"
    icona: tabler:angle
    priorita: 70
    badge: false
    valore: assente
    categorie: [ventilatore]
  altezza_regolabile:
    label: "Altezza regolabile"
    icona: tabler:arrows-move-vertical
    priorita: 68
    badge: false
    valore: assente
    categorie: [ventilatore]
  velocita_ventilazione:
    label: "{valore} velocità"
    icona: tabler:wind-electricity
    priorita: 66
    badge: false
    valore: obbligatorio
    categorie: [ventilatore, condizionatore_portatile]
  griglia_protezione:
    label: "Griglia di protezione"
    icona: tabler:grid-dots
    priorita: 55
    badge: false
    valore: assente
    categorie: [ventilatore]
```

Clima — condivise e split fisso:

```yaml
  funzione_inverter:
    label: "Funzione inverter"
    icona: tabler:refresh
    priorita: 75
    badge: false
    valore: assente
    categorie: [condizionatore]
  pompa_calore:
    label: "Pompa di calore"
    icona: tabler:flame
    priorita: 74
    badge: false
    valore: assente
    categorie: [condizionatore]
  timer_ore:
    label: "Timer {valore}H"
    icona: tabler:clock
    priorita: 62
    badge: false
    valore: obbligatorio
    categorie: [condizionatore_portatile, ventilatore, deumidificatore, condizionatore]
  connettivita_wifi:
    label: "WiFi"
    icona: tabler:wifi
    priorita: 60
    badge: false
    valore: assente
    categorie: [condizionatore]
  telecomando_incluso:
    label: "Telecomando incluso"
    icona: tabler:device-remote
    priorita: 58
    badge: false
    valore: assente
    categorie: [condizionatore_portatile, ventilatore, condizionatore]
```

Nota: `sbrinamento_automatico` e `pompa_calore` riusano rispettivamente `tabler:snowflake-off` e `tabler:flame`, già usate da `no_frost`/`alimentazione_carbonella`. È corretto: le icone sono keyed per chiave feature, non per id iconify — nessun conflitto.

- [ ] **Step 4: Esegui (passa)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: PASS (5 test). `dict.version === 2`; `Object.keys(dict.features).length` = 44 (≥ 20). I test `'ogni feature con valore obbligatorio ha {valore}'`, `'ogni categoria referenziata esiste'` e `'id icona nel formato set:nome'` restano verdi per le nuove chiavi.

- [ ] **Step 5: Verifica golden determinismo (resta verde senza rigenerare)**

Run: `npx vitest run tests/render-svg.test.ts`
Expected: PASS. Il golden (`tests/fixtures/render-2137070.svg`, categoria barbecue) è byte-identico per costruzione: `render-svg.test.ts` non carica il dizionario (usa una scene-fixture e un `deps.icon` mockato), quindi il bump versione non lo tocca. **Non** rigenerare la fixture.

- [ ] **Step 6: `tsc` + suite completa + commit**

```bash
npx tsc --noEmit
npm test
git add dictionary/features.yaml tests/dictionary.test.ts
git commit -m "feat(dizionario): 21 chiavi clima (modalità, capacità, ventilatore, split fisso) — features v2"
```

Expected: `tsc` pulito, `npm test` verde.

---

### Task 3: Chiavi feature arredo in `features.yaml`

Aggiunge le 12 chiavi arredo (spec §6, sezioni "Arredo — esterno e interno (condivise)" e "Arredo — interno (specchi e mobili)"), portando il totale a 33 nuove chiavi. Nessun bump versione (già a 2 dal Task 2).

**Files:**
- Modify: `dictionary/features.yaml`

**Interfaces:**
- Consumes: `loadDictionary()`. Le nuove chiavi referenziano `arredo_esterno` e `arredo_interno` (esistenti).
- Produces: 12 nuove chiavi; `dict.features` totale 56 (23 originali + 33 nuove).

- [ ] **Step 1: Aggiungi le 12 chiavi arredo**

In coda a `dictionary/features.yaml` (dopo le chiavi clima del Task 2), incolla i due blocchi — valori esatti dalla spec §6:

Arredo — esterno e interno (condivise):

```yaml
  struttura_ferro:
    label: "Struttura in ferro"
    icona: tabler:fence
    priorita: 61
    badge: false
    valore: assente
    categorie: [arredo_esterno, arredo_interno]
  struttura_alluminio:
    label: "Struttura in alluminio"
    icona: tabler:building
    priorita: 60
    badge: false
    valore: assente
    categorie: [arredo_esterno]
  piedini_antiscivolo:
    label: "Piedini antiscivolo"
    icona: tabler:grip-horizontal
    priorita: 52
    badge: false
    valore: assente
    categorie: [arredo_esterno, arredo_interno]
  richiudibile:
    label: "Richiudibile e salvaspazio"
    icona: tabler:fold
    priorita: 55
    badge: false
    valore: assente
    categorie: [arredo_esterno, arredo_interno]
  copertura_poliestere:
    label: "Copertura in poliestere"
    icona: tabler:shirt
    priorita: 45
    badge: false
    valore: assente
    categorie: [arredo_esterno]
  top_ceramica:
    label: "Top in ceramica"
    icona: tabler:circle-square
    priorita: 68
    badge: false
    valore: assente
    categorie: [arredo_esterno]
  design_moderno:
    label: "Design moderno"
    icona: tabler:sparkles
    priorita: 35
    badge: false
    valore: assente
    categorie: [arredo_interno, arredo_esterno]
```

Arredo — interno (specchi e mobili):

```yaml
  specchio_figura_intera:
    label: "Specchio a figura intera"
    icona: tabler:rectangle-vertical
    priorita: 80
    badge: false
    valore: assente
    categorie: [arredo_interno]
  cornice_legno:
    label: "Cornice in legno MDF"
    icona: tabler:frame
    priorita: 65
    badge: false
    valore: assente
    categorie: [arredo_interno]
  apertura_cavalletto:
    label: "Apertura a cavalletto"
    icona: tabler:triangle
    priorita: 60
    badge: false
    valore: assente
    categorie: [arredo_interno]
  vano_contenitore:
    label: "Doppio vano interno"
    icona: tabler:box
    priorita: 55
    badge: false
    valore: assente
    categorie: [arredo_interno]
  portata_ripiano:
    label: "Portata {valore} kg per ripiano"
    icona: tabler:stack-2
    priorita: 50
    badge: false
    valore: obbligatorio
    categorie: [arredo_interno]
```

- [ ] **Step 2: Verifica `schienale_reclinabile` (nessuna modifica attesa)**

La spec §6 "Modifiche a chiavi esistenti" chiede di aggiungere `arredo_esterno` a `schienale_reclinabile` **se non già presente**. Verifica: in `features.yaml` la chiave `schienale_reclinabile` ha già `categorie: [sedia_ufficio_gaming, arredo_esterno]`. È **già presente** → nessuna modifica. Non toccare le altre 23 chiavi esistenti.

- [ ] **Step 3: Esegui + `tsc`**

Run: `npx vitest run tests/dictionary.test.ts && npx tsc --noEmit`
Expected: PASS. `Object.keys(dict.features).length` = 56. Tutte le categorie referenziate (`arredo_esterno`, `arredo_interno`) esistono → `'ogni categoria referenziata esiste'` verde. Le chiavi con `{valore}` (`portata_ripiano`) rispettano `valore: obbligatorio`.

- [ ] **Step 4: Suite completa + golden + commit**

```bash
npm test
git add dictionary/features.yaml
git commit -m "feat(dizionario): 12 chiavi arredo (struttura, specchi, mobili) — 33 nuove chiavi totali"
```

Expected: `npm test` verde, incluso `render-svg.test.ts` (golden barbecue invariato).

---

### Task 4: Seeding + approvazione delle 33 icone da Iconify

Le nuove chiavi hanno `icona: tabler:*` già verificate esistenti (spec §3). `scripts/seed-icons.ts` scarica/normalizza/salva **in-revisione**; l'export usa solo `getApprovedIcon` (regola d'oro §7), quindi le 33 icone vanno **approvate**. Oggi `seed-icons.ts` non approva → si aggiunge un flag `--approve` che approva le icone appena create.

**Rete richiesta:** questo task chiama `api.iconify.design` (download SVG). Se la rete la blocca (vedi memoria: ESET blocca Iconify su rete Galileo — ticket IT), segnalare **BLOCKED** e riprovare quando la rete è raggiungibile. Non blocca i test automatici (offline) dei Task 1-3.

**Files:**
- Modify: `scripts/seed-icons.ts`

**Interfaces:**
- Consumes: `loadDictionary`, `fetchIconifySvg`/`searchIconify` da `@/lib/icons/iconify`, `saveIcon`/`getIcon`/`approveIcon` da `@/lib/icons/repository`.
- Produces: DB `icon` con 56 righe `approvata` (23 preesistenti + 33 nuove). `saveIcon` normalizza; `approveIcon(key)` porta lo status ad `approvata`.

- [ ] **Step 1: Aggiungi il flag `--approve` a `seed-icons.ts`**

In `scripts/seed-icons.ts`:

1. Aggiungi `approveIcon` all'import del repository:

```ts
  const { saveIcon, getIcon, approveIcon } = await import('@/lib/icons/repository')
```

2. Dopo `const keys = Object.keys(dict.features).sort()`, leggi il flag:

```ts
  const approva = process.argv.includes('--approve')
```

3. Dentro il blocco `try`, subito dopo `await saveIcon({ ... })` e prima di `creati++`, aggiungi:

```ts
      if (approva) await approveIcon(key)
```

4. Aggiorna la riga finale di log per riflettere l'approvazione:

```ts
  console.error(`\nSeeding completato: ${creati} create${approva ? ' e approvate' : ''}, ${saltati} già presenti.`)
```

`getIcon(key)` salta le chiavi che hanno già un'icona in qualsiasi stato: le 23 preesistenti (già approvate dalla Fase 3d) vengono saltate, solo le 33 nuove vengono scaricate e approvate.

- [ ] **Step 2: `tsc` sullo script**

Run: `npx tsc --noEmit`
Expected: pulito.

- [ ] **Step 3: Esegui il seeding con approvazione (rete)**

Run: `npm run seed:icons -- --approve`
Expected (stdout su stderr): 33 righe `✓ <chiave> ← tabler:<name>` per le nuove chiavi, nessuna riga `✗`, e in coda `Seeding completato: 33 create e approvate, 23 già presenti.`

Se compaiono righe `✗` (icona non scaricabile): riesegui il comando (le già-create verranno saltate); se persistono, annota quale icona ha fallito — potrebbe essere un id `tabler:*` errato nella spec (improbabile: verificate 2026-07-09).

- [ ] **Step 4: Verifica idempotenza + stato approvato**

Riesegui: `npm run seed:icons -- --approve`
Expected: `Seeding completato: 0 create e approvate, 56 già presenti.` (tutte già presenti → 0 nuovi download).

Verifica visiva dello stato su `/icone` (griglia approvazione, Fase 3d): avvia `npm run dev`, apri `/icone`, conferma che le 33 nuove chiavi compaiono **approvata** (bordo non ambra, nessun pulsante "Approva"). In alternativa, se resta qualche `in-revisione`, usa "Approva tutte" nella pagina `/icone`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-icons.ts
git commit -m "feat(seed-icons): flag --approve per approvare le icone appena create (export usa solo approvate)"
```

(Il DB icone è locale/non versionato: si committa solo la modifica allo script. Il seeding va rieseguito in ogni ambiente prima dell'export/benchmark.)

---

### Task 5: Validazione benchmark end-to-end sui 3 SKU

Ri-esegue la pipeline reale (`npm run compose`) sui 3 SKU benchmark e conferma il passaggio a "buona" (spec §7). `compose.ts` fa: refresh feed → `extractProposal` (Gemini) → compose scene → risoluzione icone via `getApprovedIcon` → export JPEG.

**Rete + chiave richieste:** serve `GEMINI_API_KEY` reale (in `.env`/`.env.local`) e rete verso il feed e Gemini. Le icone devono essere già approvate (Task 4). Se chiave/rete non disponibili, segnalare **BLOCKED**; i Task 1-4 restano validi/committati.

**Nota cache:** con `dict.version` ora a 2, `computeInputHash` cambia → i 3 SKU si ri-estraggono (nessun hit di cache vecchia). Comportamento atteso.

**Files:**
- Nessuna modifica. Task di sola validazione.

**Interfaces:**
- Consumes: `npm run compose -- <SKU>`, dizionario v2, DB icone approvato (Task 4).
- Produces: 3 JPEG esportati; conferma feature-count per SKU.

- [ ] **Step 1: Condizionatore portatile 5925927**

Run: `npm run compose -- 5925927`
Expected: `Scheda esportata: <path>.jpg`. Aprendo il JPEG, la scheda deve mostrare **≥6 feature** in colonna più il **badge BTU** vicino alla foto. Categoria attesa: `condizionatore_portatile`. Feature attese (spec §7): modalita_raffresca, modalita_deumidifica, modalita_ventila, potenza_btu (7000, badge), capacita_deumidificazione (19,2), intervallo_temperatura (15-31°C), timer_ore (24), telecomando_incluso, capacita_serbatoio (0,43), ruote_pivotanti (4), kit_finestra, sbrinamento_automatico, + classe_energetica/lunghezza_cavo esistenti.

- [ ] **Step 2: Tavolo mosaico 2195799**

Run: `npm run compose -- 2195799`
Expected: `Scheda esportata: <path>.jpg`. Categoria attesa: `arredo_esterno`. **≥4 feature** attese (spec §7): struttura_ferro, top_ceramica, piedini_antiscivolo, uso_interno_esterno (esistente). Nota: le quote Ø restano assenti (fix parser dimensioni fuori scope, spec §2/§9) — non è un fallimento del task.

- [ ] **Step 3: Specchio figura intera 5922547**

Run: `npm run compose -- 5922547`
Expected: `Scheda esportata: <path>.jpg`. Categoria attesa: `arredo_interno`. **≥3 feature** attese (spec §7): specchio_figura_intera, cornice_legno, apertura_cavalletto, struttura_ferro.

- [ ] **Step 4: Conferma esito e chiudi**

Verifica che tutti e 3 gli SKU raggiungano la soglia (condizionatore ≥6, tavolino ≥4, specchio ≥3 feature pertinenti e corrette, spec §1). Se un SKU è sotto soglia: ispeziona l'output di `npm run propose -- <SKU>` (JSON grezzo) per capire se il problema è classificazione categoria, estrazione feature mancante, o icona non approvata (segnaposto in scheda) — e annota la causa. Nessun commit di codice (solo validazione); se servono correzioni al dizionario, aprire un follow-up mirato.

---

## Criteri di completamento

- `dictionary/categories.yaml` e `dictionary/features.yaml` sono a `version: 2`; 3 nuove categorie clima e 33 nuove chiavi feature presenti, con valori esatti come da spec §5/§6.
- `dictionary.test.ts` verde: schema valido, `dict.version === 2`, nuove categorie presenti, ogni categoria referenziata esiste, icone in forma `set:name`, coerenza `{valore}`/`valore`.
- `render-svg.test.ts` verde e golden barbecue **byte-identico** (nessuna rigenerazione fixture): nessuna nuova chiave tocca `barbecue`.
- `npm test` verde e `npx tsc --noEmit` pulito su tutto il branch.
- Le 33 icone `tabler:*` sono scaricate e in stato **approvata** (verificato su `/icone`); l'export le usa (regola d'oro §7).
- Benchmark end-to-end: 5925927 ≥6 feature (+ badge BTU), 2195799 ≥4, 5922547 ≥3 — schede "buone" (subordinato a `GEMINI_API_KEY` + rete; se BLOCKED, annotato).
- Nessun file sotto `src/` modificato (motore, loader, types, gemini, ranking, render intatti).

## Note per fasi successive (backlog residuo, spec §9)

- Fix parser dimensioni formato diametro `Ø` (quote dei prodotti tondi — tavolo/ventilatore).
- Espansione dizionario alle restanti 11 categorie verso il target 100-150 chiavi.
- Rifinitura estetica delle icone Tabler approssimative.
- Titolo scheda: formattare/rimuovere la chiave categoria grezza.
- Rivedere la licenza del set `solar` in `ICONIFY_SETS` (CC BY 4.0 → attribuzione).
