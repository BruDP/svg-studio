/** Token di stile centralizzati della scheda. Nessun valore di stile va hard-coded altrove. */
// Accento cromatico della scheda (icone, frecce-quota, badge). Testo/etichette restano neutri.
const ACCENTO = '#1F6F78'
const ACCENTO_SCURO = '#124A50'

export const theme = {
  fontFamily: 'Poppins',
  colors: {
    testo: '#242A2A', // inchiostro più profondo (contrasto premium)
    testoMuto: '#7A8585', // etichette secondarie / eyebrow
    cerchioStroke: ACCENTO, // (retro-compat; le icone ora usano chip pieno)
    freccia: ACCENTO,
    badgeBg: ACCENTO,
    badgeTesto: '#FFFFFF',
    sfondo: '#FCFDFD', // off-white, non bianco puro
    sfondoAlt: '#F5F9F9', // fascia/pannello tinta tenue
    fotoPlaceholder: '#EEEEEE',
    accento: ACCENTO,
    accentoScuro: ACCENTO_SCURO,
    iconaBg: '#E7F1F1', // disco-chip dietro il glifo (accento al ~10%)
    iconaRing: '#D4E6E6', // anello sottile del chip
    iconaGlifo: ACCENTO,
    divisore: '#E3EAEA',
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
    raggio: 10, // rx dell'angolo arrotondato
    paddingX: 20, // spazio orizzontale per lato tra testo e bordo del box
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
    // lo spazio disponibile nel template colonna-sinistra (FOTO_BOX.x=480) meno un margine
    // di sicurezza — se in futuro un template diverso posiziona la foto altrove, ricalcolare.
    labelMaxLarghezza: 290,
    // Larghezza massima del titolo (nome prodotto) prima di andare a capo: colonna sinistra, dal
    // margine (60) fin quasi all'hairline del pannello (452), con un po' d'aria.
    titoloMaxLarghezza: 372,
  },
} as const
