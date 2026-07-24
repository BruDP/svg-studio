# Design System — Scheda tecnica Satur

Identità visiva delle schede prodotto: **design clean/Apple**, monocromatico, minimalista.
Tutti i valori di stile sono token in [`src/lib/theme.ts`](../src/lib/theme.ts) —
**niente stile hard-coded** nel renderer ([`src/lib/render/svg.ts`](../src/lib/render/svg.ts)).

> Redesign clean: 2026-07-23. Precedente identità (colorata, reparto, Satur heart) archiviate.
> Aggiornato al 2026-07-24.

---

## 1. Palette (monocromatica)

Colori neutri + inchiostro scuro, **nessun accento reparto**. Il colore arriva solo dalla foto prodotto.

| Token | Valore | Uso |
|---|---|---|
| `testo` | `#1D1D1F` | Inchiostro quasi-nero (headline, etichette) |
| `testoMuto` | `#6E6E73` | Grigio secondario (eyebrow) |
| `sfondo` | `#FFFFFF` | Bianco puro |
| `sfondoAlt` | `#F5F5F7` | Grigio chiarissimo (badge pill) |
| `icona` | `#1D1D1F` | Glifo icona: inchiostro, tratto sottile |
| `quota` | `#C7C7CC` | Rette-misura (grigio discreto) |
| `quotaTesto` | `#86868B` | Numeri delle misure (grigio medio) |
| `divisore` | `#E8E8ED` | Hairline (se serve) |

**Niente**: accento reparto, palette "famiglia", tinte derivate via `mescola()`.

---

## 2. Tipografia

- Font unico: **Poppins** (Regular 400), embedded per resvg (`assets/fonts`).
- Scala (`theme.testo`):
  - `titolo` 34 (headline prodotto, tracking -0.6, leading 1.06)
  - `eyebrow` 18 (logo/linea marchio, ripiego wordmark)
  - `logoAltezza` 46 (box logo marchio/linea, aspect-ratio preservato)
  - `etichetta` 25 (feature)
  - `quota` 18 (numeri misure, piccoli)
  - `badge` 26 (non usato nel design clean)
  - `heroNumero` 46 (capacità hero stat, grande)
  - `heroEtichetta` 15 (etichetta piccola sopra numero)
- `larghezzaCarattereEm` 0.52 (calibrato su Poppins via resvg) per word-wrap.
- `interlinea` 1.15 (corpo). `interlineaTitolo` 1.06 (headline, leading stretto per disciplina Apple).
- **Wrap sicuro**: `labelMaxLarghezza` 258, `titoloMaxLarghezza` 344 sono i minimi verificati
  contro il contenuto reale più lungo del dizionario (evita ellissi e regressioni).

---

## 3. Anatomia della scheda (`colonna-sinistra`)

```
┌─────────────────┬──────────────────────────────┐
│ BestBQ          │                              │  Eyebrow: linea se riconosciuta
│                 │      ┌────────────────┐      │  (logo se assets/loghi/<slug>, else wordmark)
│ Frigorifero 4   │      │                │      │
│ porte con       │      │   FOTO         │      │  Titolo grande (max 2 righe)
│ freezer 515L    │      │  (plain,       │      │  Colonna icone-label, CENTRATA
│                 │      │   no shadow)   │      │  
│  ◯ Feature 1    │      │                │      │  Icone SOLO glifo (no disc)
│  ◯ Feature 2    │      └────────────────┘      │  Quote grigie, 1 linea (no ticks)
│  ◯ Feature 3    │        177,5 cm              │  
│                 │                              │  Hero stat in basso:
│  Capienza       │                              │  "515 L" (numero grande)
│    515 L        │                              │  "Capienza" (label piccolo)
└─────────────────┴──────────────────────────────┘
```

- **Eyebrow** (top-left, y=76): marca/linea in alto. Se esiste `assets/loghi/<slug>.png` si
  disegna il logo ufficiale (trasparente); else wordmark (display pulito). Slug: `galileo`,
  `kooper`, `villa-d-este`, `bestbq`, `este`, `fitlover`, `kooper-x`, ecc. Linea rilevata da
  `linea.ts` (ultimo segmento di `descrizioneBreve`), prioritaria sul marchio.
- **Titolo** (y=158): nome prodotto, max 2 righe, tracking -0.6 per strettezza.
- **Foto** (right side): plain `<image>`, no clip/shadow. Angoli arrotondati via SVG (raggio 22).
  Riempie il riquadro (FOTO_BOX_X=412, width=460) senza margini — grande e dominante.
- **Icone-label** (left column, y=308+): SOLO glifo sottile + etichetta. No disco colorato.
  Glifo 24×24 Tabler, stroke 1.8, centr verticalmente nel riquadro.
  Colonna **centrata** tra iconStartY e zonaBasso: schede con poche feature bilanciate.
- **Quote** (sotto/accanto foto): 1 linea grigia (no ticks, no perpendicolari), numero accanto.
  Altezza sempre; larghezza, profondità toggle-abili.
- **Hero stat** (bottom-left, y~820-862): numero grande (es. "515 L") + etichetta piccolo sopra
  (es. "Capienza"). Split della etichetta dizionario sul valore. Badge come hero stat, mai pill
  colorate.

**Template `multi-prodotto`** (set): N celle-foto affiancate + grill icone sotto. Niente hero stat
per cella (solo lato N celle). Logo marchio assente, niente intestazione.

---

## 4. Elementi toggleabili (editor `/studio`)

Ogni elemento è mostra-nascondi e modificabile:

- **Feature**: riordina / rimuovi / aggiungi / etichetta + icona (picker Iconify).
- **Quote**: toggle per altezza/larghezza/profondità (ogni misura indipendente).
- **Titolo**, **eyebrow**, **badge** (hero stat): toggle visibilità + modifica testo.
- **Foto**: cambio tra immagini prodotto · maniglie trascinabili per estremi quote · ricalcola bbox con Vision.
- **Export**: scarica **JPEG** q90 2000px o **SVG** (download Blob).

---

## 5. Vincoli tecnici (resvg-js)

- ✅ Gradienti, `<clipPath>`, `<image>` da raster, path/polygon, testo con font embedded.
- ❌ **No blur/filtri affidabili** → ombre/profondità via flat design (rect offset, bassa opacità).
- ❌ **No SVG dentro `<image>`** → loghi **PNG trasparenti** (vedi `assets/loghi/README.md`).

---

## 6. Come modificare lo stile

1. Cambia token in `theme.ts` (mai hard-code nel renderer).
2. `npm test` — se rendering cambia, rigenerali golden dopo verifica visuale reale.
3. Test su **poche feature** (barbecue 2137070), **denso** (frigo 5926226), **set** (5926962).
4. Un taglio di spazio testo? Verifica contro il contenuto reale più lungo del dizionario (non solo
   casi brevi nei test).

---

## 7. Loghi di linea e marchio

Eyebrow risolve il logo via `chiaveLogo(brand)` → `imageMap['logo:<slug>']` (data URI).

| Logo | Slug | Tipo | Note |
|---|---|---|---|
| Galileo | `galileo` | Marchio | Wordmark plain (ripiego se no file) |
| Kooper | `kooper` | Marchio | Wordmark, aspect alto |
| Villa d'Este | `villa-d-este` | Marchio | Wordmark |
| BestBQ | `bestbq` | Linea | Pittorico (grunge flame + "By Galileo") |
| Esté | `este` | Linea | Pictorial garden |
| FitLover | `fitlover` | Linea | Icona cuore-manubrio (teal/pink) |
| Kooper X | `kooper-x` | Linea | Wordmark metallico |
| Duppidù, SìChef, Sìordine, Santa's House, Sibilla | … | Linea | Pictorial/wordmark vario |

Loghi **trasparenti PNG**, rasterizzati come data URI in `renderScene` via `bundle.ts`
(→ `caricaLogoMarchio` or custom `readLogo`).

---

Documentazione correlata: **[README.md](../README.md)** (setup) ·
**[overview.md](../overview.md)** (stack, pipeline, struttura).
