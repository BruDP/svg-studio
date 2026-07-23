# Design System — Scheda tecnica Satur

Identità visiva delle schede prodotto, allineata al **Brand Book Satur 2025**. Tutti i valori di
stile sono token in [`src/lib/theme.ts`](../src/lib/theme.ts) e
[`src/lib/theme-satur.ts`](../src/lib/theme-satur.ts) — **niente stile hard-coded** nel renderer
([`src/lib/render/svg.ts`](../src/lib/render/svg.ts)).

> Questo documento copre il lavoro di identità visiva (redesign 2026-07-22/23) che NON è nelle
> spec storiche in `docs/superpowers/`. Aggiornato al 2026-07-23.

---

## 1. Palette

Campionata **a livello di pixel** dagli swatch del brand book (non stimata a occhio).

### Colori di base (`theme.colors`)

| Token | Valore | Uso |
|---|---|---|
| `testo` | `#2F4153` | Inchiostro (Pantone 7546 C) — titoli, etichette, wordmark marchio |
| `testoMuto` | `#7A8585` | Payoff, testi secondari |
| `sfondo` | `#FBFAF2` | Fondo crema caldo (mai bianco/grigio freddo) |
| `sfondoAlt` | `#F1EEE3` | Pannello sinistro (crema più profonda, neutra) |
| `divisore` | `#E2DDCC` | Hairline pannello↔foto |
| `quota` | `#8A9091` | Rette-misura + numeri (grigio "disegno tecnico", **non** l'accento) |
| `accento` | `#127981` | Accento **default/fallback** (Pantone 320 C, teal) |
| `fotoPlaceholder` | `#EDEAE0` | Riquadro foto mancante |

### Palette "famiglia" per reparto (`theme-satur.ts`)

Ogni scheda prende il colore del **suo reparto** (non un accento unico): stessa struttura, tinta
diversa per categoria. Il colore è risolto al compose (`accentoPerCategoria`) e salvato in
`scene.accento`; il renderer tinge chip icone, badge, e (indirettamente) i toni derivati.

| Reparto | Colore | Categorie |
|---|---|---|
| kooper | `#A6213F` (bordeaux) | frigo, congelatore, lavatrice, forno, condizionatore, aspirapolvere, piccoli elettrodom. |
| garden | `#6DBE4B` (verde) | arredo_esterno, ombrellone, barbecue |
| accessori | `#A7779C` (mauve) | valigie |
| riassetto | `#4DC1BD` (aqua) | arredo_interno, sedia_ufficio_gaming |
| brico | `#A3A9AD` (grigio-blu) | illuminazione |
| bagno | `#24A4AA` (teal) | bagno_doccia (dormiente) |
| _default_ | `#127981` (teal) | categorie non mappate / `altro` |

I toni tenui (sfondo chip, anello) sono **derivati a runtime** dall'accento con `mescola()`
([`render/colore.ts`](../src/lib/render/colore.ts)), non hard-coded: es. `chipBg = mescola(accento, sfondo, 0.1)`.

---

## 2. Tipografia

- Font unico: **Poppins** (Regular 400 + SemiBold 600), embedded per resvg (`assets/fonts`).
  Il font ufficiale "run" del brand book non è licenziato: Poppins è il sostituto più vicino.
- Scala (`theme.testo`): `titolo` 34 · `eyebrow` 18 · `etichetta` 26 · `quota` 20 · `badge` 30.
- `larghezzaCarattereEm` 0.52 (calibrato empiricamente su Poppins via resvg) per stimare la
  larghezza testo → word-wrap. `interlinea` 1.15.
- **Wrap sicuro**: `labelMaxLarghezza` 258 e `titoloMaxLarghezza` 344 sono i minimi verificati
  contro le etichette/titoli reali più lunghi del dizionario per NON andare in ellissi
  (soglie documentate nei commenti di `theme.ts`). L'ellissi arretra sempre al confine di parola.

---

## 3. Anatomia della scheda (`colonna-sinistra`)

```
┌─────────────────┬──────────────────────────────┐
│ ♥ satur         │                              │  Logo Satur (chrome renderer, sempre)
│   PASSIONE CASA │      ┌────────────────┐      │
│                 │      │                │      │
│ [LOGO MARCHIO]  │      │   FOTO TILE    │ 177  │  Logo marchio (o wordmark di ripiego)
│ Titolo prodotto │      │  (arrotondato  │ ,5   │  Titolo (estraiTitolo, max 2 righe)
│                 │      │   + ombra)     │ cm   │
│  ◉ Feature 1    │      │                │      │  Colonna icone-chip, CENTRATA verticalmente
│  ◉ Feature 2    │      └────────────────┘      │  Quote grigie (altezza/larghezza/profondità)
│  ◉ Feature 3    │        83,3 cm    65,3 cm     │  numeri piccoli, colore `quota`
│                 │  ◀ Capienza 515 L            │  Badge = "cartellino prezzo" (accento reparto)
└─────────────────┴──────────────────────────────┘
```

- **Logo Satur** (`logoSatur` in svg.ts): cuore sfaccettato ricostruito in SVG (pinwheel di ~32
  triangoli in `<clipPath>`, palette **fissa** del marchio, non l'accento) + wordmark "satur" +
  payoff. Firma presente su ogni scheda (era il motivo "confetti", ora rimosso).
- **Logo marchio** (`branding/`): se esiste `assets/loghi/<slug>.png` (trasparente) si disegna il
  logo ufficiale; altrimenti il **wordmark** del marchio (display pulito, navy). Slug: `galileo`,
  `kooper`, `villa-d-este`. Il data URI passa dalla `imageMap` (chiave `logo:<slug>`) → nessun
  plumbing client dedicato.
- **Foto tile**: angoli arrotondati (`theme.foto.raggio`) + ombra flat offset (`ombraOffset`),
  niente blur (resvg inaffidabile; stile flat coerente col brand). La foto è la protagonista:
  colonna icone stretta apposta per lasciarle la parte larga del canvas.
- **Icone-chip**: disco a tinta tenue + anello + glifo (24×24 Tabler) nell'accento. `raggio` 30.
  La colonna è **centrata verticalmente** nel pannello: schede con poche feature restano bilanciate.
- **Quote**: linea + trattini perpendicolari + numero accostato, tutto in grigio `quota` (neutro,
  non l'accento — le rette bordeaux su Kooper erano sgradite). Altezza e larghezza sempre presenti;
  la **profondità** (diagonale) è togglabile. Ogni misura/titolo/eyebrow/badge è mostra-nascondi in editor.
- **Badge**: forma a cartellino con punta a sinistra (`badge.notch`), tinto sull'accento reparto.

**Template `multi-prodotto`** (set): N celle-foto affiancate (ognuna con badge di capacità),
griglia icone condivisa sotto. Niente pannello/quote-lineari. Logo Satur presente, niente
intestazione marchio.

---

## 4. Editing (editor `/studio`)

Ogni elemento della scheda è modificabile (reducer puro `scene/mutations.ts`):

- Feature: riordina / rimuovi / aggiungi / cambia etichetta / cambia icona (picker Iconify).
- Elementi (`ElementiPanel`): mostra-nascondi ogni quota/titolo/eyebrow/badge; testo modificabile
  per titolo/eyebrow/badge (`toggle-elemento`, `modifica-testo`).
- Foto: cambio tra le immagini del prodotto (ricrop + ricalcolo quote) · maniglie trascinabili
  per gli estremi delle quote · "ricalcola con Vision".
- Export: scelta **JPEG** o **SVG** scaricabili (`scaricaSvg` via Blob, JPEG via data URI).

---

## 5. Vincoli tecnici del rendering (resvg-js)

- ✅ Gradienti, `<clipPath>`, `<image>` da raster (PNG/JPEG/WEBP), path/polygon, testo con font embedded.
- ❌ **No blur/filtri** affidabili → ombre flat (rect a bassa opacità offset).
- ❌ **No SVG dentro `<image>`** → i loghi devono essere **PNG trasparenti** (vedi `assets/loghi/README.md`).
- Ombre e profondità in stile **flat design** (coerente col brand book).

---

## 6. Come modificare lo stile

1. Cambia il token in `theme.ts` / `theme-satur.ts` (mai valori nel renderer).
2. `npm test` — se cambia il rendering, i golden falliscono: **rigenerali** dopo aver verificato
   visivamente il render reale (`npm run compose -- 5926226` / `2137070`).
3. Verifica su un prodotto con **poche feature** (barbecue 2137070) e uno **denso** (frigo 5926226),
   più un **set** (5926962), e su almeno due **reparti** (colori diversi).
4. Un taglio di spazio testo? Verificalo contro il contenuto reale più lungo del dizionario.
