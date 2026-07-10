# SVG Studio — Espansione dizionario: grandi elettrodomestici — Design

**Data**: 2026-07-10
**Stato**: approvato in brainstorming, in attesa di revisione finale spec

## 1. Obiettivo

Secondo lotto dell'espansione dizionario (spec §5.1, target 100-150 chiavi). Il dizionario è a 59 chiavi; cinque categorie di grandi elettrodomestici — importanti su satur.it — hanno copertura povera:

| Categoria | Chiavi applicabili oggi |
|---|---|
| lavatrice | 3 (classe_energetica, display_touch, lunghezza_cavo) |
| forno | 3 |
| aspirapolvere | 3 |
| frigorifero | 6 |
| congelatore | 6 |

**Metrica di successo**: dopo l'espansione, ri-generando 1 prodotto reale per categoria (scelto dal feed), ognuno produce una scheda ricca (≥5 feature pertinenti, dove il testo del prodotto le contiene).

## 2. Scope

**In scope**: 21 nuove chiavi feature (data-driven dal mining del feed reale, 6982 prodotti) per lavatrice, forno, frigorifero, congelatore, aspirapolvere; più l'estensione delle `categorie` di 3 chiavi esistenti (riuso DRY). Seeding + approvazione delle nuove icone.

**Fuori scope** (lotti successivi): `piccoli_elettrodomestici`, `bagno_doccia`, `barbecue`, template extra, Vision bbox. Le categorie già ricche (arredo, clima, sedia, valigie) restano invariate.

## 3. Vincoli globali

- **Golden determinismo intatto**: nessuna nuova chiave né modifica applicabile a `barbecue`. La fixture golden (SKU 2137070, barbecue) resta byte-identica. Il test golden usa una proposta hardcoded (materiale_acciaio + montaggio_facile) → non toccata.
- **Bump versione + PROMPT_VERSION**: `features.yaml` passa a `version: 4`. `PROMPT_VERSION` (in `src/lib/extraction/types.ts`) passa da 2 a 3 → invalida la cache estrazioni, così i prodotti già estratti (frigo/lavatrice/ecc.) si ri-estraggono con il dizionario ampliato. `categories.yaml` resta a `version: 2` (nessuna nuova categoria: le 5 esistono già).
- **Test CI dizionario verde**: `tests/dictionary.test.ts` valida schema, assenza duplicati, categorie referenziate esistenti, icone `set:name`, coerenza `{valore}`↔`valore`. Aggiornare l'asserzione `dict.version` a 4.
- **Icone verificate ed esistenti**: tutte le icone `tabler:*` proposte sono state verificate esistenti su Iconify (2026-07-10). Vanno **approvate** (regola d'oro §7): l'export usa solo `getApprovedIcon`.
- **Nessuna modifica al motore**: `renderScene`, `scene/*`, engine/ranking, template invariati. Si toccano solo `dictionary/features.yaml`, `src/lib/extraction/types.ts` (PROMPT_VERSION), `tests/dictionary.test.ts`.
- **Riuso DRY**: dove una chiave esistente è pertinente, si estende il suo array `categorie` invece di crearne una nuova.

## 4. Architettura

Nessun nuovo componente. Si estende `dictionary/features.yaml` (nuove chiavi + categorie aggiuntive) e si bumpa `PROMPT_VERSION`. La pipeline consuma le nuove voci da sé (enum Gemini derivati dal dizionario, ranking per priorità/categorie, render per chiave).

## 5. Modifiche a chiavi esistenti (riuso DRY)

Aggiungere categorie agli array esistenti (nessun altro campo cambia):

| chiave | categorie da aggiungere | motivo |
|---|---|---|
| `capacita_litri` | `forno` | capacità forno in litri (badge L) |
| `sbrinamento_automatico` | `frigorifero`, `congelatore` | sbrinamento auto frigo/congelatore |
| `piedini_antiscivolo` | `forno` | fornetti da appoggio con piedini antiscivolo |

(`classe_energetica`, `display_touch`, `lunghezza_cavo`, `no_frost`, `ripiani_regolabili`, `timer_ore` coprono già le categorie pertinenti — nessuna modifica.)

## 6. Nuove chiavi feature (21)

Icone `tabler:*` verificate esistenti. `valore: obbligatorio` = label con `{valore}`.

### Lavatrice

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `capacita_carico_kg` | {valore} kg di carico | tabler:wash-machine | 88 | sì | obbligatorio | lavatrice |
| `velocita_centrifuga` | Centrifuga {valore} giri | tabler:rotate-clockwise-2 | 75 | no | obbligatorio | lavatrice |
| `lavaggio_vapore` | Lavaggio a vapore | tabler:steam | 70 | no | assente | lavatrice |
| `lavaggio_rapido` | Lavaggio rapido | tabler:bolt | 68 | no | assente | lavatrice |
| `carico_frontale` | Carico frontale | tabler:door | 55 | no | assente | lavatrice |
| `blocco_bambini` | Blocco sicurezza bambini | tabler:lock | 50 | no | assente | lavatrice, forno |
| `avvio_ritardato` | Avvio ritardato | tabler:clock-pause | 45 | no | assente | lavatrice |

### Forno

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `termostato_regolabile` | Termostato regolabile | tabler:temperature | 72 | no | assente | forno |
| `timer_cottura` | Timer di cottura | tabler:clock | 65 | no | assente | forno |
| `vetro_temperato` | Sportello in vetro temperato | tabler:window | 60 | no | assente | forno |
| `pareti_antiaderenti` | Pareti interne antiaderenti | tabler:droplet-off | 58 | no | assente | forno |
| `segnale_acustico` | Segnale acustico di fine cottura | tabler:bell | 38 | no | assente | forno |

### Frigorifero / Congelatore (e condivise)

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `efficienza_congelamento` | Congelamento {valore} stelle | tabler:stars | 80 | no | obbligatorio | congelatore, frigorifero |
| `funzionamento_silenzioso` | Silenzioso {valore} dB | tabler:volume-3 | 76 | no | obbligatorio | frigorifero, congelatore, lavatrice |
| `piedini_regolabili` | Piedini regolabili | tabler:adjustments | 48 | no | assente | frigorifero, congelatore |
| `illuminazione_interna` | Luce interna | tabler:bulb | 42 | no | assente | forno, frigorifero, congelatore |

### Aspirapolvere

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `senza_fili` | Senza fili, ricaricabile | tabler:battery-charging | 82 | no | assente | aspirapolvere |
| `autonomia_minuti` | Autonomia {valore} minuti | tabler:clock-play | 80 | no | obbligatorio | aspirapolvere |
| `filtro_hepa` | Filtro HEPA lavabile | tabler:filter | 78 | no | assente | aspirapolvere |
| `spazzola_motorizzata` | Spazzola motorizzata | tabler:vacuum-cleaner | 70 | no | assente | aspirapolvere |
| `doppio_uso_aspira` | Anche aspiratutto a mano | tabler:hand-stop | 60 | no | assente | aspirapolvere |

**Totale: 21 nuove chiavi + 3 modifiche di categoria → dizionario da 59 a 80 chiavi.**

Nota riuso icone: `illuminazione_interna` usa `tabler:bulb` (già `led_rgb`); `blocco_bambini` usa `tabler:lock` (già in altre? no — `chiusura_combinazione` usa `lock-square`, diverso). Icone duplicate tra chiavi diverse sono ammesse (keyed per chiave feature); non compaiono comunque sulla stessa scheda (categorie disgiunte o priorità).

## 7. Testing

- **`dictionary.test.ts`** verde: `dict.version === 4`, schema valido, no duplicati, categorie referenziate esistenti, icone `set:name`, coerenza `{valore}`.
- **Golden determinismo** (`render-svg.test.ts`, `layout-colonna-sinistra.test.ts`): invariato per costruzione (nessuna chiave/modifica tocca barbecue, proposta golden hardcoded). Verificare verde senza rigenerare fixture.
- **Seeding icone**: `npm run seed:icons -- --approve` → 21 nuove create e approvate, resto già presente.
- **Validazione end-to-end**: ri-generare 1 SKU reale per categoria (cercandolo nel feed: "lavatrice", "forno elettrico", "frigorifero combinato", "congelatore", "aspirapolvere") con la pipeline reale (serve GEMINI_API_KEY + rete) e confermare ≥5 feature pertinenti dove il testo le contiene. Nota: la suite unit svuota il test DB, non il dev DB (isolamento già in place) — ma il DB reale va comunque avere feed+icone (ricaricare/seedare se serve).

## 8. Note per fasi successive

- Lotto successivo: `piccoli_elettrodomestici` + `bagno_doccia`.
- Poi verso il target 100-150: eventuale ulteriore rifinitura frigo/congelatore, barbecue.
- Backlog invariato: template `griglia-sotto`/`multi-prodotto`, Vision bbox, licenza `solar`, edge-case M1 seeding.
