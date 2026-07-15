/** Token di stile centralizzati della scheda. Nessun valore di stile va hard-coded altrove. */
// Accento cromatico della scheda (icone, frecce-quota, badge). Testo/etichette restano neutri.
const ACCENTO = '#1F6F78'

export const theme = {
  fontFamily: 'Poppins',
  colors: {
    testo: '#4A4A4A',
    cerchioStroke: ACCENTO,
    freccia: ACCENTO,
    badgeBg: ACCENTO,
    badgeTesto: '#FFFFFF',
    sfondo: '#FFFFFF',
    fotoPlaceholder: '#EEEEEE',
    accento: ACCENTO,
  },
  icona: {
    raggio: 42,
    stroke: 3,
    iconaLato: 44, // lato del glifo 24×24 scalato dentro il cerchio
  },
  freccia: {
    stroke: 2.5,
    testa: 12,
    tick: 11, // semi-lunghezza dei trattini perpendicolari agli estremi della quota
    labelGap: 14, // distanza etichetta misura dalla linea
    // Inclinazione fissa e uniforme (non rilevata dalla foto — servirebbe visione artificiale
    // per stimare la prospettiva reale di ogni immagine, non fattibile in automatico su tutto
    // il feed) per un accenno di prospettiva isometrica, come nelle schede di riferimento fatte
    // a mano: la larghezza non è perfettamente orizzontale e la profondità continua con un
    // angolo più dolce del 45° fisso precedente. Stesso valore su ogni scheda, da tarare
    // visivamente (non un calcolo deterministico da un dato osservabile).
    inclinazioneLarghezzaDeg: 8,
    inclinazioneProfonditaDeg: 32,
    // Distanza (lungo l'angolo di profondità) tra l'estremo destro della larghezza e l'inizio
    // della quota diagonale. Deve superare `tick` (altrimenti i trattini perpendicolari delle
    // due quote si sovrappongono a farfalla) — nelle schede di riferimento fatte a mano le due
    // frecce sono nettamente separate, mai a contatto.
    distanzaDiagonale: 32,
  },
  badge: {
    altezza: 52,
    raggio: 10, // rx dell'angolo arrotondato
    paddingX: 20, // spazio orizzontale per lato tra testo e bordo del box
  },
  testo: {
    titolo: 40,
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
    // lo spazio disponibile nel template colonna-sinistra (FOTO_BOX.x=480) meno un margine
    // di sicurezza — se in futuro un template diverso posiziona la foto altrove, ricalcolare.
    labelMaxLarghezza: 290,
  },
} as const
