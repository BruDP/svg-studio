# SVG Studio — Espansione dizionario: ombrelloni — Design

**Data**: 2026-07-10
**Stato**: approvato in brainstorming (esecuzione snella inline)

## 1. Obiettivo

Ultimo lotto dell'espansione dizionario per le categorie prioritarie. Il mining del feed reale ha mostrato che gli **ombrelloni** sono la sola linea ricca ancora scoperta (67 prodotti, feature distintive assenti dal dizionario). Sdraio/lettini/dondoli sono già coperti da chiavi esistenti; teli mare sono accessori (fuori scope); i piccoli elettrodomestici hanno testo scarno (saltati, decisione utente 2026-07-10).

**Metrica di successo**: ri-generando 1 ombrellone reale dal feed, la scheda mostra ≥4 feature pertinenti (apertura manovella, laccio, struttura acciaio, copertura poliestere, richiudibile).

## 2. Scope

**In scope**: categoria `ombrellone` + 2 chiavi nuove (apertura a manovella, laccio di chiusura) + estensione di 4 chiavi esistenti alla nuova categoria (riuso DRY). Esecuzione snella inline (TDD), non ciclo subagent.

**Fuori scope**: piccoli elettrodomestici, bagno, teli/accessori. Dopo questo lotto il dizionario è considerato completo per le categorie prioritarie; il valore residuo si sposta sul design (template, Vision bbox).

## 3. Vincoli globali

- **Golden intatto**: nessuna chiave nuova né estensione tocca `barbecue`. Le 2 chiavi esistenti estese che già includono barbecue (`pulizia_panno`) NON perdono né guadagnano `barbecue` (si aggiunge solo `ombrellone`). Golden byte-identico. `struttura_acciaio` include già barbecue: invariato lì, si aggiunge solo `ombrellone`.
- **Versioni**: `categories.yaml` v2→3 (nuova categoria `ombrellone`), `features.yaml` v4→5, `PROMPT_VERSION` 3→4 (invalida cache → ombrelloni ri-estratti). Test `dict.version` → 5, e asserzione presenza categoria `ombrellone`.
- **Icone**: `tabler:rotate-clockwise`, `tabler:link` — verificate esistenti (2026-07-10). Da seedare+approvare.
- **Nessuna modifica al motore**: solo `dictionary/*.yaml`, `src/lib/extraction/types.ts` (PROMPT_VERSION), `tests/dictionary.test.ts`.

## 4. Categoria e chiavi

**`categories.yaml`**: aggiungere `ombrellone` all'enum (dopo `arredo_esterno`).

**Nuove chiavi (`features.yaml`)**:

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `apertura_manovella` | Apertura a manovella | tabler:rotate-clockwise | 60 | no | assente | ombrellone |
| `chiusura_laccio` | Laccio di chiusura | tabler:link | 45 | no | assente | ombrellone |

**Estensione categorie a chiavi esistenti (aggiungere `ombrellone`)**:

| chiave | categorie attuali → aggiungere |
|---|---|
| `struttura_acciaio` | +`ombrellone` (struttura tubolare acciaio, 25×) |
| `copertura_poliestere` | +`ombrellone` (copertura 100% poliestere, 35×) |
| `richiudibile` | +`ombrellone` (facilmente richiudibile, 38×) |
| `pulizia_panno` | +`ombrellone` (pulire con panno umido, 26×) |

## 5. Testing

- `dictionary.test.ts` verde: `dict.version === 5`, `dict.categorie` contiene `ombrellone`, schema/duplicati/categorie-esistenti/icone/`{valore}` ok.
- Golden (`render-svg`, `layout-colonna-sinistra`) verde e byte-identico.
- Seeding: `npm run seed:icons -- --approve` → 2 nuove create+approvate.
- Validazione: 1 SKU ombrellone reale → ≥4 feature pertinenti.

## 6. Note

Dopo questo lotto: pivot al design (template `griglia-sotto`/`multi-prodotto`, fallback Vision bbox) — lì servirà pianificazione Opus. Backlog dizionario residuo: eventuale categoria "mare" dedicata solo se emergono prodotti mare non serviti da arredo_esterno/ombrellone.
