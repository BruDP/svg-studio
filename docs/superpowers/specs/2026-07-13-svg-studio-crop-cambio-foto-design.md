# SVG Studio — Crop/bbox automatico al cambio foto + forza Vision nell'editor — Design

**Data**: 2026-07-13
**Stato**: approvato in brainstorming, in attesa di revisione finale spec
**Dipende da**: `2026-07-13-svg-studio-vision-bbox-design.md` (fallback Gemini Vision per bbox, già chiuso su `main` — commit `451304c`/`3299d4a`). Riusa `resolveBBox` senza ridefinirne la logica.

## 1. Obiettivo

Oggi, quando l'operatore cambia la foto nell'editor (Fase 3c, `PhotoPicker` → `cambiaFotoAction` →
mutazione `imposta-foto`), la nuova immagine viene semplicemente **adattata** nello stesso riquadro
(`preserveAspectRatio="xMidYMid meet"`): nessun ritaglio, nessun ricalcolo del bounding box, nessun
aggiornamento delle frecce-quota. Il risultato è una foto con margini vuoti e quote che non combaciano
con l'estensione reale del prodotto — l'esatto contrario di ciò che il primo compose (`compose-lib.ts`)
produce, dove il prodotto è ritagliato sul suo bbox e riempie il riquadro.

La feature (decisione presa con l'utente — "feature completa") porta il cambio-foto alla stessa qualità
del primo compose, più un controllo manuale per i casi limite:

1. **Crop automatico al cambio foto.** Quando si sceglie una foto nel `PhotoPicker`, il bbox del
   prodotto viene ricalcolato con la stessa pipeline del primo compose (`resolveBBox`: scansione pixel,
   fallback Gemini Vision se sfondo non uniforme, cache per hash immagine), l'immagine viene ritagliata
   e le frecce-quota vengono riposizionate sull'estensione del nuovo ritaglio.
2. **Pulsante "Ricalcola ritaglio con Vision".** Un pulsante nell'editor forza la chiamata a Gemini
   Vision sulla **foto già selezionata**, anche quando lo sfondo sembra uniforme (la scansione pixel dà
   un risultato accettabile ma non ottimale, oppure l'operatore vuole semplicemente rifare il
   rilevamento con un nuovo tentativo, ignorando l'eventuale risultato cachato).

**Metrica di successo.** Dopo un cambio foto nell'editor, il prodotto della nuova foto riempie il
riquadro e le quote combaciano con la sua estensione (o, se il bbox non è rilevabile, l'immagine intera
con quote di default da sistemare a mano — mai un ritaglio che amputa il prodotto), esattamente come al
primo compose. Il pulsante "Ricalcola con Vision" produce un nuovo tentativo Vision anche su sfondo
uniforme. Nessuna regressione sui golden test di determinismo; tutta la logica nuova resta testabile
offline.

## 2. Contesto e vincoli del codice esistente

- **Primo compose** (`scripts/compose-lib.ts`, `composeSceneForProduct`): `cacheImage(url)` →
  `resolveBBox(bytes, hash, {mime})` → se bbox trovato `sharp().extract()` ritaglia (nuovo hash via
  `writeImageBytes`) → `composeColonnaSinistra({proposal, imageHash, bbox})` che posiziona la foto con
  `fitFoto(bbox, FOTO_BOX)` e genera le quote con `quoteFromBBox(fitted, proposal.dimensioni)`.
- **`FOTO_BOX`** (`src/lib/layout/colonna-sinistra.ts`, `{x:460,y:95,width:400,height:780}`): il
  riquadro fisso in cui la foto è inscritta. Oggi **non esportato**.
- **`fitFoto(bbox, box)`** (`src/lib/layout/engine.ts`): scala il bbox dentro il riquadro mantenendo
  l'aspect ratio, centrandolo → `{x,y,width,height}`. Se il bbox è `null`, `compose-lib` usa
  `fitFoto({width:FOTO_BOX.width, height:FOTO_BOX.height}, FOTO_BOX)` → foto che riempie il riquadro.
- **`quoteFromBBox(fitted, dim)`** (`engine.ts`): da `fitted` + `dim:{larghezza,profondita,altezza}`
  (NUMERI) produce le `QuotaSpec` (`{orientamento, valore, x1,y1,x2,y2}`). La mappa orientamento→misura
  è **deterministica**: `verticale=altezza`, `orizzontale=larghezza`, `diagonale=profondita`. `cm()`
  formatta il numero in stringa (`84.5 → "84,5 cm"`) e la mette in `valore`. **I numeri originali non
  vengono salvati nella scena** (solo `valore` stringa + coordinate).
- **`parseDimensions(notaTecnica)`** (`src/lib/extraction/dimensions.ts`): funzione **pura e
  deterministica** che ricava `Dimensioni | null` da `product.notaTecnica`. È la **stessa** fonte usata
  da `extractProposal` per popolare `proposal.dimensioni` (engine.ts riga 51). Nessuna AI.
- **Scena** (`src/lib/scene/types.ts`, `SCENE_VERSION = 1`; zod in `schema.ts`): salvata come JSON
  (`model Scene`). L'elemento `foto` ha `{imageHash,x,y,width,height}`; `quota` ha
  `{orientamento,valore,x1,y1,x2,y2}`. **Nessuna colonna per le dimensioni numeriche.**
- **Mutazioni** (`src/lib/scene/mutations.ts`): azioni pure Redux-like via `applyMutation`. Oggi
  `imposta-foto` cambia **solo** `imageHash`. `sposta-quota` trascina un estremo di una quota (clamp al
  canvas). Non esistono mutazioni che editino il testo `valore` di una quota né che rimuovano quote.
- **Percorso UI cambio-foto**: `PhotoPicker` (thumbnail di `product.images`) → `StudioClient.cambiaFoto(url)`
  → `cambiaFotoAction(sku,url)` (oggi ritorna `{imageHash, imageDataUri}` dell'immagine **intera**, senza
  crop) → client dispatcha `{type:'imposta-foto', imageHash}` sul reducer locale e aggiorna l'anteprima.
- **`resolveBBox`** (`src/lib/images/resolve-bbox.ts`): orchestratore già esistente
  (scan → Vision se `scartoAngoli > sogliaAngoli`, con cache). `ResolveBBoxDeps` accetta `askVision`,
  `loadCachedBBox`, `saveCachedBBox`, `sogliaAngoli`, `mime`. **Da riusare, non ridefinire.**

## 3. Le quattro decisioni di design

### 3.1 Il gap delle dimensioni numeriche → **ri-derivare da `parseDimensions`, non dalla scena**

Per ricalcolare le quote (`quoteFromBBox`) dopo un nuovo bbox servono i numeri
`{larghezza,profondita,altezza}`, che **non sono nella scena**. Opzioni considerate:

- **(a) Invertire `cm()` dalle stringhe `valore`** (`"84,5 cm" → 84.5`). Fragile: accoppia il codice al
  formato di `cm()` (virgola decimale italiana, gestione zeri), si romperebbe se `cm()` cambiasse, e
  richiede di re-inferire la mappa quota→misura (fattibile via `orientamento`, ma comunque un giro
  indiretto). Recupera il numero ma non è la fonte di verità.
- **(b) Estendere lo schema `Scene`/`quota` con il valore numerico originale.** Richiederebbe di toccare
  `types.ts` + `schema.ts` (zod) e ragionare sul versionamento (`SCENE_VERSION`); le scene già salvate
  in DB non avrebbero il campo → serve un campo opzionale retrocompatibile e comunque un fallback per le
  vecchie scene. Costo alto per un dato che è già ricavabile altrove.

**Decisione: nessuna delle due.** I numeri si **ri-derivano lato server** con
`parseDimensions(product.notaTecnica)` — la **stessa identica fonte deterministica** che `extractProposal`
usa per `proposal.dimensioni` al primo compose. La server action del cambio-foto ha già `product` in
scope (lo carica via `getProduct(sku)` per validare l'URL). Quindi:

- **Nessuna modifica a `types.ts`/`schema.ts`, nessun bump di `SCENE_VERSION`.** La forma della scena
  persistita è invariata; cambia solo la forma di un'**azione** (runtime, non persistita, non validata da
  zod). Questa è la vittoria di semplicità dell'approccio.
- **Nessun accoppiamento al formato di `cm()`** né inversione fragile di stringhe.
- Coerenza garantita: `parseDimensions` è pura e deterministica → su `notaTecnica` immutata ridà gli
  stessi numeri (e lo stesso numero/ordine di quote) del primo compose.
- Edge noto (backlog): se in futuro si introducesse una mutazione per **editare a mano il testo di una
  quota**, la ri-derivazione da `parseDimensions` ignorerebbe quell'edit. Oggi non esiste tale
  mutazione, quindi `parseDimensions` è autoritativa. Annotato in §9.

### 3.2 Ricalcolo automatico vs lavoro manuale già fatto → **il cambio-foto ricalcola SOLO `foto`+`quota`; icone/badge/testo intatti; le quote trascinate a mano vengono resettate (per forza di cose)**

Il vero nodo architetturale: cosa succede al lavoro manuale già fatto quando l'operatore cambia foto?

- **Quote trascinate a mano (`sposta-quota`).** Le coordinate di una quota sono **ancorate al riquadro
  della foto corrente** (bordo destro per la verticale, ecc.). Cambiando foto, il `fitted` cambia (nuovo
  aspect ratio, nuova posizione dentro `FOTO_BOX`): le vecchie coordinate — trascinate o meno —
  puntano ai bordi della **foto vecchia** e non hanno più significato. Preservarle sarebbe sbagliato.
  Quindi il cambio-foto **rigenera** le coordinate delle quote da `quoteFromBBox(nuovoFitted, dim)`,
  **resettando** eventuali trascinamenti manuali. **È corretto e atteso**: il trascinamento era relativo
  alla foto precedente e va comunque rifatto. (Il valore numerico è invariato — viene da
  `parseDimensions` — quindi solo la geometria si azzera, non la misura.)
- **Icone-label, badge, testo.** Sono **indipendenti dalla foto** (colonna sinistra / sotto la foto).
  Il cambio-foto **non li tocca**: ordine, etichette modificate, icone scelte a mano restano intatti.
  Questo rispetta il lavoro manuale sulle feature, che è il grosso dell'editing.
- **Trade-off documentato — badge.** In `composeColonnaSinistra` i badge sono posizionati sotto la foto
  (`fitted.y + fitted.height + ...`). Se la nuova foto ha un aspect ratio molto diverso, l'altezza del
  `fitted` cambia e i badge **non vengono riposizionati** (li lasciamo dove sono per non azzerare
  eventuali aggiustamenti manuali e per non ampliare lo scope). Nel caso peggiore l'operatore nudge il
  badge a mano; il riposizionamento automatico dei badge al cambio-foto è nel backlog (§9).

**Sintesi**: il cambio-foto è un'azione **rara e intenzionale sulla foto**; ricalcolare `foto`+`quota`
e lasciare tutto il resto è il comportamento meno sorprendente. Coerente con la spec master §8 ("frecce
in posizione default da sistemare a mano").

### 3.3 Rappresentare "forza Vision" → **flag opzionale `forzaVision` in `ResolveBBoxDeps`, che bypassa il gate angoli E la lettura cache, ma continua a scrivere in cache**

`resolveBBox` chiama Vision solo se `scartoAngoli > sogliaAngoli`. Per forzare Vision senza duplicare la
logica né rompere la firma usata da `compose-lib.ts`:

**Decisione**: aggiungere `forzaVision?: boolean` a `ResolveBBoxDeps`. Quando `true`:

1. **Salta il gate "sfondo uniforme"** (`scartoAngoli <= sogliaAngoli`) → va **sempre** al ramo Vision,
   qualunque sia la dispersione angoli.
2. **Bypassa la lettura cache** (`loadCachedBBox`): l'operatore che forza vuole un **nuovo tentativo**,
   non il vecchio risultato cachato (che potrebbe essere un "non trovato" o un box mediocre). Con la
   lettura cache attiva, un forza-Vision non produrrebbe nulla di nuovo.
3. **Continua a scrivere in cache** (`saveCachedBBox`, upsert → sovrascrive): il nuovo risultato diventa
   il valore cachato per quell'hash, così i cambi-foto successivi (non forzati) sullo stesso hash lo
   riusano. La scrittura resta best-effort (un errore di scrittura non scarta il box valido — stesso
   comportamento già presente in `resolveBBox`).

Motivazione: `forzaVision` è additivo e opzionale → `compose-lib.ts` (che non lo passa) mantiene
comportamento identico. Bypassare la lettura ma non la scrittura dà semantica "nuovo tentativo + aggiorna
cache", che è ciò che l'operatore si aspetta. Ogni forza-Vision spende una chiamata (intenzionale).

Errore Vision con `forzaVision` (rete/quota/`GEMINI_API_KEY` assente) → come sempre degrada a `null`
(immagine intera), **non** cacha (riprovabile). La UI mostra un avviso non bloccante (§6).

### 3.4 Nuova server action vs estensione → **una sola action parametrizzata `cambiaFotoAction(sku, url, opts?)`; l'URL corrente è tracciato dal client**

I due trigger sono: (1) cambio a una **nuova** foto (crop automatico); (2) "Ricalcola con Vision" sulla
foto **già selezionata** (forza Vision). Entrambi condividono l'intera pipeline (cache → `resolveBBox` →
crop → `fitFoto` → `quoteFromBBox`): l'unica differenza è il flag `forzaVision`.

**Decisione**: **una sola action parametrizzata**:

```ts
cambiaFotoAction(
  sku: string,
  url: string,
  opts?: { forzaVision?: boolean },
): Promise<{
  imageHash: string                                  // hash del RITAGLIO (o dell'immagine intera se bbox null)
  imageDataUri: string                               // data URI del ritaglio (o dell'immagine intera)
  foto: { x: number; y: number; width: number; height: number }   // fitFoto(bbox ?? FOTO_BOX, FOTO_BOX)
  quote: QuotaSpec[]                                 // quoteFromBBox(fitted, parseDimensions(product.notaTecnica))
}>
```

- **Recupero della foto corrente per il pulsante forza-Vision**: non si legge dalla scena. L'elemento
  `foto` della scena contiene un `imageHash` (spesso quello **ritagliato**, non l'originale) e non l'URL:
  ricostruire URL/ext da lì è fragile. **Il client traccia l'URL della foto corrente** in stato
  (`fotoUrlCorrente`, inizializzato a `product.images[0]`, aggiornato a ogni `cambiaFoto`). Il pulsante
  forza-Vision richiama `cambiaFotoAction(sku, fotoUrlCorrente, { forzaVision: true })`.
- Due action separate sarebbero duplicazione della pipeline; una action + `opts` è DRY e coerente con lo
  stile essenziale delle action esistenti.

**Riuso della pipeline senza toccare `compose-lib.ts`.** La action replica il tratto "foto" di
`composeSceneForProduct` (cache → `resolveBBox` → crop → `fitFoto` + `quoteFromBBox`) importando
direttamente `resolveBBox`, `fitFoto`, `quoteFromBBox` e `FOTO_BOX`. `FOTO_BOX` va **esportato** da
`colonna-sinistra.ts` (unica modifica a quel file). La duplicazione (~3 righe: `fitFoto(bbox ?? {…}, FOTO_BOX)`)
è **intenzionale** per non toccare il percorso golden di compose (`compose-lib`/`composeColonnaSinistra`
restano byte-identici). In fake/test l'action usa `fakeDownload()` (come oggi) e resolveBBox degrada
senza rete.

## 4. Nuova forma della mutazione `imposta-foto`

`applyMutation` resta puro e deterministico. L'azione si estende con la geometria (retrocompatibile: i
nuovi campi sono opzionali → se assenti, comportamento odierno "solo imageHash").

```ts
| {
    type: 'imposta-foto'
    imageHash: string
    foto?: { x: number; y: number; width: number; height: number }
    quote?: { orientamento: 'verticale'|'orizzontale'|'diagonale'; valore: string; x1: number; y1: number; x2: number; y2: number }[]
  }
```

Comportamento:

- L'elemento `foto`: aggiorna `imageHash` e, se `foto` è presente, anche `x/y/width/height`.
- Le `quota`: se `quote` è presente, **sostituisce posizionalmente** le quote esistenti (mantenendo gli
  `id` `q0,q1,…` e l'**ordine** nell'array → nessuno spostamento di z-order rispetto al primo compose),
  aggiornando `orientamento/valore/x1/y1/x2/y2`. Il numero e l'ordine delle quote è stabile (deriva da
  `parseDimensions` sulla stessa `notaTecnica`), quindi la mappa posizionale è corretta. Casi limite
  (difesa in profondità): se `quote` ne contiene **più** delle esistenti, le extra vengono appese con
  `id` progressivi; se ne contiene **meno**, le quote in eccesso vengono rimosse.
- `icona-label`, `badge`, `testo`: **invariati**.
- Se `quote` è omesso, le quote esistenti restano invariate (comportamento odierno). Se `foto` è omesso,
  si aggiorna solo `imageHash` (comportamento odierno). Retrocompatibilità piena.
- Purezza: nessuna mutazione dell'input (nuovi oggetti), come le altre azioni.

Il client dispatcha `{ type:'imposta-foto', imageHash, foto, quote }` con i valori restituiti dalla
action (sia per il cambio normale sia per il forza-Vision — stessa mutazione).

## 5. Server action — dettaglio pipeline

`cambiaFotoAction(sku, url, opts?)`:

1. Validazioni esistenti: `getProduct(sku.trim())`; errore se assente; errore se `url ∉ product.images`.
2. `deps = isFake() ? { download: fakeDownload() } : undefined`; se `!isFake()` e serve Vision, i
   default reali di `resolveBBox` (`askVisionDefault` + cache Prisma) sono usati automaticamente.
3. `cached = await cacheImage(url, deps)`; `bytes = readCachedImage(cached.hash, cached.ext, deps?.dir)`.
4. `mime = cached.ext === 'jpg' ? 'image/jpeg' : cached.ext === 'webp' ? 'image/webp' : 'image/png'`
   (identico a compose-lib; oppure riuso `extToMime`).
5. `box = await resolveBBox(bytes, cached.hash, { ...deps, mime, forzaVision: opts?.forzaVision })`.
6. Crop (identico a compose-lib): se `box` → `sharp(bytes).extract(box).png().toBuffer()` →
   `imageHash = writeImageBytes(cropped, deps?.dir).hash`, `bbox = {width,height}`, dataUri dal cropped;
   altrimenti `imageHash = cached.hash`, `bbox = null`, dataUri dall'immagine intera.
7. `fitted = fitFoto(bbox ?? { width: FOTO_BOX.width, height: FOTO_BOX.height }, FOTO_BOX)`.
8. `dim = parseDimensions(product.notaTecnica)`; `quote = dim ? quoteFromBBox(fitted, dim) : []`.
9. `imageDataUri = data:${extToMime(...)};base64,${bytesUsati.toString('base64')}` (cropped o intero).
10. return `{ imageHash, imageDataUri, foto: fitted, quote }`.

Nota: quando `dim` è `null` la scena non aveva quote (parseDimensions deterministico) → `quote: []` è
coerente. Quando bbox è `null` (immagine intera), `fitted` riempie `FOTO_BOX` e le quote seguono i bordi
del riquadro (default da sistemare a mano), come da spec master §8.

## 6. UI — pulsante "Ricalcola ritaglio con Vision"

- **`PhotoPicker`**: oltre alle thumbnail, evidenzia la foto corrente (bordo accento) e aggiunge un
  pulsante **"Ricalcola ritaglio con Vision"** sotto la griglia. Nuove prop: `urlCorrente: string`,
  `onRicalcola: () => void`. Il pulsante è abilitato solo quando c'è una foto corrente e non è in corso
  un'altra operazione. Testo di aiuto conciso: "Rifà il rilevamento del prodotto con l'AI di visione,
  anche su sfondo uniforme."
- **`StudioClient`**:
  - Nuovo stato `fotoUrlCorrente` (init `product.images[0]` in `proponiSku`/`riprendi`; aggiornato in
    `cambiaFoto`).
  - `cambiaFoto(url)`: chiama `cambiaFotoAction(sku, url)`, dispatcha `{type:'imposta-foto', imageHash,
    foto, quote}`, aggiorna `bundle.imageDataUri` e `fotoUrlCorrente`.
  - `ricalcolaConVision()`: chiama `cambiaFotoAction(sku, fotoUrlCorrente, { forzaVision: true })`, stesso
    dispatch/aggiornamento. Se `resolveBBox` degrada (nessun crop) mostra un avviso non bloccante
    (es. "Vision non disponibile o nessun prodotto rilevato: uso l'immagine intera"). Distinguere il
    caso "degrado" dal caso "crop riuscito" è possibile confrontando `imageHash` restituito con
    `cached.hash` non è disponibile lato client; in alternativa la action può restituire un flag
    `ritagliata: boolean` (opzionale, vedi §7) usato solo per il messaggio UI. Decisione: **aggiungere
    `ritagliata: boolean` al ritorno** per un feedback UI onesto senza inferenze fragili.
  - Entrambe le funzioni girano dentro `start(async () => …)` (useTransition) con `try/catch` che
    imposta `errore` — coerente con le altre.

Ritorno finale della action (aggiornato §3.4/§5 con il flag UI):

```ts
{ imageHash, imageDataUri, foto, quote, ritagliata: boolean }   // ritagliata = (box !== null)
```

## 7. Determinismo e test (offline)

- **Golden intatti.** `composeColonnaSinistra`, `renderScene`, `compose-lib.ts` **non cambiano**:
  `tests/render-svg.test.ts` e `tests/layout-colonna-sinistra.test.ts` restano byte-identici;
  `tests/compose-e2e.test.ts` invariato (il ramo uniforme dell'immagine bianca non tocca la nuova
  logica). La nuova logica vive in `resolve-bbox.ts` (flag additivo), `mutations.ts` (azione estesa) e
  nella server action — un percorso diverso da quello di composizione iniziale.
- **`resolveBBox` + `forzaVision`**: nuovi test in `tests/images-resolve-bbox.test.ts`, con
  `askVision` fake che conta le chiamate:
  - `forzaVision:true` su **sfondo uniforme** → chiama Vision (1) e usa il suo box (mentre senza forza
    non lo chiamerebbe).
  - `forzaVision:true` **bypassa la cache in lettura**: con `loadCachedBBox` che ritorna un vecchio
    "non trovato", forza chiama comunque Vision e restituisce il nuovo box.
  - `forzaVision:true` **scrive** il nuovo risultato in cache (`saveCachedBBox` chiamato con il box).
  - regressione: `forzaVision` assente/false → comportamento identico a oggi (tutti i test esistenti
    restano verdi).
- **Mutazione `imposta-foto` estesa**: nuovi test in `tests/scene-mutations.test.ts`:
  - con `foto`+`quote` → aggiorna geometria foto e sostituisce posizionalmente le quote mantenendo id e
    ordine; icone/badge/testo invariati; input non mutato (purezza).
  - retrocompat: solo `imageHash` (senza foto/quote) → comportamento odierno (i 2 test esistenti restano).
  - conteggio quote diverso (più/meno) → append/trim corretti.
- **Server action**: la logica delicata (crop/fit/quote) è già coperta dai test di `resolveBBox`,
  `fitFoto` (`layout-engine`), `quoteFromBBox` (`layout-engine`/`layout-colonna-sinistra`); l'action è
  orchestrazione sottile. Test offline dell'action in modalità fake (`isFake()`, `fakeDownload`,
  `resolveBBox` sul ramo uniforme senza rete) se il pattern esistente lo consente; altrimenti coprire i
  pezzi puri e verificare l'action nella validazione manuale (§8, Task 6).
- **Tutti i test offline**: nessuna rete, nessuna `GEMINI_API_KEY`, DB isolato o deps iniettate.
- `npx tsc --noEmit` pulito; `npm test` verde sull'intero branch.

## 8. Gestione errori (coerente con §8 spec master e §8 spec Vision bbox)

| Problema | Comportamento |
|---|---|
| Cambio foto, sfondo uniforme, bbox plausibile | Ritaglio dalla scansione pixel; quote ricalcolate; nessuna Vision, nessun costo |
| Cambio foto, sfondo uniforme, bbox implausibile/degenere/nullo | Immagine intera (`ritagliata:false`); quote di default sul riquadro; nessuna Vision |
| Cambio foto, sfondo **non uniforme** | Fallback Vision (via `resolveBBox`): box plausibile ⇒ ritaglio; altrimenti immagine intera |
| **Forza Vision** (pulsante) | Salta gate angoli + bypassa lettura cache → sempre Vision; scrive il nuovo risultato in cache |
| Forza Vision: risposta vuota/`trovato=false`/box implausibile | Immagine intera (`ritagliata:false`); avviso UI non bloccante; risultato ("non trovato") cachato |
| Vision: errore rete/quota / `GEMINI_API_KEY` assente | Immagine intera; avviso UI; errore **non** cachato (riprovabile) |
| `url ∉ product.images` o SKU inesistente | La action lancia; il client mostra `errore` (invariato da oggi) |
| Immagine già valutata da Vision, cambio non forzato | Risultato dalla cache DB (per hash), nessuna nuova chiamata |
| Errore lettura/scrittura cache DB | Come in `resolveBBox` odierno: lettura fallita ⇒ immagine intera senza Vision; scrittura fallita ⇒ usa comunque il box valido |

Principio invariato: **l'app degrada, non si blocca**. Senza rete/chiave, il cambio-foto su sfondo non
uniforme si comporta come un cambio con immagine intera (nessun crash), e il pulsante forza-Vision mostra
un avviso ma non interrompe l'editing.

## 9. Criteri di successo

- Cambio foto nell'editor: la nuova foto è ritagliata sul bbox (scan o Vision) e le quote combaciano con
  la sua estensione — parità visiva col primo compose sulla stessa foto.
- Su sfondo uniforme: nessuna chiamata Vision al cambio normale (asseribile con fake che conta le
  chiamate). Con il pulsante "Ricalcola con Vision": chiamata Vision effettuata anche su sfondo uniforme,
  cache in lettura bypassata, nuovo risultato scritto in cache.
- Icone/badge/testo mai alterati da un cambio foto; le quote sono rigenerate (i trascinamenti manuali
  vengono resettati, per progetto — §3.2).
- `imposta-foto` esteso è puro e deterministico; retrocompatibile (solo-`imageHash` invariato).
- Nessuna modifica a `types.ts`/`schema.ts`, `SCENE_VERSION` invariato; scena persistita byte-compatibile
  con quelle già in DB.
- Determinismo: `render-svg` e `layout-colonna-sinistra` golden byte-identici; `compose-e2e` verde e
  offline; suite completa verde; `tsc` pulito.
- Tutti i nuovi test offline (nessuna rete/chiave; DB isolato o deps iniettate). Validazione end-to-end
  con Vision reale (rete + chiave) marcata a parte e non bloccante per la chiusura del branch.

## 10. Note per fasi successive (backlog)

- Riposizionamento automatico dei **badge** al cambio-foto (oggi lasciati dove sono se il nuovo aspect
  ratio cambia molto — §3.2).
- Mutazione per **editare a mano il testo `valore`** di una quota: renderebbe `parseDimensions` non più
  autoritativa al ricalcolo → allora servirebbe la strada (b) del §3.1 (valore numerico nella scena).
- Persistenza dell'**override manuale del bbox** trascinato dall'operatore (già nel backlog della spec
  Vision bbox), così che un cambio-foto non lo resetti.
- Indicatore UI di "quale foto è ritagliata da Vision" (badge sulla thumbnail) e del costo/tempo della
  chiamata forzata.
- Batch resta **fuori scope** (deciso con l'utente): feature per singolo prodotto/singola foto
  nell'editor.
