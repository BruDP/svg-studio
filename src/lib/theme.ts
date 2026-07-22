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
    testo: '#2F4153', // inchiostro Satur (Pantone 7546 C)
    testoMuto: '#7A8585', // etichette secondarie / eyebrow
    badgeTesto: '#FFFFFF',
    sfondo: '#FBFAF2', // crema caldo Satur (non bianco/grigio freddo)
    sfondoAlt: '#F1EEE3', // pannello: tinta crema più profonda, neutra (non tinta d'accento)
    fotoPlaceholder: '#EDEAE0', // grigio caldo, coerente col crema (era grigio freddo)
    // Accento di DEFAULT/fallback (scene senza categoria riconosciuta o senza `accento` salvato).
    // Le schede con categoria nota usano invece `scene.accento` (vedi theme-satur.ts): chip icona,
    // quote, eyebrow e badge sono tinti dinamicamente sull'accento risolto, non su un colore fisso
    // — vedi `mescola()` in render/colore.ts per i toni derivati (chip bg/ring, confetti).
    accento: ACCENTO,
    accentoScuro: ACCENTO_SCURO,
    divisore: '#E2DDCC', // hairline pannello, neutro caldo (era grigio freddo)
  },
  icona: {
    raggio: 42,
    stroke: 3,
    iconaLato: 42, // lato del glifo 24×24 scalato dentro il chip
  },
  freccia: {
    stroke: 2.5,
    testa: 12,
    tick: 11, // semi-lunghezza dei trattini perpendicolari agli estremi della quota
    labelGap: 14, // distanza etichetta misura dalla linea
    // Angolo di ripiego per la profondità quando la prospettiva NON è disponibile (foto frontale/2D
    // o Vision non pervenuta): una diagonale modesta in giù a destra, come cue convenzionale. Sulle
    // foto in 3/4 l'angolo reale arriva invece da Vision (per-immagine), non da qui.
    profonditaDefaultDeg: 22,
  },
  badge: {
    altezza: 52,
    raggio: 10, // rx dell'angolo arrotondato (retro-compat; il badge ora usa un path, non un rect)
    paddingX: 20, // spazio orizzontale per lato tra testo e bordo del box
    // Profondità della punta a sinistra del "cartellino prezzo" (vedi renderElement case 'badge').
    notch: 14,
  },
  testo: {
    titolo: 34,
    eyebrow: 18, // maiuscoletto marchio sopra il titolo
    etichetta: 26,
    badge: 30,
    // Rapporto larghezza/carattere calibrato empiricamente sul font Poppins reale
    // (via resvg + FONT_FILES, media su etichette rappresentative del dizionario: ~0.51 em/carattere).
    larghezzaCarattereEm: 0.52,
    interlinea: 1.15, // moltiplicatore di riga per le etichette spezzate su piu' righe
  },
  margini: {
    canvas: 60,
    colonnaX: 60,
    colonnaGap: 96, // distanza verticale tra icone in colonna
    labelGap: 20, // distanza cerchio → etichetta
    // Larghezza massima (px) di un'etichetta prima di andare a capo: deve coincidere con
    // lo spazio disponibile nel template colonna-sinistra (FOTO_BOX.x, vedi colonna-sinistra.ts)
    // meno un margine di sicurezza — se in futuro un template diverso posiziona la foto altrove,
    // ricalcolare. Ridotta da 290 per lasciare più spazio orizzontale alla foto prodotto.
    labelMaxLarghezza: 258,
    // Larghezza massima del titolo (nome prodotto) prima di andare a capo: colonna sinistra, dal
    // margine (60) fin quasi all'hairline del pannello, con un po' d'aria.
    titoloMaxLarghezza: 362,
  },
} as const
