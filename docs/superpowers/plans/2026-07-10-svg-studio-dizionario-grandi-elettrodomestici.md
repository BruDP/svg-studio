# SVG Studio — Espansione dizionario: grandi elettrodomestici Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliare il dizionario data-driven (spec §6) con 21 nuove chiavi feature per lavatrice, forno, frigorifero, congelatore, aspirapolvere, più 3 estensioni di categoria a chiavi esistenti (spec §5), così che 5 prodotti reali (uno per categoria) producano schede ricche (≥5 feature pertinenti ciascuno) senza toccare il motore.

**Architecture:** Nessun nuovo componente. Si estende `dictionary/features.yaml` (21 nuove chiavi + 3 categorie aggiuntive su chiavi esistenti) e si bumpa `PROMPT_VERSION` in `src/lib/extraction/types.ts`. La pipeline consuma le nuove voci da sé: l'enum Gemini `chiave` deriva da `Object.keys(dict.features).sort()` (`src/lib/extraction/gemini.ts`), il ranking filtra su `priorita`/`categorie` (`src/lib/extraction/ranking.ts`), il render risolve le icone per chiave dal DB (solo `approvata`, `getApprovedIcon`). `categories.yaml` non cambia: le 5 categorie di grandi elettrodomestici esistono già.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Prisma/SQLite, YAML + zod. Iconify (`tabler`) per il seeding icone (già scaricate e verificate esistenti, spec §3). `@google/genai` (Gemini) per l'estrazione. Riusa Fasi 1/2/3a-3d e il lotto dizionario 2026-07-09 immutati.

## Global Constraints

Copiati verbatim dalla spec §3 (valori esatti):

- **Golden determinismo intatto**: nessuna nuova chiave né modifica applicabile a `barbecue`. La fixture golden (SKU 2137070, barbecue) resta byte-identica. Il test golden usa una proposta hardcoded (`materiale_acciaio` + `montaggio_facile`) → non toccata.
- **Bump versione + PROMPT_VERSION**: `features.yaml` passa a `version: 4`. `PROMPT_VERSION` (in `src/lib/extraction/types.ts`) passa da 2 a 3 → invalida la cache estrazioni, così i prodotti già estratti (frigo/lavatrice/ecc.) si ri-estraggono con il dizionario ampliato. `categories.yaml` resta a `version: 2` (nessuna nuova categoria: le 5 esistono già).
- **Test CI dizionario verde**: `tests/dictionary.test.ts` valida schema, assenza duplicati, categorie referenziate esistenti, icone `set:name`, coerenza `{valore}`↔`valore`. Aggiornare l'asserzione `dict.version` a 4.
- **Icone verificate ed esistenti**: tutte le icone `tabler:*` proposte sono state verificate esistenti su Iconify (2026-07-10). Vanno **approvate** (regola d'oro §7): l'export usa solo `getApprovedIcon`.
- **Nessuna modifica al motore**: `renderScene`, `scene/*`, engine/ranking, template invariati. Si toccano solo `dictionary/features.yaml`, `src/lib/extraction/types.ts` (PROMPT_VERSION), `tests/dictionary.test.ts`.
- **Riuso DRY**: dove una chiave esistente è pertinente, si estende il suo array `categorie` invece di crearne una nuova.

Vincoli aggiuntivi verificati sul codebase (da rispettare):

- **`dictionary/features.yaml` è oggi a `version: 3`, 59 chiavi.** Dopo questo lotto: `version: 4`, 80 chiavi (59 + 21 nuove; le 3 modifiche di categoria non aggiungono chiavi).
- **`dict.version` deriva da `features.yaml`** (`src/lib/dictionary/loader.ts`, `loadDictionary` ritorna `version: feats.version`). L'asserzione in `tests/dictionary.test.ts` va portata a `4` nello stesso task che bumpa `features.yaml`.
- **`PROMPT_VERSION` è oggi `2`** (`src/lib/extraction/types.ts:16`, bump precedente per `parseDimensions`/formato Ø). Va a `3`. Entra in `computeInputHash` (`src/lib/extraction/engine.ts:20-28`) insieme a `dictVersion` e `dictKeys` → qualunque dei due bump già invaliderebbe la cache da solo; li facciamo comunque insieme perché entrambi riflettono l'allargamento del dizionario in questo lotto.
- **`scripts/seed-icons.ts` supporta già `--approve`** (aggiunto nel lotto 2026-07-09): nessuna modifica di codice necessaria per il seeding di questo lotto, solo esecuzione.
- **Nessuna nuova categoria**: `dictionary/categories.yaml` resta `version: 2`, invariato — non è nella File Structure di questo piano.
- **Icone: `set:name` sui set ammessi**: `ICONIFY_SETS = ['tabler', 'lucide', 'solar']`. Tutte le 21 nuove icone sono `tabler:*` → valide.
- **UI/commenti/commit in italiano. Node 20+, npm. Alias `@/* → src/*`. `.gitattributes` LF invariato.**

---

## Modello di esecuzione per-task

Come nei lotti precedenti: il grosso è trascrizione dei valori esatti dalla spec.

| Task | Contenuto | Esecuzione suggerita | Review |
|---|---|---|---|
| 1 | Modifiche categoria a 3 chiavi esistenti + bump `features.yaml` a v4 + bump `PROMPT_VERSION` a 3 + test | Sonnet (giudizio su versioning/cache) | Sonnet |
| 2 | Chiavi lavatrice (7) + forno (5) — 12 chiavi | Haiku (trascrizione) | Sonnet |
| 3 | Chiavi frigo/congelatore condivise (4) + aspirapolvere (5) — 9 chiavi | Haiku (trascrizione) | Sonnet |
| 4 | Seeding + approvazione 21 icone (rete) | Sonnet (rete) | Sonnet |
| 5 | Validazione end-to-end 5 SKU, uno per categoria (rete + Gemini) | Sonnet | Sonnet |

Review finale whole-branch: **Opus**.

---

## File Structure

```
dictionary/
  features.yaml            # Task 1 — version 4; 3 chiavi esistenti estendono `categorie`
                            # Task 2 — +12 chiavi lavatrice/forno
                            # Task 3 — +9 chiavi frigo/congelatore/aspirapolvere (21 nuove totali, 80 chiavi)
  categories.yaml           # INVARIATO — resta version 2, nessuna nuova categoria
src/lib/extraction/
  types.ts                  # Task 1 — PROMPT_VERSION 2 → 3
tests/
  dictionary.test.ts        # Task 1 — dict.version === 4 + asserzioni sulle 3 chiavi modificate
scripts/
  seed-icons.ts             # Task 4 — invariato (--approve già presente), solo eseguito
```

Nessun file sotto `src/lib/dictionary`, `src/lib/extraction/{gemini,ranking,validator,dimensions}.ts`, `src/lib/render`, `src/lib/scene` cambia: gli enum si allargano da soli dal dizionario.

---

### Task 1: Modifiche di categoria a chiavi esistenti + bump versioni

Estende `categorie` su 3 chiavi esistenti (spec §5, riuso DRY) e bumpa `features.yaml` a `version: 4` e `PROMPT_VERSION` a `3`. Questo invalida la cache estrazioni per tutti i prodotti (atteso).

**Files:**
- Modify: `dictionary/features.yaml`
- Modify: `src/lib/extraction/types.ts:16`
- Test: `tests/dictionary.test.ts`

**Interfaces:**
- Consumes: `loadDictionary()` da `@/lib/dictionary/loader` (nessuna firma cambia). `computeInputHash` da `@/lib/extraction/engine.ts` (consuma `PROMPT_VERSION`, nessuna firma cambia).
- Produces: `dict.version === 4`. `dict.features.capacita_litri.categorie` include `forno`; `dict.features.sbrinamento_automatico.categorie` include `frigorifero` e `congelatore`; `dict.features.piedini_antiscivolo.categorie` include `forno`. `PROMPT_VERSION === 3`.

- [ ] **Step 1: Aggiungi le asserzioni che falliscono**

In `tests/dictionary.test.ts`, nel test `'il dizionario reale carica e valida'`, cambia:

```ts
  expect(dict.version).toBe(3)
```

in:

```ts
  expect(dict.version).toBe(4)
```

e aggiungi, subito dopo `expect(dict.categorie).toContain('deumidificatore')`:

```ts
  expect(dict.features.capacita_litri.categorie).toContain('forno')
  expect(dict.features.sbrinamento_automatico.categorie).toContain('frigorifero')
  expect(dict.features.sbrinamento_automatico.categorie).toContain('congelatore')
  expect(dict.features.piedini_antiscivolo.categorie).toContain('forno')
```

- [ ] **Step 2: Esegui (fallisce)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: FAIL su `'il dizionario reale carica e valida'` — `dict.version` è ancora 3 e `forno` non è nelle `categorie` di `capacita_litri`. Gli altri 4 test restano verdi.

- [ ] **Step 3: Bump versione di `features.yaml`**

In `dictionary/features.yaml`, cambia la prima riga:

```yaml
version: 3
```

in:

```yaml
version: 4
```

- [ ] **Step 4: Estendi `categorie` su `capacita_litri`**

Riga attuale (riga 23 del file, invariata a parte `categorie`):

```yaml
    categorie: [frigorifero, congelatore, valigie, aspirapolvere, piccoli_elettrodomestici]
```

Sostituiscila con:

```yaml
    categorie: [frigorifero, congelatore, valigie, aspirapolvere, piccoli_elettrodomestici, forno]
```

- [ ] **Step 5: Estendi `categorie` su `sbrinamento_automatico`**

Riga attuale (nel blocco `sbrinamento_automatico`, quello con `icona: tabler:snowflake-off` e `priorita: 60`):

```yaml
    categorie: [condizionatore_portatile, condizionatore, deumidificatore]
```

Sostituiscila con:

```yaml
    categorie: [condizionatore_portatile, condizionatore, deumidificatore, frigorifero, congelatore]
```

- [ ] **Step 6: Estendi `categorie` su `piedini_antiscivolo`**

Riga attuale (nel blocco `piedini_antiscivolo`, quello con `icona: tabler:grip-horizontal`):

```yaml
    categorie: [arredo_esterno, arredo_interno]
```

Sostituiscila con:

```yaml
    categorie: [arredo_esterno, arredo_interno, forno]
```

- [ ] **Step 7: Bump `PROMPT_VERSION`**

Sostituisci l'intero contenuto di `src/lib/extraction/types.ts` con:

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

// Versione della pipeline di estrazione (entra in computeInputHash → invalida la cache
// quando cambia la logica che determina la proposta). Bump a 3: il dizionario si amplia
// con le 21 chiavi grandi elettrodomestici (spec 2026-07-10) e 3 chiavi esistenti estendono
// le categorie applicabili, quindi le estrazioni cache dei prodotti frigo/lavatrice/forno/
// congelatore/aspirapolvere vanno ricalcolate con il dizionario ampliato.
export const PROMPT_VERSION = 3
```

- [ ] **Step 8: Esegui (passa)**

Run: `npx vitest run tests/dictionary.test.ts`
Expected: PASS (5 test). `dict.version === 4`; le 3 asserzioni sulle `categorie` estese sono verdi.

- [ ] **Step 9: Verifica golden determinismo (resta verde senza rigenerare)**

Run: `npx vitest run tests/render-svg.test.ts tests/layout-colonna-sinistra.test.ts`
Expected: PASS. Il golden (`tests/fixtures/render-2137070.svg`, categoria barbecue) è byte-identico per costruzione: nessuna delle 3 modifiche di categoria tocca `barbecue`, e questi test non caricano il dizionario reale (usano una scene-fixture e `deps.icon` mockato). **Non** rigenerare la fixture.

- [ ] **Step 10: `tsc` + suite completa + commit**

```bash
npx tsc --noEmit
npm test
git add dictionary/features.yaml src/lib/extraction/types.ts tests/dictionary.test.ts
git commit -m "feat(dizionario): estendi categorie di capacita_litri/sbrinamento_automatico/piedini_antiscivolo a forno/frigo/congelatore — features v4, PROMPT_VERSION 3"
```

Expected: `tsc` pulito, `npm test` verde (incluso golden barbecue invariato).

---

### Task 2: Chiavi lavatrice + forno in `features.yaml` (12 chiavi)

Aggiunge le 7 chiavi lavatrice e le 5 chiavi forno (spec §6). Nessun bump versione (già a 4 dal Task 1).

**Files:**
- Modify: `dictionary/features.yaml`

**Interfaces:**
- Consumes: `loadDictionary()`. Le nuove chiavi referenziano `lavatrice` e `forno` (esistenti in `categories.yaml`).
- Produces: 12 nuove chiavi; `dict.features` totale 71 (59 + 12).

- [ ] **Step 1: Aggiungi le 7 chiavi lavatrice**

In coda a `dictionary/features.yaml` (dopo `decoro_mosaico`, mantenendo l'indentazione a 2 spazi per la chiave e 4 per i campi), incolla — valori esatti dalla spec §6 (`badge: sì` → `true`, `badge: no` → `false`):

```yaml
  capacita_carico_kg:
    label: "{valore} kg di carico"
    icona: tabler:wash-machine
    priorita: 88
    badge: true
    valore: obbligatorio
    categorie: [lavatrice]
  velocita_centrifuga:
    label: "Centrifuga {valore} giri"
    icona: tabler:rotate-clockwise-2
    priorita: 75
    badge: false
    valore: obbligatorio
    categorie: [lavatrice]
  lavaggio_vapore:
    label: "Lavaggio a vapore"
    icona: tabler:steam
    priorita: 70
    badge: false
    valore: assente
    categorie: [lavatrice]
  lavaggio_rapido:
    label: "Lavaggio rapido"
    icona: tabler:bolt
    priorita: 68
    badge: false
    valore: assente
    categorie: [lavatrice]
  carico_frontale:
    label: "Carico frontale"
    icona: tabler:door
    priorita: 55
    badge: false
    valore: assente
    categorie: [lavatrice]
  blocco_bambini:
    label: "Blocco sicurezza bambini"
    icona: tabler:lock
    priorita: 50
    badge: false
    valore: assente
    categorie: [lavatrice, forno]
  avvio_ritardato:
    label: "Avvio ritardato"
    icona: tabler:clock-pause
    priorita: 45
    badge: false
    valore: assente
    categorie: [lavatrice]
```

- [ ] **Step 2: Aggiungi le 5 chiavi forno**

Subito dopo, nello stesso file:

```yaml
  termostato_regolabile:
    label: "Termostato regolabile"
    icona: tabler:temperature
    priorita: 72
    badge: false
    valore: assente
    categorie: [forno]
  timer_cottura:
    label: "Timer di cottura"
    icona: tabler:clock
    priorita: 65
    badge: false
    valore: assente
    categorie: [forno]
  vetro_temperato:
    label: "Sportello in vetro temperato"
    icona: tabler:window
    priorita: 60
    badge: false
    valore: assente
    categorie: [forno]
  pareti_antiaderenti:
    label: "Pareti interne antiaderenti"
    icona: tabler:droplet-off
    priorita: 58
    badge: false
    valore: assente
    categorie: [forno]
  segnale_acustico:
    label: "Segnale acustico di fine cottura"
    icona: tabler:bell
    priorita: 38
    badge: false
    valore: assente
    categorie: [forno]
```

Nota riuso icone (nessun conflitto, keyed per chiave feature, categorie disgiunte dalla chiave che già la usa): `termostato_regolabile` riusa `tabler:temperature` (già `intervallo_temperatura`, categorie clima); `timer_cottura` riusa `tabler:clock` (già `timer_ore`, categorie clima); `vetro_temperato` riusa `tabler:window` (già `kit_finestra`, categoria `condizionatore_portatile`).

- [ ] **Step 3: Esegui + `tsc`**

Run: `npx vitest run tests/dictionary.test.ts && npx tsc --noEmit`
Expected: PASS (5 test), `tsc` pulito. `Object.keys(dict.features).length` = 71. Le categorie referenziate (`lavatrice`, `forno`) esistono → `'ogni categoria referenziata esiste'` verde. Le chiavi con `{valore}` (`capacita_carico_kg`, `velocita_centrifuga`) rispettano `valore: obbligatorio`; tutte le altre 10 hanno `valore: assente` e nessun `{valore}` in label.

- [ ] **Step 4: Suite completa + golden + commit**

```bash
npm test
git add dictionary/features.yaml
git commit -m "feat(dizionario): 12 chiavi lavatrice e forno (carico, centrifuga, vapore, termostato, vetro temperato...)"
```

Expected: `npm test` verde, incluso `render-svg.test.ts` (golden barbecue invariato: nessuna delle 12 chiavi referenzia `barbecue`).

---

### Task 3: Chiavi frigo/congelatore condivise + aspirapolvere in `features.yaml` (9 chiavi)

Aggiunge le 4 chiavi condivise frigorifero/congelatore e le 5 chiavi aspirapolvere (spec §6), portando il totale a 21 nuove chiavi (80 nel dizionario). Nessun bump versione (già a 4 dal Task 1).

**Files:**
- Modify: `dictionary/features.yaml`

**Interfaces:**
- Consumes: `loadDictionary()`. Le nuove chiavi referenziano `frigorifero`, `congelatore`, `forno`, `lavatrice`, `aspirapolvere` (tutte esistenti).
- Produces: 9 nuove chiavi; `dict.features` totale 80 (71 + 9).

- [ ] **Step 1: Aggiungi le 4 chiavi frigo/congelatore condivise**

In coda a `dictionary/features.yaml` (dopo `segnale_acustico` del Task 2):

```yaml
  efficienza_congelamento:
    label: "Congelamento {valore} stelle"
    icona: tabler:stars
    priorita: 80
    badge: false
    valore: obbligatorio
    categorie: [congelatore, frigorifero]
  funzionamento_silenzioso:
    label: "Silenzioso {valore} dB"
    icona: tabler:volume-3
    priorita: 76
    badge: false
    valore: obbligatorio
    categorie: [frigorifero, congelatore, lavatrice]
  piedini_regolabili:
    label: "Piedini regolabili"
    icona: tabler:adjustments
    priorita: 48
    badge: false
    valore: assente
    categorie: [frigorifero, congelatore]
  illuminazione_interna:
    label: "Luce interna"
    icona: tabler:bulb
    priorita: 42
    badge: false
    valore: assente
    categorie: [forno, frigorifero, congelatore]
```

- [ ] **Step 2: Aggiungi le 5 chiavi aspirapolvere**

Subito dopo, nello stesso file:

```yaml
  senza_fili:
    label: "Senza fili, ricaricabile"
    icona: tabler:battery-charging
    priorita: 82
    badge: false
    valore: assente
    categorie: [aspirapolvere]
  autonomia_minuti:
    label: "Autonomia {valore} minuti"
    icona: tabler:clock-play
    priorita: 80
    badge: false
    valore: obbligatorio
    categorie: [aspirapolvere]
  filtro_hepa:
    label: "Filtro HEPA lavabile"
    icona: tabler:filter
    priorita: 78
    badge: false
    valore: assente
    categorie: [aspirapolvere]
  spazzola_motorizzata:
    label: "Spazzola motorizzata"
    icona: tabler:vacuum-cleaner
    priorita: 70
    badge: false
    valore: assente
    categorie: [aspirapolvere]
  doppio_uso_aspira:
    label: "Anche aspiratutto a mano"
    icona: tabler:hand-stop
    priorita: 60
    badge: false
    valore: assente
    categorie: [aspirapolvere]
```

Nota riuso icona: `illuminazione_interna` riusa `tabler:bulb` (già `led_rgb`, categorie `sedia_ufficio_gaming`/`arredo_interno`) — categorie disgiunte, nessun conflitto sulla stessa scheda.

- [ ] **Step 3: Esegui + `tsc`**

Run: `npx vitest run tests/dictionary.test.ts && npx tsc --noEmit`
Expected: PASS (5 test), `tsc` pulito. `Object.keys(dict.features).length` = 80. Tutte le categorie referenziate esistono. `efficienza_congelamento`, `funzionamento_silenzioso`, `autonomia_minuti` hanno `{valore}` in label e `valore: obbligatorio`; le altre 6 hanno `valore: assente` senza placeholder.

- [ ] **Step 4: Suite completa + golden + commit**

```bash
npm test
git add dictionary/features.yaml
git commit -m "feat(dizionario): 9 chiavi frigo/congelatore condivise e aspirapolvere — 21 nuove chiavi totali (dizionario a 80)"
```

Expected: `npm test` verde, incluso `render-svg.test.ts` (golden barbecue invariato). A questo punto il dizionario è completo per questo lotto: `version: 4`, 80 chiavi.

---

### Task 4: Seeding + approvazione delle 21 icone da Iconify

Le 21 nuove chiavi hanno `icona: tabler:*` già verificate esistenti (spec §3). `scripts/seed-icons.ts` supporta già il flag `--approve` (introdotto nel lotto 2026-07-09): nessuna modifica di codice è necessaria in questo task, solo l'esecuzione del seeding.

**Rete richiesta:** questo task chiama `api.iconify.design` (download SVG). Se la rete la blocca, segnalare **BLOCKED** e riprovare quando la rete è raggiungibile (vedi memoria: il blocco Iconify sulla rete Galileo era stato risolto il 2026-07-09). Non blocca i test automatici (offline) dei Task 1-3.

**Files:**
- Nessuna modifica. Task di sola esecuzione.

**Interfaces:**
- Consumes: `loadDictionary`, `fetchIconifySvg`/`searchIconify` da `@/lib/icons/iconify`, `saveIcon`/`getIcon`/`approveIcon` da `@/lib/icons/repository` (tutte già usate da `seed-icons.ts`, nessuna firma cambia).
- Produces: DB icone con 80 righe `approvata` (59 preesistenti + 21 nuove). `getIcon(key)` salta le chiavi che hanno già un'icona in qualsiasi stato: le 59 preesistenti vengono saltate, solo le 21 nuove vengono scaricate e approvate.

- [ ] **Step 1: Esegui il seeding con approvazione (rete)**

Run: `npm run seed:icons -- --approve`
Expected (stdout su stderr): 21 righe `✓ <chiave> ← tabler:<name>` per le nuove chiavi (`capacita_carico_kg`, `velocita_centrifuga`, `lavaggio_vapore`, `lavaggio_rapido`, `carico_frontale`, `blocco_bambini`, `avvio_ritardato`, `termostato_regolabile`, `timer_cottura`, `vetro_temperato`, `pareti_antiaderenti`, `segnale_acustico`, `efficienza_congelamento`, `funzionamento_silenzioso`, `piedini_regolabili`, `illuminazione_interna`, `senza_fili`, `autonomia_minuti`, `filtro_hepa`, `spazzola_motorizzata`, `doppio_uso_aspira`), nessuna riga `✗`, e in coda `Seeding completato: 21 create e approvate, 59 già presenti.`

Se compaiono righe `✗` (icona non scaricabile): riesegui il comando (le già-create verranno saltate); se persistono, annota quale icona ha fallito — potrebbe essere un id `tabler:*` errato nella spec (improbabile: verificate 2026-07-10).

- [ ] **Step 2: Verifica idempotenza + stato approvato**

Riesegui: `npm run seed:icons -- --approve`
Expected: `Seeding completato: 0 create e approvate, 80 già presenti.` (tutte già presenti → 0 nuovi download).

Verifica visiva dello stato su `/icone` (griglia approvazione): avvia `npm run dev`, apri `/icone`, conferma che le 21 nuove chiavi compaiono **approvata** (bordo non ambra, nessun pulsante "Approva"). In alternativa, se resta qualche `in-revisione`, usa "Approva tutte" nella pagina `/icone`.

Nessun commit: task di sola esecuzione, nessun file di codice modificato in questo task (il DB icone è locale/non versionato).

---

### Task 5: Validazione end-to-end su 5 SKU (uno per categoria)

Ri-esegue la pipeline reale (`npm run compose`) su un prodotto reale per ciascuna delle 5 categorie (spec §7), scelto cercando nel feed i termini indicati, e conferma ≥5 feature pertinenti dove il testo del prodotto le contiene (metrica di successo, spec §1).

**Rete + chiave richieste:** serve `GEMINI_API_KEY` reale (in `.env`/`.env.local`) e rete verso il feed e Gemini. Le icone devono essere già approvate (Task 4). Se chiave/rete non disponibili, segnalare **BLOCKED**; i Task 1-4 restano validi/committati.

**Nota cache:** con `dict.version` ora a 4 e `PROMPT_VERSION` a 3, `computeInputHash` cambia per ogni prodotto → nessun hit di cache vecchia, tutti i 5 SKU si ri-estraggono. Comportamento atteso.

**Files:**
- Nessuna modifica. Task di sola validazione.

**Interfaces:**
- Consumes: `searchProducts(q)` da `@/lib/feed/repository` (per trovare uno SKU reale per categoria), `npm run compose -- <SKU>`, dizionario v4, DB icone approvato (Task 4).
- Produces: 5 JPEG esportati; conferma feature-count per SKU.

- [ ] **Step 1: Crea lo script temporaneo di ricerca SKU (non versionato)**

Crea `scripts/_find-sku.ts` (prefisso `_` per segnalare che è temporaneo, non va committato):

```ts
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const { refreshFeedIfStale } = await import('@/lib/feed/fetcher')
  const { searchProducts } = await import('@/lib/feed/repository')

  const q = process.argv[2]
  if (!q) {
    console.error('Uso: npx tsx scripts/_find-sku.ts <termine di ricerca>')
    process.exit(1)
  }

  await refreshFeedIfStale()
  const risultati = await searchProducts(q)
  console.log(JSON.stringify(risultati.slice(0, 5), null, 2))
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
```

- [ ] **Step 2: Trova uno SKU per ciascuna delle 5 categorie**

Esegui in sequenza (rete richiesta per il refresh feed alla prima chiamata):

```bash
npx tsx scripts/_find-sku.ts lavatrice
npx tsx scripts/_find-sku.ts "forno elettrico"
npx tsx scripts/_find-sku.ts "frigorifero combinato"
npx tsx scripts/_find-sku.ts congelatore
npx tsx scripts/_find-sku.ts aspirapolvere
```

Expected: ogni comando stampa un array JSON di massimo 5 risultati `{ sku, descrizioneBreve }` con corrispondenza nel testo. Da ciascun array, scegli il primo risultato la cui `descrizioneBreve` corrisponde chiaramente alla categoria cercata e annotane lo `sku` per lo step successivo. Se un termine non produce risultati, riprova con un sinonimo (es. "lavabiancheria" invece di "lavatrice").

- [ ] **Step 3: Genera la scheda per ciascuno dei 5 SKU**

Per ciascuno dei 5 SKU trovati allo Step 2, esegui:

```bash
npm run compose -- <SKU>
```

Expected per ognuno: `Scheda esportata: <path>.jpg`. Apri il JPEG e conta le feature mostrate in scheda:

- **Lavatrice**: attese tra `capacita_carico_kg`, `velocita_centrifuga`, `lavaggio_vapore`, `lavaggio_rapido`, `carico_frontale`, `blocco_bambini`, `avvio_ritardato`, `funzionamento_silenzioso`, più le esistenti `classe_energetica`, `display_touch`, `lunghezza_cavo` — dove il testo prodotto le supporta.
- **Forno**: attese tra `termostato_regolabile`, `timer_cottura`, `vetro_temperato`, `pareti_antiaderenti`, `segnale_acustico`, `blocco_bambini`, `illuminazione_interna`, più `capacita_litri` (ora con badge L) e `piedini_antiscivolo` (se forno da appoggio), più le esistenti `classe_energetica`, `display_touch`.
- **Frigorifero combinato**: attese tra `efficienza_congelamento`, `funzionamento_silenzioso`, `piedini_regolabili`, `illuminazione_interna`, `sbrinamento_automatico` (ora applicabile a frigorifero), più le esistenti `classe_energetica`, `no_frost`, `ripiani_regolabili`, `lunghezza_cavo`.
- **Congelatore**: stesso set frigo/congelatore condiviso (`efficienza_congelamento`, `funzionamento_silenzioso`, `piedini_regolabili`, `illuminazione_interna`, `sbrinamento_automatico`) più le esistenti.
- **Aspirapolvere**: attese tra `senza_fili`, `autonomia_minuti`, `filtro_hepa`, `spazzola_motorizzata`, `doppio_uso_aspira`, più le esistenti `capacita_litri`, `lunghezza_cavo` (se con filo), `manico_regolabile`.

Se un SKU produce meno di 5 feature pertinenti dove il testo le contiene: ispeziona l'output di `npm run propose -- <SKU>` (JSON grezzo) per capire se il problema è classificazione categoria, estrazione feature mancante, o icona non approvata (segnaposto in scheda) — e annota la causa. Nessun commit di codice in caso di scostamento (solo validazione); se servono correzioni al dizionario, aprire un follow-up mirato.

- [ ] **Step 4: Rimuovi lo script temporaneo**

```bash
rm scripts/_find-sku.ts
git status
```

Expected: `scripts/_find-sku.ts` non compare in `git status` (mai stato aggiunto). Nessun commit per questo task: è di sola validazione, nessun file di codice cambia stabilmente.

---

## Criteri di completamento

- `dictionary/features.yaml` è a `version: 4`, 80 chiavi totali (59 preesistenti + 21 nuove); `capacita_litri`, `sbrinamento_automatico`, `piedini_antiscivolo` hanno le `categorie` estese come da spec §5.
- `src/lib/extraction/types.ts`: `PROMPT_VERSION === 3`.
- `dictionary/categories.yaml` invariato: `version: 2`, nessuna nuova categoria.
- `tests/dictionary.test.ts` verde: schema valido, `dict.version === 4`, asserzioni sulle 3 chiavi modificate, ogni categoria referenziata esiste, icone in forma `set:name`, coerenza `{valore}`/`valore`.
- `tests/render-svg.test.ts` e `tests/layout-colonna-sinistra.test.ts` verdi e golden barbecue **byte-identico** (nessuna rigenerazione fixture): nessuna chiave nuova né modifica tocca `barbecue`.
- `npm test` verde e `npx tsc --noEmit` pulito su tutto il branch.
- Le 21 icone `tabler:*` sono scaricate e in stato **approvata** (verificato su `/icone`); l'export le usa (regola d'oro §7).
- Benchmark end-to-end: 1 SKU reale per lavatrice, forno, frigorifero, congelatore, aspirapolvere produce ≥5 feature pertinenti dove il testo del prodotto le contiene (subordinato a `GEMINI_API_KEY` + rete; se BLOCKED, annotato).
- Nessun file sotto `src/lib/dictionary`, `src/lib/extraction/{gemini,ranking,validator,dimensions,engine}.ts`, `src/lib/render`, `src/lib/scene` modificato (motore, loader, gemini, ranking, render intatti — solo `types.ts` per `PROMPT_VERSION`).

## Note per fasi successive (backlog residuo)

- Lotto successivo: `piccoli_elettrodomestici` + `bagno_doccia` (spec §8).
- Poi verso il target 100-150 chiavi: ulteriore rifinitura frigo/congelatore/barbecue.
- Backlog invariato: template `griglia-sotto`/`multi-prodotto`, Vision bbox, fix parser dimensioni formato `Ø`, licenza `solar` (attribuzione CC BY 4.0), edge-case M1 seeding, badge lungo tagliato, titolo scheda con chiave categoria grezza.
