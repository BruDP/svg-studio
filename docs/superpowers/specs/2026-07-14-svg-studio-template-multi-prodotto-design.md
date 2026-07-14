# SVG Studio — Template multi-prodotto (set) — Design

**Data**: 2026-07-14
**Stato**: approvato in brainstorming, in attesa di revisione finale spec
**Dipende da**: template `colonna-sinistra` (Fase 2, `src/lib/layout/colonna-sinistra.ts`), pipeline
`resolveBBox` (spec Vision bbox, `2026-07-13-svg-studio-vision-bbox-design.md`, chiusa su `main`) e
crop/quote al cambio foto (`2026-07-13-svg-studio-crop-cambio-foto-design.md`, chiusa su `main`). Riusa
`resolveBBox`, `FOTO_BOX`, `fitFoto`, `quoteFromBBox`, `parseDimensions` senza ridefinirne la logica.

## 1. Obiettivo

Aggiungere il template mancante della v1 (spec master §6, mai implementato) per generare schede di **set
di prodotti** — insiemi venduti come un unico SKU ma composti da più pezzi con misure e dati propri (set
valigie, set giardino, ecc.). Oggi il motore produce un solo template, `colonna-sinistra`: icone in
colonna a sinistra + **una** foto ritagliata a destra con le sue quote + badge sotto. Per un set questo
è inadeguato: perde le misure e le capacità dei singoli pezzi.

Il nuovo template compone una scheda con **N sotto-prodotti** (2-3), ciascuno con la propria foto
ritagliata, le proprie quote e i propri badge (capacità/portata), più **una lista di icone-feature
condivisa** per l'intero set.

**Metrica di successo.** Data una scheda di set reale dal feed, il tool produce in modo deterministico
una scena valida con un blocco foto+quote+badge per ogni pezzo del set e una lista icone condivisa;
l'operatore rifinisce (riassegna la foto di ciascun pezzo, riordina le icone) e la esporta con qualità
paragonabile alle schede fatte a mano di riferimento. Nessuna regressione sul template `colonna-sinistra`
e sul suo golden; tutta la logica nuova testabile offline.

## 2. Riferimenti reali (schede fatte a mano + dati dal feed)

L'utente ha fornito due schede tecniche reali di set, che sono il riferimento di design più concreto.
I dati sotto vengono dal feed reale (DB `data/svg-studio.db`, lettura in sola lettura).

### 2.1 Set 3 valigie — SKU `5926962` ("Set 3 valigie, rosso, Sibilla Travel")

**Scheda manuale (`5926962.png`)**: TRE foto di valigie affiancate in alto, in ordine di taglia
(grande → media → piccola). Sopra ciascuna foto, il testo "capacità 99 L / 60 L / 38 L". Attorno a
ciascuna foto le quote: altezza (freccia verticale a destra), larghezza e profondità (in basso). SOTTO,
su tutta la larghezza, una **griglia icone condivisa 3 colonne × 3 righe** con 7 feature: 4 ruote girevoli
a 360°, chiusura con combinazione, doppia cerniera, maniglia e piedini di appoggio laterali, manico
regolabile, cinghia incrociata ferma panni, ultraleggere e resistenti.

**Dati dal feed** (`notaTecnica`, pattern pulito e regolare):
- `Misure valigia piccola: l. 36 x p. 22 x h. 55 cm` — `Capacità valigia piccola: 38 L` — `Peso … 2,5 kg`
- `Misure valigia media:   l. 42 x p. 26 x h. 64 cm` — `Capacità valigia media: 60 L`  — `Peso … 3,1 kg`
- `Misure valigia grande:  l. 47 x p. 28 x h. 75 cm` — `Capacità valigia grande: 99 L` — `Peso … 3,8 kg`
- 6 immagini nel feed. Le feature condivise combaciano esattamente con `MAX_ICON_FEATURES = 7`.

Questo è il caso **pulito**: ogni pezzo ha una riga `Misure <etichetta>: <l×p×h>` e una riga
`Capacità <etichetta>: <N> L`, associabili per etichetta con regex deterministica.

### 2.2 Set giardino 4 posti — SKU `2188908` ("Set giardino 4 posti, in alluminio, Ibiza Esté")

**Scheda manuale (`2188908.png`)**: UNA colonna icone condivisa a sinistra (4 feature: cuscini
sfoderabili, imbottitura soffice, montaggio facile, interno/esterno) + TRE elementi prodotto a
destra/sotto, ciascuno con foto e quote proprie e un badge di **portata** (KG): divano (140×86 cm,
300 KG) in alto a destra, tavolino (110×64,5×40,5 cm, 50 KG) in basso a sinistra, poltroncina
(75×86 cm, 300 KG) in basso a destra. (Nota: la scheda manuale indica 300 KG per la poltroncina, mentre
il feed riporta 150 Kg — piccola discrepanza della scheda manuale; il tool userà il dato del feed.)

**Dati dal feed** (`notaTecnica`, pattern **sporco**):
- `Misure poltroncine: l. 75 x p. 85 x h. 86 cm` — `Portata massima poltroncine: 150 Kg`
- `Misure divanetto:   l. 140 x p. 85 x h. 86 cm` — `Portata massima divanetto: 300 Kg`
- `Misure tavolinetto: l. 110 x p. 64,5 h. 40,5 cm` — `Portata massima tavolinetto: 50 Kg`
  **(manca la `x` tra `p. 64,5` e `h. 40,5`** → la regex `LABELED` attuale NON matcha questa riga)
- righe **di rumore** con la stessa forma: `Misure seduta: l. 65 x p. 64 cm`, `Misure cuscino divano:
  l. 130 x p. 67,5 x h. 11 cm`, `Misure cuscini poltroncine`, `Misure cuscini schienale` → misure di
  accessori, NON dei pezzi del set. Il badge è `Portata massima <etichetta>: <N> Kg`, non `Capacità … L`.

Questo è il caso **sporco**: richiede filtro delle righe-accessorio, tolleranza al separatore mancante,
badge di portata (Kg) e associazione per etichetta. È di natura diversa e più fragile del caso valigie.

**Conseguenza di design chiave (vedi §5 e la divisione in due piani):** il caso valigie è
deterministicamente parsabile con regex pulite; il caso giardino no, senza euristiche di filtro
sostanziose. I due casi vanno separati nell'esecuzione.

## 3. Decisione 1 — Un template flessibile, non due

La spec master §6 elenca due template distinti: `griglia-sotto` (prodotto singolo, foto in alto + icone
in griglia sotto) e `multi-prodotto` (set, 2-3 foto affiancate). **Ma entrambe le schede reali di set
sono la stessa struttura**: N foto+quote+badge affiancate in alto + **una** lista icone condivisa sotto
(valigie) o a lato (giardino). La differenza tra i due "template" della spec master è solo il numero di
foto (N=1 vs N>1); la struttura è identica.

**Decisione: un solo file/template nuovo, `multi-prodotto`, parametrizzato su N** (numero di
sotto-prodotti), con layout canonico **"riga di N foto in alto + griglia icone condivisa sotto"** (stile
valigie, §2.1). `griglia-sotto` della spec master diventa il caso degenere **N=1** dello stesso template.
Così due dei tre template della spec master si unificano in un solo file, motivato dalle schede reali che
dimostrano che sono la stessa cosa.

- **Non è "configurazione libera"** (vietata dal vincolo di progetto "nuovi template = nuovo file di
  codice"): N **non** è un parametro che l'operatore regola a mano — è **derivato dall'estrazione** (quanti
  blocchi-misura etichettati il parser trova nel testo). Tutta la geometria è calcolata deterministicamente
  da N dentro il file del template. L'unico grado di libertà è dato dai dati, non da una config.
- **Layout icone: griglia sotto, non colonna a sinistra.** Scelgo la disposizione della scheda valigie
  (foto in alto, griglia icone sotto) come canonica perché è regolare e banalmente deterministica su N
  (N colonne-foto di uguale larghezza in alto, griglia icone a larghezza piena sotto). La disposizione
  asimmetrica della scheda giardino (icone a sinistra + divano grande + due pezzi minori) è più difficile
  da rendere deterministica; la stessa scheda giardino resa con il layout "foto-in-riga + icone-sotto"
  produce comunque una scheda valida e leggibile (3 celle prodotto + griglia icone). La variante "icone a
  sinistra con foto asimmetriche" (replica pixel della scheda giardino) è **backlog** (§10), non v1.
- **Trade-off.** Un solo template più flessibile è più codice condizionale in un file rispetto a due file
  banali, ma evita la duplicazione della logica foto/quote/badge/griglia e riflette la realtà dei dati.
  Il rischio (un template "che fa troppo") è contenuto perché i binari sono fissi: N celle uguali +
  griglia, nessuna libertà di posizionamento.

## 4. Decisione 2 — Forma della scena estesa (campo `gruppo`)

Con più foto+quote+badge nella stessa scena serve distinguere quali elementi appartengono a quale pezzo,
per mutazioni mirate ("cambia la foto SOLO del tavolino").

**Decisione: campo opzionale `gruppo?: string` su `foto`, `quota`, `badge`.** Le `icona-label` (condivise)
restano **senza** `gruppo`.

```ts
// src/lib/scene/types.ts — aggiunte (campo opzionale, additivo)
export interface FotoElement  { type: 'foto';  id: string; imageHash: string; x,y,width,height: number; gruppo?: string }
export interface QuotaElement { type: 'quota'; id: string; /* … */ x1,y1,x2,y2: number; gruppo?: string }
export interface BadgeElement { type: 'badge'; id: string; testo: string; x,y: number; gruppo?: string }
// IconLabelElement e TestoElement: invariati (nessun gruppo)
```

- **Valore.** `gruppo` è un id opaco di gruppo (`g0`, `g1`, `g2`…) assegnato in ordine di estrazione (ordine
  dei blocchi-misura nel testo). Non è un'etichetta leggibile: l'etichetta del pezzo ("valigia grande")
  **non viene renderizzata** — le schede di riferimento non mostrano il nome del pezzo, solo foto+quote+badge
  di capacità/portata. Tenerlo opaco evita di introdurre un nuovo elemento `testo` per gruppo e mantiene
  la scena minimale.
- **Id degli elementi (globalmente unici, con prefisso di gruppo).** Foto `ph-g{i}`; quote `q-g{i}-{j}`;
  badge `bg-g{i}-{j}`; icone condivise `f0..fn` (invariate). Così `sposta-quota` (che indirizza per id)
  continua a funzionare cross-gruppo senza collisioni.
- **Retrocompatibilità e `SCENE_VERSION`.** Il campo è **opzionale e additivo**: le migliaia di scene
  esistenti a prodotto singolo (`colonna-sinistra`, senza `gruppo`) restano valide sotto lo schema zod
  esteso; il renderer (`svg.ts`) **ignora** `gruppo` (non lo usa per rendere) → nessuna modifica al
  renderer, golden `colonna-sinistra` intatto. **`SCENE_VERSION` resta a `1`**: non esiste codice di
  migrazione keyed sulla versione (il campo è solo uno stamp), il cambiamento è puramente additivo e
  retrocompatibile in lettura/scrittura, quindi un bump sarebbe cosmetico. Coerente con la filosofia
  minimalista di versionamento già adottata nella spec crop/cambio-foto (§3.1, che evitò del tutto
  modifiche allo schema). Si documenta a codice che `gruppo` distingue i pezzi di un set; le scene senza
  `gruppo` sono prodotto singolo.
- **Perché non un elemento contenitore "gruppo".** Introdurre un tipo `SceneElement` contenitore
  (`gruppo` con figli) romperebbe l'ipotesi "lista piatta di elementi tipizzati" su cui poggiano renderer,
  mutazioni e zod. Un campo piatto opzionale è molto meno invasivo e sufficiente per l'indirizzamento.

## 5. Decisione 3 — Estrazione multi-misura (e perché due piani)

Oggi `SchedaProposal.dimensioni` è **un** `Dimensioni | null` per l'intero prodotto, da
`parseDimensions(product.notaTecnica)`. Un set ha più blocchi di misure, etichettati per pezzo, più badge
per pezzo. Serve estendere l'estrazione **senza toccare** il percorso a prodotto singolo.

**Estensione di `SchedaProposal`** (additiva, retrocompatibile):

```ts
export interface SottoProdotto {
  gruppo: string                 // 'g0','g1',… in ordine di apparizione nel testo
  etichetta: string              // 'valigia grande' (per ordinamento/debug/tooltip, NON renderizzata)
  dimensioni: Dimensioni         // {larghezza, profondita, altezza} del pezzo
  badges: ProposedFeature[]      // badge per-pezzo: capacità (L) o portata (Kg)
}
export interface SchedaProposal {
  sku: string
  categoria: string
  features: ProposedFeature[]    // icone CONDIVISE (invariato: ranking + MAX_ICON_FEATURES)
  badges: ProposedFeature[]      // badge condivisi da dizionario (invariato; per un set spesso vuoto)
  dimensioni: Dimensioni | null  // invariato (prodotto singolo)
  sottoProdotti?: SottoProdotto[] // presente e length ≥ 2 ⇒ è un set ⇒ template multi-prodotto
}
```

**Regola di selezione template (in `compose-lib.ts`):** se `proposal.sottoProdotti` è presente e ha
lunghezza ≥ 2 → `composeMultiProdotto`; altrimenti → `composeColonnaSinistra` (identico a oggi). Il
percorso a prodotto singolo resta **byte-identico**.

### 5.1 Perché due piani sequenziali

Il caso **valigie** (§2.1) è parsabile con regex pulite e deterministiche: righe
`Misure <etichetta>: <l×p×h>` accoppiate a `Capacità <etichetta>: <N> L` per etichetta identica.
Il caso **giardino** (§2.2) richiede, in più: (a) filtrare le righe-accessorio (`seduta`, `cuscino`,
`schienale`) che hanno la **stessa forma** ma non sono pezzi del set; (b) tollerare separatori mancanti
(`p. 64,5 h. 40,5`, senza `x`); (c) gestire il badge di **portata** (`Portata massima <etichetta>: <N> Kg`)
invece di capacità; (d) evitare falsi positivi. È lavoro di parsing/estrazione sostanzioso e delicato,
di natura diversa dal layout.

**Decisione: spezzare in due piani.**

- **Piano A — Schema + template + estrazione pulita (valigie).** Estende schema/mutazioni, scrive il
  template `multi-prodotto`, gli helper di layout, l'orchestrazione compose (loop `resolveBBox` per pezzo)
  e la UI. Estrazione limitata al **caso pulito con corroborazione capacità**: un `parseSetDimensions`
  che produce `sottoProdotti` SOLO quando trova ≥2 blocchi `Misure <etichetta>` la cui `<etichetta>`
  compare **anche** in una riga `Capacità <etichetta>: <N> L`. Questo gate esclude di proposito il
  giardino (che usa `Portata … Kg`, non `Capacità … L`, e ha righe-accessorio senza capacità), così il
  Piano A non "spara" su set che non sa ancora gestire e non regredisce nulla. Golden = **5926962**.
- **Piano B — Estrazione robusta (giardino e set sporchi).** Generalizza `parseSetDimensions`: filtro
  righe-accessorio, tolleranza separatori, badge di portata (Kg), associazione per etichetta; valuta un
  passo Gemini vincolato (identifica i pezzi/associazioni, poi ri-parsing deterministico + validazione
  anti-allucinazione contro `notaTecnica`, coerente con spec master §5.3). Golden = **2188908**.

Il Piano A da solo consegna il template completo e lo valida end-to-end su un set reale; il Piano B
allarga la copertura dell'estrazione senza toccare layout/schema/mutazioni (già chiusi in A).

## 6. Decisione 4 — Foto multiple e `resolveBBox`

Ogni sotto-prodotto ha bisogno della propria foto ritagliata, con la **stessa** pipeline di `compose-lib`
(`cacheImage` → `resolveBBox` → `sharp.extract` → `fitFoto` + `quoteFromBBox`), ma applicata a **ogni**
foto, non solo alla prima.

**Problema:** il feed di un set spesso ha **una foto d'insieme** (tutto il set in una immagine) più altre
immagini che possono essere angolazioni dell'insieme o scatti dei singoli pezzi — ma **non è
deterministicamente noto quale immagine mostri quale pezzo** (nel feed le 6 immagini non hanno metadati
che le associno ai pezzi).

**Decisione (opzione (a) del brief — selezione manuale per pezzo):**

- **Al primo compose, ogni sotto-prodotto parte con `product.images[0]`** (la foto hero/d'insieme),
  ritagliata via `resolveBBox`. È l'unica assegnazione deterministica e onesta: qualunque indice > 0
  sarebbe un'ipotesi non verificabile sul significato dell'immagine. Il primo render mostra quindi lo
  **stesso ritaglio** in tutte le celle — uno stato di partenza noto che l'operatore corregge subito.
- **L'operatore riassegna la foto di ciascun pezzo** dalla UI (picker per gruppo → mutazione
  `imposta-foto` con `gruppo`, §7). Questo è il flusso previsto: editing manuale mirato, nessuna magia.
- **NON si tenta il multi-crop da una singola foto d'insieme** (rilevare N prodotti in una immagine):
  troppo complesso e fuori scope per questo giro (opzione (b) del brief, scartata). Backlog §10.
- **`resolveBBox` per OGNI foto:** `composeMultiProdotto`/`compose-lib` esegue la pipeline di crop per
  ciascun gruppo (in Piano A tutte su `images[0]`, quindi in pratica un solo hash ritagliato riusato); al
  cambio foto per gruppo la stessa pipeline gira sulla nuova foto (identica a `cambiaFotoAction`, esteso
  con `gruppo`). Nessuna modifica a `resolveBBox`.
- **Trade-off documentato:** il primo render con foto identiche non è "bello" ma è deterministico e
  onesto; la parità visiva con la scheda manuale si ottiene dopo la riassegnazione. Un'euristica di
  auto-assegnazione (es. `images[min(i, len-1)]`) darebbe un primo render più vario ma basato su
  un'ipotesi errabile sull'ordine delle immagini → **backlog** (§10), non default.

## 7. Decisione 5 — Icone condivise (confermato) e Decisione 6 — Mutazioni

### 7.1 Icone condivise — nessun cambiamento all'estrazione/ranking

In entrambe le schede reali le icone-feature sono **condivise** per l'intero set (una lista sola). Quindi
`rankFeatures`/`MAX_ICON_FEATURES` (`src/lib/extraction/ranking.ts`) restano **invariati**:
`proposal.features` è la lista condivisa esattamente come oggi. Nessuna icona per-pezzo. (Confermato dai
7 elementi condivisi delle valigie = `MAX_ICON_FEATURES`.)

### 7.2 Mutazioni — `imposta-foto` mirato per gruppo

Le azioni sulle icone (`sposta-feature`, `rimuovi`, `aggiungi-feature`, `modifica-etichetta`) operano
sulla lista condivisa e **non cambiano**. `sposta-quota` indirizza per id (globalmente unico) e non
cambia.

**Estensione: `imposta-foto` guadagna un `gruppo?: string` opzionale.**

```ts
| {
    type: 'imposta-foto'
    imageHash: string
    gruppo?: string    // se presente, agisce SOLO su foto/quota di quel gruppo
    foto?: { x,y,width,height: number }
    quote?: QuotaSpecLike[]
  }
```

- **Senza `gruppo`** (prodotto singolo, comportamento odierno): agisce su **tutte** le foto/quota della
  scena (che sono una sola foto + le sue quote). **Retrocompatibile al 100%** con la mutazione estesa
  della spec crop/cambio-foto.
- **Con `gruppo`** (set): filtra gli elementi `foto`/`quota` per `el.gruppo === action.gruppo`; aggiorna
  la foto di quel gruppo e sostituisce **posizionalmente** le sue quote (stessa logica id/ordine
  della spec crop, ma ristretta al gruppo — gli id sono `q-g{i}-{j}`). Le foto/quote degli **altri
  gruppi**, le icone, i badge e i testi restano intatti. Puro e deterministico.
- **`cambiaFotoAction` esteso** con `gruppo?: string`: usa `parseSetDimensions` per ri-derivare le
  dimensioni **del pezzo giusto** (per etichetta/gruppo) invece di `parseDimensions`, e calcola le quote
  con la cella-foto di quel gruppo. Ri-derivazione da `notaTecnica` (stessa fonte del compose), coerente
  con la spec crop §3.1. Ritorna `{ imageHash, imageDataUri, foto, quote, gruppo, ritagliata }`.
- **Aggiungere/rimuovere un sotto-prodotto** dal set (editing strutturale): **fuori scope v1**. N deriva
  dall'estrazione. Backlog §10.

## 8. Layout del template `multi-prodotto` (geometria deterministica)

Canvas 1000×1000, invariato. Due zone:

1. **Riga foto (in alto).** N celle di uguale larghezza. Larghezza utile ≈ `1000 − 2·margineX`, divisa
   per N; ogni cella riserva spazio a destra per la freccia-quota verticale + etichetta (~`freccia.testa`
   + label) e in basso per la quota orizzontale + etichetta. Dentro ogni cella:
   - **foto** ritagliata inscritta con `fitFoto(bbox, cellaBox)` (riuso invariato).
   - **quote** con `quoteFromBBox(fitted, dimensioniDelPezzo)` (riuso invariato: verticale=altezza a
     destra, orizzontale=larghezza sotto, diagonale=profondità). Le celle hanno gutter sufficiente perché
     la quota verticale + etichetta di una cella non invada la cella successiva.
   - **badge** (capacità/portata) posizionato **sopra** la foto della cella (come "capacità 99 L" nella
     scheda valigie).
2. **Griglia icone condivisa (sotto).** A larghezza piena, `grigliaPositions(n, cols=3, …)`: n icone in
   3 colonne (righe = ⌈n/3⌉), stesso elemento `icona-label` (cerchio outline + etichetta a destra) del
   template esistente, disposto in griglia invece che in colonna.

**Nuovi helper in `engine.ts`** (additivi, `colonna-sinistra` non li usa):
- `celleProdotti(n, opts) → { x,y,width,height }[]` — i box-foto delle N celle in alto.
- `grigliaPositions(n, opts) → Punto[]` — le posizioni delle icone nella griglia sotto.

`fitFoto`, `quoteFromBBox`, `cm()`, `colonnaPositions` **non cambiano**. Le costanti geometriche (marginX,
altezza zona foto, gutter, righe/colonne griglia, offset badge) sono definite nel file del template con
valori iniziali sensati, tarati alla creazione del golden. Il template è **puro** (input: proposal +
foto/bbox per gruppo; output: `Scene`), come `composeColonnaSinistra`.

## 9. Gestione errori (coerente con spec master §8)

| Problema | Comportamento |
|---|---|
| `parseSetDimensions` trova < 2 blocchi validi | Non è un set → `sottoProdotti` assente → `composeColonnaSinistra` (nessuna regressione) |
| Set con N pezzi ma feed con 1 sola foto d'insieme | Tutte le celle partono da `images[0]` ritagliata; operatore riassegna per pezzo (§6) |
| bbox non rilevabile per una foto (sfondo non uniforme) | `resolveBBox` → Vision → se nullo, immagine intera in quella cella; quote di default da sistemare a mano (come oggi) |
| Un pezzo senza misure complete (manca una quota) | `quoteFromBBox` emette solo le quote disponibili (già così: salta i campi `null`) |
| Un pezzo senza badge (capacità/portata assente) | Nessun badge per quel gruppo (lista badge vuota) |
| Set con N > 3 pezzi | v1 rende comunque N celle (il layout stringe le celle); se illeggibile, l'operatore interviene. Cap/avviso a N=3 è backlog |
| Cambio foto di un gruppo, degrado Vision | Immagine intera per quel gruppo, messaggio non bloccante; altri gruppi intatti |

Principio invariato: **l'app degrada, non si blocca.**

## 10. Criteri di successo

- Un solo template nuovo `multi-prodotto` (file nuovo), selezionato deterministicamente quando
  `sottoProdotti.length ≥ 2`; `griglia-sotto` = caso N=1 dello stesso template.
- Scena estesa con `gruppo?` opzionale su foto/quota/badge; icone senza gruppo; `SCENE_VERSION` = 1;
  scene esistenti (prodotto singolo) valide e renderizzate identiche; renderer invariato.
- `SchedaProposal.sottoProdotti?` additivo; `parseSetDimensions` deterministico; **Piano A** copre il caso
  valigie (corroborazione capacità), **Piano B** il caso giardino (robusto). `parseDimensions` e
  `rankFeatures`/`MAX_ICON_FEATURES` invariati.
- Ogni sotto-prodotto usa la pipeline `resolveBBox` per la propria foto; primo compose da `images[0]` per
  tutti i gruppi; riassegnazione manuale per gruppo via `imposta-foto` con `gruppo`.
- `imposta-foto` esteso con `gruppo` è puro, mirato, retrocompatibile (senza gruppo = comportamento
  odierno). `cambiaFotoAction` esteso ri-deriva le dimensioni del pezzo giusto.
- **Determinismo:** golden `colonna-sinistra` (barbecue 2137070) e `render-svg` **byte-identici**; nuovo
  golden `multi-prodotto` su SKU reale **5926962** (Piano A) e **2188908** (Piano B). `tsc` pulito,
  `npm test` verde. Tutta la logica nuova offline (DI/fake dove serve).
- Nessun batch senza revisione (fuori scope).

## 11. Note per fasi successive (backlog)

- Variante layout "icone a sinistra + foto asimmetriche" (replica pixel della scheda giardino §2.2), se
  richiesta esteticamente.
- Auto-assegnazione euristica delle foto per pezzo (es. `images[min(i,len-1)]`) come primo render più
  vario, flaggata "da verificare" — oggi default a `images[0]` per tutti (§6).
- Multi-crop: rilevare N prodotti in una singola foto d'insieme (bbox multipli) — scartato in v1 (§6).
- Editing strutturale del set (aggiungi/rimuovi sotto-prodotto) — oggi N deriva dall'estrazione (§7.2).
- Cap/avviso esplicito a N=3 pezzi nel layout (§9).
- Etichetta leggibile del pezzo come elemento `testo` per gruppo, se in futuro si vuole mostrare il nome
  ("valigia grande") in scheda (oggi non mostrato, coerente con i riferimenti).
- Backlog invariato dai lotti precedenti (Vision bbox / crop): `promptVersion` in `VisionBBox`, tarature
  soglie, riposizionamento automatico badge al cambio foto.
