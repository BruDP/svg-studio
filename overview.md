# SVG Studio — Overview

Generatore di **schede tecniche prodotto 1000×1000** per satur.it, a partire dal feed Magento.
Per ogni SKU: estrae le caratteristiche dal testo del prodotto (Gemini vincolato), compone una
scena vettoriale, la renderizza in SVG deterministico e la esporta in JPEG (per l'ecommerce) + SVG.

Stato: MVP completo e usabile (SKU → proposta → editing → export) con due template, libreria icone,
identità visiva clean/Apple, loghi marchio e linea, selezione target ad alto valore. Ultimo aggiornamento doc: **2026-07-24**.

---

## Stack tecnologico

| Area | Tecnologia |
|---|---|
| Framework web | **Next.js 16** (App Router, Turbopack, Server Actions) — ⚠️ versione con breaking changes, vedi `AGENTS.md` |
| Linguaggio / UI | **TypeScript**, **React 19**, **Tailwind CSS 4** |
| Database | **Prisma 7** + **SQLite** (adapter `better-sqlite3`; l'URL passa via adapter, non nello schema) |
| Rasterizzazione | **@resvg/resvg-js** (SVG→PNG, font Poppins embedded) + **sharp** (PNG→JPEG, trim loghi) |
| AI estrazione | **@google/genai** — Gemini `2.5-pro` (vincolato, anti-allucinazione) |
| AI visione | Gemini Vision — bounding box foto + prospettiva (spigolo profondità) |
| Icone | **Iconify** (set Tabler) — libreria locale con stato approvazione |
| Validazione | **Zod** (schema scena) · **YAML** (dizionario) |
| Test | **Vitest** (unit + golden determinismo) · **Playwright** (E2E offline) |

## Comandi

Vedi `README.md` per setup. Comandi principali:

- `npm test` — suite Vitest (~267 unit test + validazione dizionario + golden byte-identici)
- `npm run e2e` — Playwright (10 test E2E, DB isolato `data/e2e.db`)
- `npm run dev` — app web (`/studio` editor, `/icone` libreria)
- `npm run compose -- <SKU>` — genera `output/{SKU}.jpg` + `.svg` headless
- `npm run propose -- <SKU>` — stampa la proposta di scheda (senza render)
- `npm run seed:icons` — popola la libreria icone da Iconify (una tantum, `--force` per rigenerare)
- `scripts/avvia.ps1` — launcher desktop dell'app

---

## Pipeline (dal feed alla scheda)

```
Feed Magento (CSV)                          scripts/compose.ts  ·  app/actions.ts
     │                                              (orchestrazione)
     ▼
┌──────────────┐   feed/fetcher,parser,repository
│  Product     │   payload JSON in tabella Product (SQLite)
│  (SQLite)    │   descrizioneBreve, notaTecnica[], marchio, images[], dimensioni…
└──────┬───────┘
       │  extraction/engine.ts
       ▼
┌──────────────┐   gemini.ts (estrazione vincolata) → validator.ts (anti-allucinazione)
│ SchedaProposal│  → ranking.ts (ordine feature) → dimensions.ts (parse misure + set)
│              │   features[], badges[], dimensioni, sottoProdotti?, categoria
└──────┬───────┘   cache in tabella Extraction (chiave inputHash, invalidata da PROMPT_VERSION)
       │  layout/  (composizione, PURA)
       ▼
┌──────────────┐   colonna-sinistra.ts (prodotto singolo) | multi-prodotto.ts (set)
│    Scene     │   engine.ts (posizioni, quote, fitFoto) · titolo.ts (estrai titolo)
│   (JSON)     │   elements[]: testo, icona-label, foto, quota, badge · accento (reparto)
└──────┬───────┘   validata da scene/schema.ts (Zod) · mutata da scene/mutations.ts (editor)
       │  render/  (rendering, PURO e deterministico)
       ▼
┌──────────────┐   svg.ts (renderScene) — theme.ts + theme-satur.ts (token)
│  SVG string  │   bundle.ts risolve icone/foto/loghi come data URI (imageMap/iconMap)
└──────┬───────┘   colore.ts (mescola tinte)
       │  export/raster.ts
       ▼
  output/{SKU}.jpg (resvg→PNG→sharp→JPEG 2000px q90)  +  output/{SKU}.svg
```

**Regola d'oro**: l'anteprima nell'editor e l'export sono **byte-identici** (stesso `renderScene`,
stesso bundle). Ogni immagine (foto, icona, logo) è incorporata come data URI, mai URL remoto.

---

## Struttura directory

```
src/
  app/                    App Next.js
    actions.ts            Server Actions (propose, export, save/load scena, cambio foto, icone)
    layout.tsx page.tsx   root
    studio/               editor: StudioClient + pannelli (Banco, Feature, Elementi, Photo/Icon picker)
    icone/                griglia libreria icone (approva/semina)
  lib/
    feed/                 fetch/parse feed Magento → repository Product
    extraction/           engine, gemini, validator, ranking, dimensions, types (PROMPT_VERSION)
    dictionary/           loader + tipi del dizionario feature/categorie (YAML)
    images/               cache immagini, bbox (pixel + Vision), prospettiva (Vision + correzioni)
    layout/               composizione scena: colonna-sinistra, multi-prodotto, engine, titolo
    scene/                tipi Scene, schema Zod, mutations (reducer editor)
    render/               svg.ts (renderScene puro), bundle.ts (risorse), colore.ts
    branding/             marchio.ts (slug/display) + logo-loader.ts (loghi da assets/loghi)
                          linea.ts (rileva linea da descrizioneBreve) + selezione.ts (target ad alto valore)
    export/               raster.ts (JPEG+SVG)
    quality/              valuta.ts (segnale qualità: poche icone / da-verificare)
    theme.ts theme-satur.ts   token di stile + palette per reparto
    ui/                   ScenePreview, EditorPreview, overlay quote/icone (client)
  ...
scripts/                  compose, propose, seed-icons, compose-lib, avvia.ps1
dictionary/               features.yaml (90 chiavi, v7) · categories.yaml (19 categorie, v4)
assets/                   fonts/ (Poppins) · loghi/ (galileo/kooper/villa-d-este .png) · .ico
prisma/                   schema + migrations (Product, Extraction, Icon, Scene, VisionBBox, VisionProspettiva, FeedMeta)
tests/                    35 file Vitest (unit + golden fixtures)
e2e/                      Playwright (studio.spec, icone.spec) + fixtures offline
docs/                     design-system.md + superpowers/{specs,plans} (storico fasi 1-3)
```

---

## Convenzioni e vincoli

- **Token di stile centralizzati** in `theme.ts` (+ `theme-satur.ts` per reparto). Nessun valore
  di stile hard-coded nel renderer. Vedi `docs/design-system.md`.
- **Determinismo / golden test**: `renderScene` è puro; i fixture in `tests/fixtures/` sono
  byte-identici. Dopo un cambio di rendering/layout, rigenerare i golden (scene + render).
  I golden byte-identici **non** validano i limiti del canvas: per il layout serve un test di
  **bounds** esplicito (vedi `layout-colonna-sinistra.test.ts`).
- **`PROMPT_VERSION`** (`extraction/types.ts`, ora **11**): va incrementato quando cambia il
  post-processing dell'estrazione (parser dimensioni, ranking…), altrimenti la cache `Extraction`
  resta stale. `SCENE_VERSION` = 1.
- **Verificare i cambi di design RENDERIZZANDO** (non solo leggendo le coordinate); e un taglio di
  spazio testo va verificato contro il **contenuto reale più lungo** del dizionario, non solo i
  casi brevi dei test (regressioni di wrap/ellissi trovate così).
- **DB di test isolato**: `vitest` usa `data/test.db`, gli E2E `data/e2e.db` — `npm test`/E2E non
  toccano il dev DB (`data/svg-studio.db`, ~7000 prodotti).
- **Ambiente**: rendering PDF via PyMuPDF (`pdftoppm`/canvas non disponibili su questa macchina).

## Dati chiave

- **3 marchi** reali nel campo `marchio`: Galileo (~4221), Villa d'Este/VdE (~2134), Kooper (~712).
  **Le "linee"** (BestBQ, Esté, FitLover, SìChef, Kooper X…) sono nella descrizione (ultimo segmento
  di `descrizioneBreve`), rilevate via `linea.ts` senza Gemini. L'eyebrow mostra la linea se
  riconosciuta, altrimenti il marchio.
- **Selezione target** (`selezione.ts`): i prodotti si classificano in `kooper`, `garden`, `fitness`
  a partire da marchio + linea rilevata (no Gemini). Serve per escludere i ~6200 prodotti non
  prioritari e generare le schede solo per i ~780 target ad alto valore.
- **Loghi di linea** (`assets/loghi/`): BestBQ, Esté, FitLover, Kooper X, Duppidù, SìChef, Sìordine,
  Santa's House, Sibilla (PNG trasparenti, data URI). Marchi: galileo, kooper, villa-d-este.
- **Dizionario**: 90 chiavi feature (v7), 19 categorie (v4). Completo per le categorie prioritarie
  (arredo, garden, grandi/piccoli elettrodomestici, ombrelloni, valigie, illuminazione).
  **FitLover/fitness non ha ancora feature specifiche** — da estendere.
- **Due template**: `colonna-sinistra` (prodotto singolo) e `multi-prodotto` (set, N sotto-prodotti).

---

Documentazione correlata: **[README.md](README.md)** (setup/comandi) ·
**[docs/design-system.md](docs/design-system.md)** (identità visiva e token) ·
`docs/superpowers/{specs,plans}` (storico progettazione fasi 1-3, fino al 2026-07-21).
