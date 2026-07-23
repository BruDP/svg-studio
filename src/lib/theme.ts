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
    // — vedi `mescola()` in render/colore.ts per i toni derivati (chip bg/ring, fogliame garden).
    accento: ACCENTO,
    accentoScuro: ACCENTO_SCURO,
    divisore: '#E2DDCC', // hairline pannello, neutro caldo (era grigio freddo)
    // Colore delle rette-quota e delle relative etichette: grigio neutro "da disegno tecnico",
    // NON l'accento di reparto (su Kooper l'accento è bordeaux e le rette risultavano rosse,
    // sgradite). Discreto e uguale per ogni categoria.
    quota: '#8A9091',
  },
  icona: {
    // Ridotto da 42: le icone pesavano visivamente più della foto prodotto nonostante la foto
    // fosse più grande in assoluto — chip più piccoli lasciano alla foto il ruolo di protagonista
    // e liberano spazio orizzontale (colonna più stretta → FOTO_BOX più largo).
    raggio: 30,
    stroke: 3,
    iconaLato: 30, // lato del glifo 24×24 scalato dentro il chip (stessa proporzione di prima)
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
    titolo: 34,
    eyebrow: 18, // wordmark marchio (ripiego quando manca il file logo)
    logoAltezza: 40, // altezza del box del logo marchio (ancorato a sinistra, proporzioni preservate)
    etichetta: 26,
    quota: 20, // numeri delle misure: più piccoli dell'etichetta (misure = info di supporto)
    badge: 30,
    // Rapporto larghezza/carattere calibrato empiricamente sul font Poppins reale
    // (via resvg + FONT_FILES, media su etichette rappresentative del dizionario: ~0.51 em/carattere).
    larghezzaCarattereEm: 0.52,
    interlinea: 1.15, // moltiplicatore di riga per le etichette spezzate su piu' righe
  },
  margini: {
    canvas: 60,
    colonnaX: 60,
    colonnaGap: 76, // distanza verticale tra icone in colonna (ridotta insieme al raggio icona)
    labelGap: 16, // distanza cerchio → etichetta
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
