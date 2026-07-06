# SVG Studio

Generatore di schede tecniche prodotto (satur.it) da feed Magento. Spec: `docs/superpowers/specs/`.

## Setup

1. `npm install`
2. Copia `.env.example` in `.env`
3. `npx prisma migrate dev`
4. Copia `.env.local.example` in `.env.local` e inserisci la chiave Gemini

## Comandi

- `npm test` — suite Vitest (include validazione dizionario e golden test di determinismo)
- `npm run propose -- <SKU>` — scarica/aggiorna il feed e stampa la proposta di scheda per uno SKU
- `npm run dev` — app web (dalla Fase 3)
