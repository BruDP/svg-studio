# Loghi dei marchi

Qui vanno i file logo dei marchi prodotto. Il renderer li inserisce nell'intestazione della scheda
(in alto a sinistra, sotto il logo Satur), al posto del wordmark testuale di ripiego.

## Come aggiungere/aggiornare un logo

Metti un file **PNG con sfondo trasparente** (consigliato) nominato esattamente con lo `slug` del
marchio. Nessun'altra azione: alla prossima generazione la scheda mostra il logo.

| Marchio nel feed (`marchio`) | File da mettere qui | Prodotti |
|---|---|---|
| Galileo | `galileo.png` | ~4221 |
| Villa d'Este Home Tivoli | `villa-d-este.png` | ~2134 |
| Kooper | `kooper.png` | ~712 |

- **Formato**: PNG trasparente (preferito), oppure WEBP/JPG. NON SVG (resvg non rasterizza SVG
  dentro `<image>`; un logo SVG va inlineato a parte — chiedere se serve).
- **Sfondo**: trasparente. Un logo su fondo bianco mostrerebbe un rettangolo bianco sul crema
  della scheda. Se hai solo la versione su bianco, forniscila comunque: la ritagliamo/keyamo noue
  caso per caso (il keying del bianco è sicuro solo per loghi scuri su bianco, non per loghi
  chiari — es. bianco-su-colore — quindi va valutato per marchio).
- **Proporzioni**: qualsiasi. Il logo viene inserito in un box ad altezza fissa, ancorato a
  sinistra, mantenendo le proporzioni originali.

## Nota sulle "linee" (BestBQ, Esté, FitLover, SìChef, duppidù, KooperX, Santa's House, Sibilla…)

Non sono nel campo `marchio` del feed (che vale solo Galileo/Kooper/Villa d'Este): sono linee di
prodotto citate nella descrizione. Per mostrarle servirebbe un rilevamento della linea dal testo
(fattibile su richiesta) + i rispettivi file logo qui.
