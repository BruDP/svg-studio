# SVG Studio

Generatore di **schede tecniche prodotto 1000×1000** per satur.it, dal feed Magento: estrazione
caratteristiche (Gemini vincolato) → composizione scena → render SVG deterministico → export
**JPEG** (per l'ecommerce) + **SVG**. Editor web per rifinire ogni scheda.

📄 **[overview.md](overview.md)** — architettura, pipeline, struttura, convenzioni.
🎨 **[docs/design-system.md](docs/design-system.md)** — identità visiva Satur e token di stile.
📚 `docs/superpowers/{specs,plans}` — storico di progettazione (fasi 1-3).

## Setup

1. `npm install`
2. Copia `.env.example` in `.env`
3. `npx prisma migrate dev`
4. `npx prisma generate` (necessario: in questa versione di Prisma `migrate dev` non genera il client da solo)
5. Copia `.env.local.example` in `.env.local` e inserisci la chiave Gemini

## Comandi

- `npm test` — suite Vitest (unit + validazione dizionario + golden di determinismo byte-identici)
- `npm run e2e` — test end-to-end Playwright (offline, DB isolato)
- `npm run dev` — app web: `/studio` (editor) e `/icone` (libreria icone)
- `npm run propose -- <SKU>` — scarica/aggiorna il feed e stampa la proposta di scheda per uno SKU
- `npm run compose -- <SKU>` — genera la scheda `output/{SKU}.jpg` + `.svg` (estrazione → composizione → render → export)
- `npm run seed:icons` — popola la libreria icone da Iconify per le chiavi del dizionario (una tantum; `--force` per rigenerare)
- `scripts/avvia.ps1` — launcher desktop dell'app

## Loghi marchio

I loghi ufficiali stanno in `assets/loghi/` (`galileo.png`, `kooper.png`, `villa-d-este.png`,
PNG trasparenti). Per aggiungerne/aggiornarne uno vedi `assets/loghi/README.md`.
