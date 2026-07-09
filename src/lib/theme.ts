/** Token di stile centralizzati della scheda. Nessun valore di stile va hard-coded altrove. */
export const theme = {
  fontFamily: 'Poppins',
  colors: {
    testo: '#4A4A4A',
    cerchioStroke: '#4A4A4A',
    freccia: '#4A4A4A',
    badgeBg: '#4A4A4A',
    badgeTesto: '#FFFFFF',
    sfondo: '#FFFFFF',
    fotoPlaceholder: '#EEEEEE',
  },
  icona: {
    raggio: 42,
    stroke: 3,
    iconaLato: 44, // lato del glifo 24×24 scalato dentro il cerchio
  },
  freccia: {
    stroke: 2,
    testa: 12,
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
