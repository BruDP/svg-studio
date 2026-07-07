import path from 'node:path'

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
  },
  margini: {
    canvas: 60,
    colonnaX: 60,
    colonnaGap: 96, // distanza verticale tra icone in colonna
    labelGap: 20, // distanza cerchio → etichetta
  },
} as const

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')

/** Percorsi dei file font per resvg-js (embedding nel raster). */
export const FONT_FILES: string[] = [
  path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
]
