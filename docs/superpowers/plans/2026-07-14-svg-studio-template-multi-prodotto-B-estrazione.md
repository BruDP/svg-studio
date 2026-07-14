# SVG Studio — Template multi-prodotto — Piano B (estrazione robusta set sporchi) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o
> superpowers:executing-plans. Gli step usano checkbox (`- [ ]`). Spec:
> `docs/superpowers/specs/2026-07-14-svg-studio-template-multi-prodotto-design.md` (§2.2, §5.1).

**Dipende da:** **Piano A** (`2026-07-14-svg-studio-template-multi-prodotto.md`) **completato e in merge**.
Piano B NON tocca schema scena, layout, template, mutazioni o UI (già chiusi in A): estende SOLO
l'estrazione multi-misura per i set con `notaTecnica` sporca, così che anche prodotti come il set giardino
`2188908` producano `sottoProdotti` corretti e finiscano nel template `multi-prodotto` già esistente.

**Goal:** Generalizzare `parseSetDimensions` per gestire il caso sporco (§2.2 della spec): (a) filtrare le
righe-accessorio (`seduta`, `cuscino`, `schienale`) che hanno la stessa forma dei pezzi ma non lo sono;
(b) tollerare separatori mancanti (`p. 64,5 h. 40,5`, senza `x`); (c) riconoscere il badge di **portata**
(`Portata massima <etichetta>: <N> Kg`) oltre a `Capacità … L`; (d) associare badge e misure per etichetta
senza falsi positivi. Golden nuovo su `2188908`.

**Architecture:** Tutta la logica vive in `src/lib/extraction/dimensions.ts` (parser puro,
deterministico) più eventualmente un passo Gemini vincolato in `src/lib/extraction/` (con validazione
anti-allucinazione, coerente con spec master §5.3). Nessuna modifica a layout/scena/mutazioni/UI. Il
template `multi-prodotto` di Piano A consuma i `sottoProdotti` senza saperne l'origine.

**Tech Stack:** come Piano A. `@google/genai` solo se si sceglie il passo Gemini (Step opzionale, dietro
DI/fake per i test offline).

## Global Constraints

- **Non toccare** `types.ts`, `schema.ts`, `mutations.ts`, `multi-prodotto.ts`, `engine.ts` (layout),
  `compose-lib.ts`, la UI: sono chiusi in Piano A. Piano B è esclusivamente estrazione.
- **`parseSetDimensions` resta puro e deterministico** (nessuna I/O nel parser regex). Un eventuale passo
  Gemini è separato, iniettabile (DI/fake), e i suoi output vengono **ri-validati** meccanicamente contro
  `notaTecnica` prima di diventare `SottoProdotto` (mai fidarsi del testo generato — spec master §5.3).
- **Non regredire Piano A**: le valigie `5926962` devono continuare a produrre gli stessi 3 sottoProdotti
  (golden `scene-5926962.json` byte-identico). I prodotti singoli continuano a dare `[]`.
- **Gate anti-falsi-positivi**: un blocco `Misure <etichetta>` diventa pezzo solo se corroborato da un
  badge (`Capacità … L` **oppure** `Portata massima … Kg`) con etichetta corrispondente; le righe
  accessorio (senza badge di pezzo) restano escluse.
- **Golden `colonna-sinistra` intatto**; `tsc` pulito; `npm test` verde; test offline.
- **Codice/commenti/commit in italiano.**

## Modello di esecuzione per-task

Estrazione delicata su dati reali sporchi, con rischio falsi positivi e (opzionale) Gemini vincolato →
**Sonnet** con giudizio su tutti i task. Nessuna trascrizione pura → niente Haiku. Review per-task
**Sonnet**. **Review finale whole-branch: Opus** (soprattutto se si introduce il passo Gemini).

| Task | Contenuto | Esecuzione | Review |
|---|---|---|---|
| 1 | `parseSetDimensions` robusto: filtro accessori + tolleranza separatori + badge portata | Sonnet | Sonnet |
| 2 | Golden set giardino `2188908` + verifica non-regressione valigie | Sonnet | Sonnet |
| 3 | (Opzionale) passo Gemini vincolato per l'associazione pezzi + ri-validazione | Sonnet | Sonnet |
| 4 | Verifica determinismo + `tsc` + suite | Sonnet | Sonnet |

Review finale whole-branch: **Opus.**

## File Structure

```
src/lib/extraction/
  dimensions.ts          # Task 1 — parseSetDimensions generalizzato (accessori, separatori, portata)
  set-vision.ts (opz.)   # Task 3 — passo Gemini vincolato + ri-validazione (dietro DI/fake)
  engine.ts              # Task 3 (opz.) — cablaggio del passo Gemini in extractProposal
tests/
  dimensions.test.ts             # Task 1 — casi giardino sporchi + non-regressione valigie
  layout-multi-prodotto.test.ts  # Task 2 — golden 2188908 (usa composeMultiProdotto di Piano A)
  fixtures/scene-2188908.json    # Task 2 — NUOVO golden
```

---

### Task 1: `parseSetDimensions` robusto (caso sporco)

**Files:** Modify `src/lib/extraction/dimensions.ts`; Test `tests/dimensions.test.ts`.

- [ ] **Step 1 (test prima):** con la `notaTecnica` reale del giardino (fixture inline, dal feed):
  ```ts
  const giardino = [
    'Misure poltroncine: l. 75 x p. 85 x h. 86 cm',
    'Misure seduta: l. 65 x p. 64 cm',                       // accessorio → escluso
    'Misure divanetto: l. 140 x p. 85 x h. 86 cm',
    'Misure tavolinetto: l. 110 x p. 64,5 h. 40,5 cm',       // separatore mancante prima di h
    'Misure cuscino divano: l. 130 x p. 67,5 x h. 11 cm',    // accessorio → escluso
    'Misure cuscini poltroncine: l. 65 x 67,5 x h. 11 cm',   // accessorio → escluso
    'Misure cuscini schienale: l. 65 x 50 x h. 9 cm',        // accessorio → escluso
    'Portata massima poltroncine: 150 Kg',
    'Portata massima divanetto: 300 Kg',
    'Portata massima tavolinetto: 50 Kg',
  ]
  ```
  Asserzioni: `parseSetDimensions(giardino)` ha length **3** (poltroncine, divanetto, tavolinetto — in
  ordine di apparizione); il tavolinetto ha `dimensioni {larghezza:110, profondita:64.5, altezza:40.5}`
  (separatore mancante tollerato); ogni pezzo ha un badge portata (es. `'300 Kg'`); nessun pezzo
  `seduta`/`cuscino`. E la non-regressione: `parseSetDimensions(valigie)` (fixture del Piano A) resta 3
  pezzi identici con badge capacità.
- [ ] **Step 2: esegui (fallisce).**
- [ ] **Step 3: implementa.** In `dimensions.ts`:
  - **Tolleranza separatori:** allarga la regex delle misure etichettate per accettare `x` **opzionale**
    tra i gruppi (`p.\s*NUM\s*x?\s*h.\s*NUM`), mantenendo compatibilità col caso pulito.
  - **Badge di pezzo:** oltre a `Capacità <etichetta>: <N> L`, riconosci
    `Portata\s+massima\s+<etichetta>\s*:\s*<N>\s*Kg` → badge `etichetta:'<N> Kg'`, `chiave:'portata'`.
  - **Filtro accessori:** un blocco `Misure <etichetta>` diventa pezzo SOLO se `<etichetta>` compare in un
    badge di pezzo (capacità O portata). Le righe accessorio (`seduta`, `cuscino*`, `schienale`) non hanno
    un badge corrispondente → escluse **senza** blacklist hard-coded (il gate badge le filtra da solo).
    In più, per robustezza, escludi esplicitamente etichette note-accessorio via un piccolo set
    (`seduta`, `cuscino`, `cuscini`) come difesa in profondità documentata.
  - Ordine: apparizione dei blocchi `Misure` corroborati. Se < 2 → `[]`.
  - Resta puro/deterministico.
- [ ] **Step 4: esegui (passa) + tsc.** Verifica ANCHE che il test valigie del Piano A resti verde.
- [ ] **Step 5: commit.**
  ```bash
  git add src/lib/extraction/dimensions.ts tests/dimensions.test.ts
  git commit -m "feat(extraction): parseSetDimensions robusto (filtro accessori, separatori tolleranti, badge portata)"
  ```

---

### Task 2: Golden set giardino `2188908`

**Files:** Test `tests/layout-multi-prodotto.test.ts`; Fixture `tests/fixtures/scene-2188908.json`.

- [ ] **Step 1:** costruisci una `SchedaProposal` per il giardino (feature condivise + `sottoProdotti` da
  `parseSetDimensions(giardino)`), `fotoPerGruppo` deterministico fittizio, chiama `composeMultiProdotto`
  (di Piano A, invariato) e genera `tests/fixtures/scene-2188908.json`.
- [ ] **Step 2:** aggiungi il test golden byte-identico (stesso pattern del `5926962`); verifica id per
  gruppo, 3 celle, badge portata per gruppo. Ispeziona il JSON a occhio.
- [ ] **Step 3:** `npx vitest run tests/layout-multi-prodotto.test.ts && npx tsc --noEmit`.
- [ ] **Step 4: commit.**
  ```bash
  git add tests/layout-multi-prodotto.test.ts tests/fixtures/scene-2188908.json
  git commit -m "test(layout): golden multi-prodotto set giardino 2188908"
  ```

---

### Task 3 (opzionale): passo Gemini vincolato per l'associazione pezzi

Solo se il parser regex si dimostra insufficiente su altri set reali (da valutare in review): un passo
Gemini `temperature:0` structured-output che, dato `notaTecnica`, restituisce l'elenco dei **pezzi** del
set (etichette) e i testi sorgente delle rispettive misure/badge; poi un ri-parsing **deterministico** di
quei testi con le regex del Task 1 e **validazione anti-allucinazione** contro `notaTecnica` (ogni numero
tracciabile nel testo, altrimenti scartato/flaggato — spec master §5.3). Iniettabile via `generate` (come
`extractRaw`), fake offline nei test.

**Files:** New `src/lib/extraction/set-vision.ts`; Modify `src/lib/extraction/engine.ts`.

- [ ] **Step 1:** definisci il passo con DI (`generate?`) e fake; il risultato non è mai fidato direttamente.
- [ ] **Step 2:** ri-valida contro `notaTecnica`; costruisci `SottoProdotto[]` solo dai valori tracciabili.
- [ ] **Step 3:** cabla in `extractProposal` come fallback quando `parseSetDimensions` regex ritorna `[]`
  ma il prodotto è plausibilmente un set (es. `descrizioneBreve` inizia con "Set"). Cache per `inputHash`
  invariata (l'output entra nel JSON `Extraction`).
- [ ] **Step 4:** test offline con fake; `tsc` + suite.
- [ ] **Step 5: commit** (se implementato).

> Nota: valutare in review se il Task 3 è necessario. Se il parser regex del Task 1 copre i set reali del
> feed, il passo Gemini è **backlog** e Piano B si chiude ai Task 1-2-4.

---

### Task 4: Verifica determinismo e integrazione

- [ ] **Step 1:** golden `colonna-sinistra` (2137070) e `5926962` byte-identici (non-regressione).
- [ ] **Step 2:** `npx tsc --noEmit && npm test` verde sull'intero branch.
- [ ] **Step 3:** commit solo se servono aggiustamenti di verifica.

---

## Criteri di completamento (Piano B)

- `parseSetDimensions` gestisce il caso sporco (giardino `2188908`): filtro accessori, separatori
  tolleranti, badge portata; 3 pezzi corretti; nessun falso positivo.
- Non-regressione: valigie `5926962` e prodotti singoli invariati; golden `colonna-sinistra` byte-identico.
- Golden `multi-prodotto` `2188908` committato e byte-identico.
- (Opz.) passo Gemini vincolato con ri-validazione anti-allucinazione, offline nei test — oppure rinviato
  a backlog se non necessario.
- `tsc` pulito; `npm test` verde; test offline e deterministici.

## Backlog residuo (dopo Piano B)

- Auto-assegnazione euristica foto per pezzo; multi-crop da foto d'insieme; editing strutturale del set;
  variante layout "icone a sinistra" (replica scheda giardino) — tutti come da spec §11.
- Passo Gemini vincolato per l'associazione pezzi, se non implementato nel Task 3.
- Batch senza revisione: **fuori scope**.
