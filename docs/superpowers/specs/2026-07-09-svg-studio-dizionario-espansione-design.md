# SVG Studio — Espansione dizionario (categorie fallite) — Design

**Data**: 2026-07-09
**Stato**: approvato in brainstorming, in attesa di revisione finale spec

## 1. Obiettivo

Il benchmark di accettazione (2026-07-09) ha mostrato che la pipeline funziona ma il dizionario è troppo piccolo: 23 chiavi contro le 100-150 previste dalla spec §5.1. Tre categorie di prodotti reali escono con schede povere o vuote perché mancano le chiavi feature:

| Prodotto benchmark | Feature reali | Feature generate | Esito |
|---|---|---|---|
| Condizionatore portatile Kooper Klima | 8 | 2 | povero |
| Tavolo tondo mosaico | 5 | 1 | povero |
| Specchio figura intera | 5 | 0 | vuoto |

**Metrica di successo**: ri-generando questi 3 prodotti dopo l'espansione, ognuno produce una scheda con feature confrontabili alla reference fatta a mano (condizionatore ≥6, tavolino ≥4, specchio ≥3 feature pertinenti e corrette).

## 2. Scope

**In scope**: ampliamento *data-driven* del dizionario per le 3 categorie fallite, con vocabolario derivato dal feed reale (mining su 6982 prodotti in cache). Split della categoria clima. Seeding + approvazione delle nuove icone da Iconify.

**Fuori scope** (backlog benchmark, fasi separate): fix parser dimensioni formato diametro `Ø` (§2 backlog benchmark), titolo scheda grezzo, larghezza badge, rifinitura estetica icone, fallback Gemini Vision. Le altre 11 categorie del dizionario (frigorifero, valigie, ecc.) restano invariate in questa fase.

## 3. Vincoli globali

- **Golden determinismo intatto**: nessuna nuova chiave è applicabile a `barbecue`. La fixture golden (SKU 2137070, categoria barbecue) deve restare byte-identica. Il render golden non cambia.
- **Bump versione dizionario**: `features.yaml` e `categories.yaml` passano a `version: 2`. Questo invalida la cache estrazioni (`computeInputHash` include `dictVersion` e `dictKeys`) — i prodotti si ri-estraggono alla prossima proposta. Comportamento atteso, non un errore.
- **Test CI dizionario verde**: `dictionary.test.ts` valida schema YAML, assenza di chiavi duplicate, e (dove verificato) coerenza. Ogni nuova chiave deve avere `label`, `icona` (`set:name`), `priorita`, `badge`, `valore`, `categorie` non vuoto. Le categorie referenziate devono esistere in `categories.yaml`.
- **Icone verificate ed esistenti**: tutte le icone `tabler:*` proposte sono già state verificate come esistenti su Iconify (2026-07-09). Il seeding le scarica, normalizza e le salva; devono essere **approvate** perché l'export le usi (regola d'oro §7).
- **Nessuna modifica al motore**: `renderScene`, `scene/*`, l'engine di estrazione/ranking, i template restano invariati. Si toccano solo i file di dizionario (`dictionary/*.yaml`), il seeding icone e (per validazione) uno script di benchmark.
- **Determinismo dell'estrazione preservato**: nessuna modifica a `temperature`/`seed`/prompt. Si aggiungono solo voci enum (chiavi e categorie) allo schema.

## 4. Architettura

Nessun nuovo componente. Si estendono due file dati versionati in git:

- `dictionary/categories.yaml` — aggiunge 3 sotto-categorie clima all'enum categoria.
- `dictionary/features.yaml` — aggiunge ~33 chiavi feature.

Il resto della pipeline consuma automaticamente le nuove voci: l'enum `categoria` e l'enum `chiave_canonica` dello structured output Gemini si allargano da soli (derivati dal dizionario), il ranking usa `priorita`/`categorie`, il render risolve le icone per chiave dal DB.

## 5. Split categoria clima

`categories.yaml` (version 2) aggiunge tre sotto-categorie e mantiene `condizionatore` come generico/split fisso:

- `condizionatore_portatile` — condizionatori portatili (monoblocco, con tubo/kit finestra)
- `ventilatore` — ventilatori (a piantana, da tavolo, a torre)
- `deumidificatore` — deumidificatori
- `condizionatore` (esistente) — split fissi / a parete (inverter, pompa di calore, wifi)

Gemini classifica il prodotto in una di queste; poi estrae solo le feature il cui testo è presente. Un ventilatore non riceve "sbrinamento" se non citato.

## 6. Nuove chiavi feature

Tutte con icone `tabler:*` verificate esistenti. `valore: obbligatorio` = l'etichetta contiene `{valore}` (numero/misura da estrarre); `assente` = etichetta fissa. `badge: true` = elemento posizionato vicino alla foto.

### Clima — modalità e capacità

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `modalita_raffresca` | Raffresca | tabler:snowflake | 92 | no | assente | condizionatore_portatile, condizionatore |
| `modalita_deumidifica` | Deumidifica | tabler:droplet | 90 | no | assente | condizionatore_portatile, deumidificatore, condizionatore |
| `modalita_ventila` | Ventila | tabler:wind | 88 | no | assente | condizionatore_portatile, ventilatore, condizionatore |
| `potenza_btu` | {valore} BTU | tabler:temperature-snow | 85 | sì | obbligatorio | condizionatore_portatile, condizionatore |
| `capacita_deumidificazione` | Assorbe {valore} L al giorno | tabler:droplet-half-2 | 78 | no | obbligatorio | condizionatore_portatile, deumidificatore |
| `capacita_serbatoio` | Serbatoio acqua {valore} L | tabler:bottle | 55 | no | obbligatorio | condizionatore_portatile, deumidificatore |
| `intervallo_temperatura` | Intervallo {valore} | tabler:temperature | 65 | no | obbligatorio | condizionatore_portatile, condizionatore |
| `sbrinamento_automatico` | Sbrinamento automatico | tabler:snowflake-off | 60 | no | assente | condizionatore_portatile, condizionatore, deumidificatore |
| `ruote_pivotanti` | {valore} ruote pivotanti | tabler:circle-dot | 50 | no | obbligatorio | condizionatore_portatile, deumidificatore |
| `kit_finestra` | Kit installazione finestra incluso | tabler:window | 45 | no | assente | condizionatore_portatile |

### Clima — ventilatore

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `oscillazione` | Oscillazione | tabler:arrows-horizontal | 80 | no | assente | ventilatore |
| `pale_diametro` | Pale Ø {valore} cm | tabler:propeller | 72 | no | obbligatorio | ventilatore |
| `testa_inclinabile` | Testa inclinabile | tabler:angle | 70 | no | assente | ventilatore |
| `altezza_regolabile` | Altezza regolabile | tabler:arrows-move-vertical | 68 | no | assente | ventilatore |
| `velocita_ventilazione` | {valore} velocità | tabler:wind-electricity | 66 | no | obbligatorio | ventilatore, condizionatore_portatile |
| `griglia_protezione` | Griglia di protezione | tabler:grid-dots | 55 | no | assente | ventilatore |

### Clima — condivise e split fisso

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `funzione_inverter` | Funzione inverter | tabler:refresh | 75 | no | assente | condizionatore |
| `pompa_calore` | Pompa di calore | tabler:flame | 74 | no | assente | condizionatore |
| `timer_ore` | Timer {valore}H | tabler:clock | 62 | no | obbligatorio | condizionatore_portatile, ventilatore, deumidificatore, condizionatore |
| `connettivita_wifi` | WiFi | tabler:wifi | 60 | no | assente | condizionatore |
| `telecomando_incluso` | Telecomando incluso | tabler:device-remote | 58 | no | assente | condizionatore_portatile, ventilatore, condizionatore |

### Arredo — esterno e interno (condivise)

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `struttura_ferro` | Struttura in ferro | tabler:fence | 61 | no | assente | arredo_esterno, arredo_interno |
| `struttura_alluminio` | Struttura in alluminio | tabler:building | 60 | no | assente | arredo_esterno |
| `piedini_antiscivolo` | Piedini antiscivolo | tabler:grip-horizontal | 52 | no | assente | arredo_esterno, arredo_interno |
| `richiudibile` | Richiudibile e salvaspazio | tabler:fold | 55 | no | assente | arredo_esterno, arredo_interno |
| `copertura_poliestere` | Copertura in poliestere | tabler:shirt | 45 | no | assente | arredo_esterno |
| `top_ceramica` | Top in ceramica | tabler:circle-square | 68 | no | assente | arredo_esterno |
| `design_moderno` | Design moderno | tabler:sparkles | 35 | no | assente | arredo_interno, arredo_esterno |

### Arredo — interno (specchi e mobili)

| chiave | label | icona | prio | badge | valore | categorie |
|---|---|---|---|---|---|---|
| `specchio_figura_intera` | Specchio a figura intera | tabler:rectangle-vertical | 80 | no | assente | arredo_interno |
| `cornice_legno` | Cornice in legno MDF | tabler:frame | 65 | no | assente | arredo_interno |
| `apertura_cavalletto` | Apertura a cavalletto | tabler:triangle | 60 | no | assente | arredo_interno |
| `vano_contenitore` | Doppio vano interno | tabler:box | 55 | no | assente | arredo_interno |
| `portata_ripiano` | Portata {valore} kg per ripiano | tabler:stack-2 | 50 | no | obbligatorio | arredo_interno |

**Totale: 33 nuove chiavi + 3 nuove categorie.**

### Modifiche a chiavi esistenti

- `schienale_reclinabile`: aggiungere `arredo_esterno` alle categorie (sdraio/poltrone da giardino reclinabili, 15× nel mining) — se non già presente.
- Nessun'altra modifica alle 23 chiavi esistenti.

## 7. Copertura attesa sui 3 prodotti benchmark

- **Condizionatore portatile 5925927**: modalita_raffresca, modalita_deumidifica, modalita_ventila, potenza_btu (7000, badge), capacita_deumidificazione (19,2), intervallo_temperatura (15-31°C), timer_ore (24), telecomando_incluso, capacita_serbatoio (0,43), ruote_pivotanti (4), kit_finestra, sbrinamento_automatico, + classe_energetica/lunghezza_cavo esistenti → **scheda ricca** (≥6 in colonna dopo ranking + badge BTU).
- **Tavolo mosaico 2195799** (arredo_esterno): struttura_ferro, top_ceramica, piedini_antiscivolo, uso_interno_esterno (esistente) → **4 feature**. (Le quote Ø restano assenti finché non si fa il fix parser dimensioni, fuori scope qui.)
- **Specchio 5922547** (arredo_interno): specchio_figura_intera, cornice_legno, apertura_cavalletto, struttura_ferro → **4 feature**.

## 8. Testing

- **`dictionary.test.ts`** deve restare verde: schema valido, nessun duplicato, categorie referenziate esistenti, icone in forma `set:name`. Se il test non copre già "ogni categoria referenziata esiste in categories.yaml", aggiungerlo.
- **Golden determinismo** (`render-svg.test.ts`, fixture barbecue): invariato per costruzione (nessuna chiave tocca barbecue). Verificare che resti verde senza rigenerare fixture.
- **Seeding icone**: dopo l'aggiunta, `seed:icons` (o script equivalente) scarica e approva le 33 nuove icone. Verificare 33 create, 0 falliti (icone già verificate esistenti).
- **Validazione end-to-end**: ri-eseguire il benchmark sui 3 SKU (5925927, 2195799, 5922547) con la pipeline reale e confermare visivamente il passaggio a "buona".

## 9. Note per fasi successive

- Fix parser dimensioni formato diametro `Ø` (per le quote dei prodotti tondi).
- Espansione dizionario alle restanti categorie verso il target 100-150 chiavi.
- Rifinitura estetica delle icone Tabler (alcune approssimative, es. `tabler:wheel`).
- Titolo scheda: formattare o rimuovere la chiave categoria grezza.
