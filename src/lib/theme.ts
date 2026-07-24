/**
 * Token di stile centralizzati della scheda. Nessun valore di stile va hard-coded altrove.
 *
 * Palette allineata al Brand Book Satur 2025 (campionata a livello di pixel dagli swatch del PDF,
 * non stimata a occhio): inchiostro = Pantone 7546C, accento di default = Pantone 320C (lo stesso
 * teal già in uso, ora sull'esatto valore di brand), sfondo = crema caldo (non bianco/grigio freddo
 * come nella versione precedente). Vedi `theme-satur.ts` per la palette "famiglia" per reparto
 * (garden/kooper/ecc.) e la relativa attribuzione categoria→colore.
 */
const ACCENTO = '#127981' // Pantone 320 C
const ACCENTO_SCURO = '#0C5860' // ACCENTO scurito, non da Pantone (nessun tono più scuro nel brand book)

export const theme = {
  fontFamily: 'Poppins',
  colors: {
    // Palette MONOCROMATICA "clean/premium" (stile Apple): la scheda è bianca e neutra, il colore
    // arriva SOLO dalla foto prodotto (e dai loghi di marchio). Nessun accento di reparto nella
    // grafica — vedi il redesign clean 2026-07-23. (`accento`/theme-satur restano per retrocompat
    // del campo scene.accento ma non tingono più chip/quote/badge.)
    testo: '#1D1D1F', // inchiostro quasi-nero (headline, etichette)
    testoMuto: '#6E6E73', // grigio secondario (eyebrow, testi di supporto)
    badgeTesto: '#1D1D1F', // testo del badge: inchiostro su pill chiara (non più bianco su colore)
    sfondo: '#FFFFFF', // bianco puro
    sfondoAlt: '#F5F5F7', // grigio chiarissimo (pill badge, eventuale "stage" foto)
    fotoPlaceholder: '#F5F5F7',
    accento: ACCENTO, // (non usato nella grafica clean; conservato per compat)
    accentoScuro: ACCENTO_SCURO,
    divisore: '#E8E8ED', // hairline neutro (se serve)
    icona: '#1D1D1F', // glifo icona feature: inchiostro, tratto sottile (niente disco colorato)
    quota: '#C7C7CC', // rette-misura: grigio chiaro discreto
    quotaTesto: '#86868B', // numeri delle misure: grigio medio, leggibile ma sommesso
  },
  icona: {
    // Design clean: niente disco colorato, solo il GLIFO a tratto sottile (monocromatico).
    // `raggio` resta il riferimento di semi-altezza per il centro verticale dell'icona nella riga.
    raggio: 26,
    stroke: 1.8, // tratto sottile e delicato (lista feature curata)
    iconaLato: 30, // lato del glifo 24×24 (leggermente più piccolo, più raffinato)
  },
  freccia: {
    stroke: 1.5, // rette-quota sottili (callout minimal)
    testa: 12,
    tick: 11, // (non più usato: i trattini agli estremi sono stati rimossi nel design minimal)
    labelGap: 14, // distanza etichetta misura dalla linea
    // Angolo di ripiego per la profondità quando la prospettiva NON è disponibile (foto frontale/2D
    // o Vision non pervenuta): una diagonale modesta in giù a destra, come cue convenzionale. Sulle
    // foto in 3/4 l'angolo reale arriva invece da Vision (per-immagine), non da qui.
    profonditaDefaultDeg: 22,
  },
  foto: {
    raggio: 22, // angoli arrotondati del tile fotografico
    ombraOffset: 14, // offset verticale dell'ombra flat sotto il tile
  },
  badge: {
    altezza: 52,
    raggio: 10, // rx dell'angolo arrotondato (retro-compat; il badge ora usa un path, non un rect)
    paddingX: 20, // spazio orizzontale per lato tra testo e bordo del box
    // Profondità della punta a sinistra del "cartellino prezzo" (vedi renderElement case 'badge').
    notch: 14,
  },
  testo: {
    titolo: 34, // headline prodotto (tracking stretto in svg.ts; regge i nomi lunghi su 2 righe)
    eyebrow: 18, // wordmark marchio (ripiego quando manca il file logo)
    logoAltezza: 38, // altezza del box del logo marchio (ancorato a sinistra, proporzioni preservate)
    etichetta: 25,
    quota: 18, // numeri delle misure: piccoli e sommessi
    badge: 26,
    heroNumero: 46, // "hero stat": numero grande (es. capacità) nella colonna sinistra
    heroEtichetta: 15, // etichetta piccola sopra il numero hero (maiuscoletto)
    // Rapporto larghezza/carattere calibrato empiricamente sul font Poppins reale
    // (via resvg + FONT_FILES, media su etichette rappresentative del dizionario: ~0.51 em/carattere).
    larghezzaCarattereEm: 0.52,
    interlinea: 1.15, // moltiplicatore di riga per le etichette (corpo) spezzate su piu' righe
    // Leading del TITOLO più stretto (disciplina tipografica Apple: il leading è inverso alla
    // dimensione → headline grande = interlinea corta). Vedi skill apple-design §15.
    interlineaTitolo: 1.06,
  },
  margini: {
    canvas: 60,
    colonnaX: 60,
    colonnaGap: 76, // distanza verticale tra icone in colonna (ridotta insieme al raggio icona)
    labelGap: 20, // distanza glifo icona → etichetta (un filo d'aria in più, look clean)
    // Larghezza massima (px) di un'etichetta prima di andare a capo: deve coincidere con
    // lo spazio disponibile nel template colonna-sinistra (FOTO_BOX_X, vedi colonna-sinistra.ts)
    // meno un margine di sicurezza — se in futuro un template diverso posiziona la foto altrove,
    // ricalcolare. NON scendere sotto 258: è il minimo verificato contro le etichette reali più
    // lunghe del dizionario a restare pulite su 2 righe senza ellissi — es. "Struttura in acciaio
    // al carbonio" (barbecue, SKU 2137070) sta in "Struttura in" / "acciaio al carbonio" a 258px,
    // ma va in ellissi ("acciaio al…") già a 246px. Verificato riducendo e trovando la regressione
    // sul rendering reale, non solo sui casi brevi di test.
    labelMaxLarghezza: 258,
    // Larghezza massima del titolo (nome prodotto) prima di andare a capo: colonna sinistra, dal
    // margine (60) fin quasi all'hairline del pannello, con un po' d'aria. NON scendere sotto 340:
    // è il minimo verificato contro titoli reali a restare puliti su 2 righe — es. "Frigorifero 4
    // porte con freezer 515L" (SKU 5926226) va in ellissi ("...con…") già a 326px, pulito
    // ("Frigorifero 4 porte" / "con freezer 515L") solo da 340px in su.
    titoloMaxLarghezza: 344,
  },
} as const
