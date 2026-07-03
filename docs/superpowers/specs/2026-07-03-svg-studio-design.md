# SVG Studio — Design

**Data**: 2026-07-03
**Stato**: approvato in brainstorming, in attesa di revisione finale spec

## 1. Obiettivo

Sostituire la creazione manuale su Canva delle schede tecniche prodotto (infografiche 1000×1000 caricate nella gallery Magento di satur.it) con una web app locale che le genera in automatico a partire dal feed prodotti, con revisione e rifinitura da parte dell'operatore.

**Metrica di successo**: da 20-30 minuti a scheda → 2-3 minuti a scheda, con qualità visiva indistinguibile dalle schede fatte a mano.

## 2. Contesto e vincoli

- **Sorgente dati**: feed `products.csv` di Magento (`https://www.satur.it/amfeed/feed/download?id=27&file=products.csv.csv`), ~7.000 prodotti, separatore `;`. Campi chiave: `SKU`, `Nota Tecnica` (elenco caratteristiche separato da `&#13;<br>`), `Descrizione_Breve`, `Descrizione Estesa`, 8 URL immagine, `Marchio`, `Colore`, `Materiale`, dimensioni imballo.
- **Output**: JPEG/PNG quadrato 1000×1000 (opzionale 2000×2000), nominato `{SKU}.jpg`, salvato in cartella locale; upload su Magento manuale (v1). Upload automatico via API Magento è fase 2 esplicitamente fuori scope.
- **Stile di riferimento**: schede esistenti in `C:\Users\deporzib\Desktop\schede tecniche\` (PNG di esempio) e in produzione su satur.it. Icone line-art in cerchi, testo grigio scuro, foto prodotto con frecce di quotatura, badge speciali (peso max, capacità).
- **Due varianti icona osservate in produzione**: cerchio outline + etichetta a destra; cerchio pieno + etichetta sotto.
- **AI disponibile**: chiave API Gemini.
- **Requisito esplicito**: risultato **deterministico** — stesso SKU e stessi dati feed → stessa scheda proposta, byte per byte.

## 3. Flusso utente

1. L'operatore apre l'app nel browser e inserisce/cerca uno SKU.
2. Il tool recupera i dati dal feed (copia locale aggiornata ogni 24h), mostra le immagini disponibili e propone la più adatta.
3. Il motore di estrazione deterministico propone 5-8 caratteristiche con icone ed etichette già assegnate (vedi §5).
4. L'app compone la scheda in anteprima SVG secondo il template: icone, foto, frecce di quotatura auto-posizionate sul bounding box del prodotto.
5. L'operatore rifinisce: riordina/elimina/aggiunge feature, sostituisce icone, modifica testi, trascina le frecce, cambia foto o template.
6. Export → raster 1000×1000 in `output/{SKU}.jpg` + miniatura di conferma.

## 4. Architettura

Applicazione **Next.js + TypeScript + Tailwind**, in esecuzione locale. DB **SQLite via Prisma**. Chiamate esterne: feed satur.it, API Gemini, API Iconify.

Sei componenti a confini netti:

| Componente | Responsabilità | Interfaccia |
|---|---|---|
| **Feed Layer** | Download products.csv (se >24h), parsing, indicizzazione in SQLite | `getProduct(sku)`, `searchProducts(q)` |
| **Extraction Engine** | Estrazione deterministica feature (vedi §5) | `extract(product) → SchedaProposal` |
| **Icon Library** | Icone canoniche: locale → Iconify → generazione AI; normalizzazione e approvazione | `getIcon(key)`, `searchIcons(q)`, `approveIcon(...)` |
| **Image Service** | Download foto prodotto, bounding box via scansione pixel (fallback Gemini Vision) | `getImages(sku)`, `detectBBox(img)` |
| **Composer** | Editor: documento **scena JSON** renderizzato come SVG da componenti React | mutazioni tipizzate della scena |
| **Export** | Stessa scena → resvg-js → JPEG/PNG | `export(scene, size)` |

**Contratto centrale: la scena JSON.** Editor, anteprima, export e persistenza parlano tutti questo formato (lista di elementi tipizzati: icona+label, foto, freccia-quota, badge, testo). Ogni scheda salvata è riapribile e rieditabile. La fase 2 (upload Magento) consumerà lo stesso output senza toccare il resto.

## 5. Motore di estrazione deterministico

Principio: **Gemini non inventa mai nulla — classifica ed estrae dentro binari fissi.** Tutto ciò che determina l'aspetto della scheda (icone, etichette, ordine) è codice versionato.

### 5.1 Dizionario canonico

Registro curato in `dictionary/*.yaml` (versionato in git) di ~100-150 chiavi feature. Ogni chiave definisce: etichetta template (es. `"Classe {valore}"`), icona fissa, categorie applicabili, priorità, flag `badge` (per elementi tipo "120 KG" / "99 L" posizionati vicino alla foto). Una chiave = una sola icona = un solo formato di etichetta, su tutte le schede.

Il dizionario iniziale si ricava analizzando le schede già fatte e le Note Tecniche del feed.

### 5.2 Gemini vincolato

- `temperature: 0` + structured output con JSON Schema.
- Risposta ammessa: array di `{chiave_canonica (enum chiuso sul dizionario), valore_estratto, testo_sorgente}` + categoria prodotto (enum).
- Compito: solo lettura del testo libero (Nota Tecnica, descrizioni) e mapping sulle chiavi canoniche.

### 5.3 Validazione anti-allucinazione

Ogni valore estratto (numeri, misure, classi) è verificato meccanicamente contro il testo sorgente. Valori non tracciabili → feature flaggata in giallo nell'UI (mai scartata in silenzio, mai pubblicata senza conferma).

### 5.4 Ranking e cache

- Selezione delle 5-8 feature finali: funzione di ranking deterministica (priorità da dizionario per categoria, tie-break stabile). Non decisa da Gemini.
- Estrazioni salvate in DB con hash dei dati feed: stesso input → risultato dalla cache, byte-identico. Re-interrogazione di Gemini solo se i dati cambiano o su richiesta esplicita.

## 6. Template e layout engine

Sistema a template, non layout libero. Template v1:

- **`colonna-sinistra`** — 4-6 icone in colonna a sinistra, foto a destra con quote (il più usato).
- **`griglia-sotto`** — foto in alto con quote, icone in griglia 2-3 colonne sotto.
- **`multi-prodotto`** — per set: 2-3 foto affiancate, quote e badge ciascuna.

**Token di stile centralizzati** in `theme.ts`: colore testo (~#4A4A4A), font (da verificare con l'operatrice attuale — candidati Poppins/Montserrat), dimensioni cerchi, spessore stroke, stile frecce. La variante icona (outline+destra / piena+sotto) è proprietà del template.

**Regole di layout deterministiche:**
1. Feature disposte nell'ordine del ranking (alto→basso, sinistra→destra).
2. Chiavi `badge` posizionate vicino alla foto, non in colonna.
3. Quote: freccia verticale a destra (altezza), orizzontale sotto (larghezza), diagonale (profondità), ancorate al bounding box; estremi trascinabili.
4. Spaziatura calcolata dal numero di feature, con minimi di leggibilità; oltre 7 feature il tool avvisa.
5. Foto scalata a riempire lo spazio con margini fissi.

**Azioni operatore** (mutazioni di scena entro i binari del template): riordina/rimuovi/aggiungi feature, sostituisci icona (picker), modifica etichetta (con avviso se diverge dal template), trascina frecce/correggi valori, cambia foto (dal feed o da file), cambia template.

Nuovi template = nuovo file di codice, non configurazione libera.

## 7. Pipeline icone

**Ricerca a cascata**: 1) libreria locale (percorso normale, ~95% dei casi); 2) API Iconify filtrata su set permissivi e line-art (Tabler, Lucide, Solar Line, Streamline free — licenze da verificare in setup), candidate mostrate già renderizzate nel cerchio del template; 3) generazione Gemini (SVG line-art, solo tratti) come ultima spiaggia.

**Normalizzazione** (ogni icona, da qualsiasi fonte): viewBox 24×24 centrato, `stroke: currentColor`, spessore uniforme, sanificazione SVG (no script/riferimenti esterni/stili inline). Salvata in DB con chiave, sorgente, licenza, stato.

**Regola d'oro**: in scheda solo icone `approvata`. Un'icona nuova appare marcata; l'approvazione la rende l'icona ufficiale della chiave per tutte le schede future. Sostituirla è un'azione esplicita, mai un effetto collaterale.

**Seeding iniziale**: sessione una-tantum in cui il tool propone da Iconify un'icona per ogni chiave del dizionario; approvazione in blocco su griglia di revisione.

## 8. Gestione errori

Principio: l'app degrada, non si blocca. L'AI è un acceleratore, non un requisito.

| Problema | Comportamento |
|---|---|
| Feed irraggiungibile | Ultima copia in DB; banner con data del feed in uso |
| SKU assente | Messaggio chiaro + ricerca per nome |
| Nota Tecnica vuota/povera | Estrazione da Descrizione Estesa; feature incerte flaggate in giallo |
| Gemini in errore/quota | Retry con backoff; composizione manuale dal dizionario sempre possibile |
| BBox non rilevabile (sfondo non uniforme) | Fallback Gemini Vision; poi frecce in posizione default da sistemare a mano |
| Iconify offline | Libreria locale sufficiente per lavorare |
| Export | Rilettura file da disco + miniatura di conferma |

## 9. Testing

Stack: **Vitest + Playwright**.

- **Unit**: parser CSV (entità HTML, `&#13;<br>`, `;` nei testi), validatore anti-allucinazione, ranking, scansione bounding box su immagini campione.
- **Dizionario in CI**: ogni chiave ha etichetta/priorità/icona approvata, nessun duplicato, schema YAML valido. Build rossa se incoerente.
- **Golden test di determinismo**: 10-15 prodotti fixture → estrazione e scena JSON byte-identiche a snapshot committati; render confrontato pixel-per-pixel. Aggiornamento snapshot solo esplicito in review.
- **Benchmark di accettazione**: ricreare 4-5 schede reali (sedia gaming, dondolo, set valigie, frigo Kooper) e confrontarle fianco a fianco con quelle manuali.
- **E2E Playwright**: SKU → proposta → modifica → export, incluso scenario Gemini spento (mock).

## 10. Fuori scope (v1)

- Upload automatico su Magento (fase 2, predisposto dal contratto di scena).
- Generazione batch senza revisione.
- Editing vettoriale libero fuori dai template.
- Localizzazione in lingue diverse dall'italiano.
