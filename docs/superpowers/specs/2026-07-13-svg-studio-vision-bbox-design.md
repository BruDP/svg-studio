# SVG Studio — Fallback Gemini Vision per il bounding box (sfondo non uniforme) — Design

**Data**: 2026-07-13
**Stato**: approvato in brainstorming, in attesa di revisione finale spec

## 1. Obiettivo

Rendere affidabile il ritaglio della foto prodotto anche sulle foto "lifestyle" (prodotto in un
ambiente reale, sfondo non uniforme), dove la scansione a pixel di `detectBBox`
(`src/lib/images/bbox.ts`) produce un bounding box sbagliato. Implementare il fallback Gemini Vision
già previsto — ma mai realizzato — dalla spec master (`2026-07-03-svg-studio-design.md`, §1 tabella
"Image Service" e §8 riga "BBox non rilevabile (sfondo non uniforme) → Fallback Gemini Vision; poi
frecce in posizione default da sistemare a mano").

**Metrica di successo**: su un campione di foto lifestyle (foto secondarie `product.images[1+]`,
selezionabili nell'editor Fase 3c) il ritaglio non taglia più via il prodotto. Concretamente:

1. Quando i 4 angoli della foto non si assomigliano (sfondo non a tinta unita), la pipeline **non**
   usa il bbox della scansione a pixel: o ottiene un bbox plausibile da Gemini Vision, oppure usa
   l'immagine intera (nessun ritaglio) — mai un ritaglio che amputa il prodotto.
2. Le foto "da catalogo" a sfondo uniforme continuano a essere ritagliate esattamente come oggi
   (nessuna regressione, nessuna chiamata Vision, nessun costo aggiuntivo).
3. Nessuna rottura dei golden test di determinismo (§7) e nessuna chiamata di rete nei test.

## 2. Contesto e problema

`detectBBox` stima lo sfondo come **media dei 4 colori d'angolo** (`bbox.ts` righe 23-29) e marca
"prodotto" ogni pixel che se ne discosta oltre una soglia L1 (`soglia = 24`, riga 14). Il bbox è
l'estensione dei pixel marcati. Il risultato è consumato da `composeSceneForProduct`
(`scripts/compose-lib.ts`): se il bbox esiste, `sharp().extract()` ritaglia la foto sul bbox così che
il prodotto riempia il riquadro e le frecce-quota, ancorate al riquadro, combacino con la sua
estensione reale; se il bbox è `null`, si usa l'immagine intera (comportamento sicuro già esistente,
`compose-lib.ts` righe 22-34).

Questo funziona su sfondo uniforme (bianco/grigio da catalogo), ma la premessa "sfondo = un unico
colore stimabile dagli angoli" cade sulle foto lifestyle.

### 2.1 Evidenza diagnostica (raccolta 2026-07-13)

Test di `detectBBox` su ~45 foto reali dal feed (garden / arredo esterno / mare: dondolo, ombrelloni,
lettini/sdraio):

- **Foto principale** (`product.images[0]`, quella usata oggi in produzione): bbox sempre ragionevole,
  ratio area (bbox/immagine) tra 0.43 e 0.90. Nessun fallimento catastrofico nel campione — per queste
  categorie la `images[0]` tende a essere pulita.
- **Foto secondarie** (`product.images[1+]`, selezionabili a mano nell'editor): il fallimento è comune,
  di due tipi:
  1. **Ratio ≈ 1.00, bbox = intera immagine** (es. `1000×1000 @ (0,0)`): lo sfondo è una scena
     complessa (spiaggia, giardino, stanza), quasi ogni pixel viene marcato "diverso". Innocuo
     nell'effetto (equivale a nessun ritaglio) ma inutile.
  2. **Bbox piccolo e sbagliato** (es. `218×956 @ (386,17)`, ratio 0.21, foto da spiaggia):
     **pericoloso** — il crop taglia via il prodotto vero, peggio che non ritagliare. Una zona
     ristretta dello sfondo "combacia per caso" con la soglia di somiglianza al colore medio degli
     angoli, mentre il prodotto no (o viceversa).

**Conclusione**: il rischio reale non è "bbox non trovato" (già gestito con `null` → immagine intera),
ma **bbox trovato-ma-sbagliato quando lo sfondo non è uniforme**. Serve riconoscere quando la
scansione a pixel non è affidabile **prima** di decidere se chiamare Gemini Vision (chiamata costosa:
~1-2 centesimi, 8-16s, richiede `GEMINI_API_KEY` + rete, stessa fascia delle chiamate di estrazione in
`src/lib/extraction/gemini.ts`).

## 3. Decisione architetturale: come rilevare "scansione a pixel non affidabile"

Il segnale scelto come trigger primario è la **dispersione tra i 4 colori d'angolo**, non il ratio
dell'area del bbox risultante.

**Motivazione.** Il ratio è ambiguo e non separa i casi:

- ratio basso (es. 0.21) può essere sia un **prodotto piccolo su sfondo pulito** (legittimo, ratio 0.43
  osservato) sia il **caso 2 pericoloso** (bbox sbagliato su spiaggia). Il ratio da solo non distingue.
- ratio ≈ 1.0 può essere sia un **prodotto che riempie legittimamente il frame** (nessun ritaglio
  necessario, esito corretto) sia il **caso 1** (sfondo complesso). Di nuovo indistinguibili.

La dispersione degli angoli invece misura direttamente **la premessa dell'intero algoritmo**: se
"sfondo = media dei 4 angoli", allora i 4 angoli devono somigliarsi. Se non si somigliano, non esiste
un vero sfondo a tinta unita da stimare e **qualunque** bbox derivato è sospetto a prescindere dal suo
ratio. È il segnale concettualmente corretto per il gate.

**Decisione (trigger primario + guardia secondaria):**

1. **Trigger primario — dispersione angoli.** Si calcola `scartoAngoli` = massima distanza L1 a coppie
   tra i 4 colori d'angolo (RGB). Se `scartoAngoli > SOGLIA_ANGOLI` (valore iniziale **48**, cioè 2× la
   `soglia` per-pixel di 24 — se due angoli distano più del doppio della soglia di somiglianza, lo
   sfondo non è a tinta unita) → **sfondo non uniforme** → si scarta il bbox della scansione e si passa
   al fallback Vision.
2. **Guardia secondaria — plausibilità del bbox** (difesa in profondità, si applica sul ramo "sfondo
   uniforme"). Anche con angoli uniformi, un bbox degenere viene scartato: `bboxPlausibile` richiede
   `0.03 ≤ ratio_area ≤ 0.985` **e** larghezza/altezza ≥ 5% delle rispettive dimensioni immagine. Un
   bbox non plausibile su sfondo uniforme → si usa l'immagine intera (nessun ritaglio, `null`), **senza**
   chiamare Vision: se lo sfondo è davvero uniforme e la scansione non trova un prodotto plausibile,
   Vision difficilmente farebbe meglio e non vale il costo. (Il limite superiore 0.985 tratta il "bbox
   ≈ frame intero" come "nessun ritaglio utile" → esito visivo identico all'immagine intera.)

Perché non combinare i due segnali come trigger di Vision? Perché il ratio non aggiunge informazione al
trigger: il caso 2 pericoloso (bbox piccolo su spiaggia) ha sfondo non uniforme → è già catturato dalla
dispersione angoli. Il ratio serve solo come guardia di plausibilità di secondo livello, non come
criterio per spendere una chiamata Vision.

## 4. Architettura

Nessuna modifica al motore di rendering né alla scena. Si estende l'**Image Service** (spec master §1)
con l'orchestrazione del fallback. Confini netti, tutto testabile offline via dependency injection
(stesso pattern di `extractRaw`, `gemini.ts` righe 72-81, che accetta un `generate` iniettabile).

```
Image Service (esteso)
├─ bbox.ts               scansione a pixel (primitiva, INVARIATA nell'API) + dispersione angoli + plausibilità
├─ vision-bbox.ts        integrazione Gemini Vision: prompt, schema risposta, parse + validazione (DI)
├─ vision-repository.ts  cache DB del risultato Vision per hash immagine (tabella VisionBBox)
└─ resolve-bbox.ts       orchestratore: sceglie scan | Vision | intera; è ciò che compose-lib chiama
```

Flusso di `resolveBBox(imageBytes, imageHash, deps)`:

```
1. Cache DB (per imageHash): se presente → ritorna box cachato (anche "non trovato" → null). STOP.
2. Decodifica raw una volta sola → calcola bbox scansione + scartoAngoli + dimensioni immagine.
3. scartoAngoli ≤ SOGLIA_ANGOLI (sfondo uniforme):
      3a. bbox plausibile → ritorna quel box. (nessuna chiamata Vision, nessun costo)
      3b. bbox non plausibile / null → ritorna null (immagine intera). (nessuna Vision)
4. scartoAngoli > SOGLIA_ANGOLI (sfondo non uniforme):
      4a. Chiama Gemini Vision (deps.askVision) → parse + validazione plausibilità (in px immagine).
      4b. box Vision plausibile → salva in cache DB e ritorna.
      4c. box Vision assente/implausibile/errore → salva "non trovato" in cache e ritorna null (intera).
```

`detectBBox` mantiene la firma pubblica attuale (`(Buffer, {soglia?}) => Promise<BBox|null>`) perché
è già chiamata altrove e nei test; internamente viene rifattorizzata per riusare l'unica decodifica raw
condivisa con il calcolo di `scartoAngoli` (helper `analizzaBBox`).

## 5. Integrazione Gemini Vision

### 5.1 Chiamata

Modello `gemini-2.5-pro` (come `gemini.ts`), `temperature: 0`, `seed: 1`, `responseMimeType:
'application/json'` con `responseSchema` a coordinate **normalizzate** in [0,1] (indipendenti dalle
dimensioni in pixel, robuste al resize). Input: immagine inline (base64 + mime dedotto dai magic byte,
riuso di `extFromBytes`/logica di `cache.ts`) + prompt testuale.

Schema di risposta (via `Type` di `@google/genai`, come `buildResponseSchema`):

```ts
{
  type: Type.OBJECT,
  required: ['trovato', 'x', 'y', 'width', 'height'],
  properties: {
    trovato: { type: Type.BOOLEAN },                 // false se nessun singolo prodotto dominante
    x:      { type: Type.NUMBER },                    // frazione [0,1] del bordo sinistro
    y:      { type: Type.NUMBER },                    // frazione [0,1] del bordo superiore
    width:  { type: Type.NUMBER },                    // frazione [0,1] della larghezza
    height: { type: Type.NUMBER },                    // frazione [0,1] dell'altezza
  },
}
```

Prompt (italiano, sintetico e vincolato, stesso stile di `buildPrompt`):

> Sei un servizio di ritaglio prodotto. Nella foto individua il **singolo prodotto principale in
> vendita** e restituisci il suo bounding box più stretto possibile, come frazioni [0,1] della
> larghezza e altezza dell'immagine (origine in alto a sinistra). Ignora sfondo, ambientazione,
> persone, oggetti di scena, ombre e riflessi. Se non c'è un unico prodotto dominante (collage,
> più prodotti, solo ambiente), imposta `trovato=false`. Non aggiungere testo fuori dal JSON.

### 5.2 Parse e validazione della risposta

`parseVisionBBox(jsonText, imgW, imgH) → BBox | null`:

- JSON vuoto / non parsabile / `trovato=false` → `null`.
- Converte le frazioni in pixel: `left = round(x*imgW)`, ecc.
- **Clamp** ai bordi immagine (Vision può eccedere di poco): `left ≥ 0`, `left+width ≤ imgW`, idem
  verticale — evita errori di `sharp().extract()` fuori dai limiti.
- Applica `bboxPlausibile` (stessa guardia del §3): box degenere o quasi-intero → `null`.
- Risultato: un `BBox` plausibile in coordinate pixel dell'immagine originale (stesso spazio del bbox
  da scansione), pronto per `sharp().extract()` senza alcuna modifica alla logica di crop di
  `compose-lib.ts`.

### 5.3 Dependency injection e test offline

`resolveBBox` accetta `deps` opzionali per essere **completamente testabile offline** (vincolo di
progetto: tutti i test attuali sono deterministici e senza rete):

```ts
interface ResolveBBoxDeps {
  askVision?: (imageBytes: Buffer, mime: string) => Promise<string>  // default: Gemini reale
  loadCachedBBox?: (imageHash: string) => Promise<CachedBBox | undefined>
  saveCachedBBox?: (imageHash: string, box: BBox | null) => Promise<void>
  sogliaAngoli?: number
}
```

Default reali: `askVision` = chiamata Gemini (richiede `GEMINI_API_KEY`, altrimenti `throw` come
`defaultGenerate`); `loadCachedBBox`/`saveCachedBBox` = `vision-repository.ts` (Prisma). Nei test si
iniettano fake che ritornano JSON canned e una cache in-memory → nessuna rete, nessun DB reale, nessuna
chiave API.

## 6. Caching del risultato Vision

Per non ripagare la chiamata Vision sulla stessa immagine (l'operatore può ricomporre, cambiare foto e
tornare indietro, o rigenerare la scheda), il risultato è cachato in DB, keyed sull'**hash sha256
dell'immagine** già calcolato da `cache.ts` (stesso identificatore usato per i file immagine).

Nuova tabella Prisma (migration seguendo lo stile di `prisma/migrations/20260703152521_init/`):

```prisma
model VisionBBox {
  imageHash String   @id            // sha256 dell'immagine (stessa chiave di cache.ts / file immagine)
  trovato   Boolean                 // false = Vision non ha trovato un prodotto plausibile
  left      Int?                    // px nell'immagine originale (null se !trovato)
  top       Int?
  width     Int?
  height    Int?
  createdAt DateTime @default(now())
}
```

Si cachano **anche i risultati negativi** (`trovato=false`, coordinate null): evita di richiamare Vision
ripetutamente su un'immagine dove anche Vision fallisce. La cache è invalidata implicitamente dal
cambio di hash immagine (immagine diversa = riga diversa); non c'è versionamento del prompt Vision in
v1 (se in futuro il prompt cambiasse in modo sostanziale, si aggiungerà una colonna `promptVersion`
alla PK, come `PROMPT_VERSION` fa per le estrazioni — annotato nel backlog).

### 6.1 Nessuno stato di revisione umana (decisione)

Diversamente dalle icone (`Icon.status` in-revisione/approvata), **il bbox-Vision non ha stato di
revisione**. Motivazione: un'icona è riusata su tutte le schede future di una chiave (un errore
avvelena molte schede → serve approvazione esplicita, regola d'oro §7); un bbox è invece **per-immagine
e locale**, il suo unico effetto è il ritaglio, che l'operatore **già rivede visivamente** nell'editor
(Fase 3c) e può correggere trascinando le frecce o scegliendo un'altra foto — coerente con la spec
master §8 ("frecce in posizione default da sistemare a mano"). Una coda di approvazione sarebbe
over-engineering per questo caso. `VisionBBox` è quindi **pura cache**, senza colonna `status`.

## 7. Impatto su `compose-lib.ts` / `colonna-sinistra.ts` e determinismo

- **`colonna-sinistra.ts`: nessuna modifica.** Accetta già `bbox: {width,height} | null` e gestisce il
  caso `null` (riquadro pieno, riga 51). Il bbox da Vision ha la stessa forma di quello da scansione →
  a valle nulla cambia.
- **`compose-lib.ts`: unica modifica** = sostituire la chiamata `detectBBox(bytes)` (riga 20) con
  `resolveBBox(bytes, cached.hash, input.deps)`. La logica di crop (`sharp().extract()`, righe 27-34) e
  la costruzione della scena restano identiche. Le `deps` esistenti (`download`, `dir`) si estendono con
  gli hook Vision opzionali (§5.3).
- **Golden determinismo — intatto per costruzione:**
  - `tests/render-svg.test.ts` e `tests/layout-colonna-sinistra.test.ts` usano una scena/bbox
    hardcoded e non toccano `bbox.ts`/`compose-lib.ts` → **golden barbecue byte-identico, nessuna
    rigenerazione fixture**.
  - `tests/compose-e2e.test.ts` usa un'immagine sintetica a **sfondo bianco uniforme** (angoli tutti
    255,255,255 → `scartoAngoli = 0`): passa sempre dal ramo "sfondo uniforme" (§4 passo 3), esegue la
    scansione a pixel come oggi, **non** chiama Vision e **non** tocca il DB. Resta verde e offline
    senza modifiche. Il test va comunque rieseguito per confermarlo.
  - `tests/images-bbox.test.ts`: la primitiva `detectBBox` è invariata nel comportamento → i 2 test
    esistenti restano verdi.

## 8. Gestione errori (aggiornamento §8 della spec master)

| Problema | Comportamento |
|---|---|
| Sfondo uniforme, bbox plausibile | Scansione a pixel come oggi (nessuna Vision, nessun costo) |
| Sfondo uniforme, bbox implausibile/degenere/nullo | Immagine intera (nessun ritaglio); **nessuna** chiamata Vision |
| Sfondo **non uniforme** (angoli discordi) | Fallback Gemini Vision → bbox plausibile ⇒ ritaglio |
| Vision: risposta vuota / `trovato=false` / bbox implausibile | Immagine intera; esito cachato come "non trovato" per non richiamare Vision |
| Vision: errore rete/quota / `GEMINI_API_KEY` assente | Immagine intera (degrada, non blocca); l'errore non è cachato → riprovabile a run successivo |
| Immagine già valutata da Vision | Risultato dalla cache DB (per hash immagine), nessuna nuova chiamata |
| Bbox (scan o Vision) fuori dai bordi immagine | Clamp ai limiti prima di `extract` → nessun crash di `sharp` |

Principio invariato dalla spec master: **l'app degrada, non si blocca**; Gemini Vision è un
acceleratore, non un requisito. In assenza di rete/chiave il comportamento è identico a oggi
(immagine intera su sfondo non uniforme).

## 9. Criteri di successo

- Su sfondo uniforme: bbox e ritaglio **identici** a oggi; nessuna chiamata Vision (verificabile perché
  `askVision` non viene invocato — asseribile nei test con una fake che conta le chiamate).
- Su sfondo non uniforme con una foto lifestyle reale: il bbox usato proviene da Vision (plausibile) o,
  in mancanza, è l'immagine intera — **mai** il bbox sbagliato della scansione (caso 2). Verifica
  end-to-end su ≥3 foto secondarie reali che oggi falliscono (§evidenza 2.1).
- Cache: seconda `resolveBBox` sullo stesso hash immagine non richiama Vision (asseribile con la fake).
- Determinismo: `render-svg` e `layout-colonna-sinistra` golden byte-identici; `compose-e2e` verde e
  offline; suite completa verde; `tsc` pulito.
- Tutti i nuovi test sono offline (nessuna rete, nessuna chiave, DB isolato o cache iniettata).

## 10. Note per fasi successive (backlog)

- Editor: pulsante "ricalcola bbox con Vision" per forzare la chiamata su una foto specifica anche
  quando lo sfondo sembra uniforme (oggi Vision parte solo sul ramo non-uniforme).
- Versionamento del prompt Vision (`promptVersion` nella PK di `VisionBBox`) se il prompt evolve.
- Trascinamento/override manuale del bbox salvato dall'editor (persistenza della correzione operatore).
- Valutare `gemini-2.5-flash` per Vision se il costo/latenza diventa un problema su volumi maggiori
  (compromesso qualità da misurare).
- Batch resta **fuori scope** (deciso con l'utente): il fallback è per singolo prodotto nel flusso
  compose/editor esistente.
