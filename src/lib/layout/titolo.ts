/**
 * Estrae il titolo prodotto (per l'intestazione della scheda) dalla `descrizioneBreve` del feed.
 *
 * La descrizioneBreve ha forma tipica `<nome> <misure>, <colore>, <marchio>` — a volte con le
 * misure incollate al nome senza virgola (es. "Barbecue rosso tondo Ø42xh.77 cm, BestBQ").
 * Il vecchio `split(',')[0]` sbagliava in due modi:
 *  - troncava a metà numero sulla VIRGOLA DECIMALE italiana (5,6% dei prodotti del feed reale:
 *    "…Ø51xh.84,5 cm" → "…Ø51xh.84");
 *  - lasciava le misure nel titolo quando erano incollate senza virgola ("…Ø42xh.77 cm").
 *
 * Strategia: taglia al PRIMO tra
 *  - un token di MISURA FISICA (diametro Ø, forma NxM, "h.", oppure un numero seguito da cm/mm),
 *  - una virgola STRUTTURALE (non decimale: non racchiusa tra due cifre).
 * Preserva capacità e specifiche che fanno parte del nome (515L, 1,5 V, 12W): non sono "misure
 * fisiche" e vengono tenute finché non arriva una virgola strutturale.
 * In coda toglie un eventuale marchio residuo e la punteggiatura di separazione.
 */

// Misura FISICA (dimensione d'ingombro): diametro, forma NxM, altezza "h.", o numero + cm/mm.
// NON include L/litri/W/V/BTU/kg: quelle sono capacità/specifiche, restano nel nome.
const MISURA_FISICA = /(Ø|\d+(?:[.,]\d+)?\s*[xX]\s*\d|\bh\.\s*\d|\d+(?:[.,]\d+)?\s*(?:cm|mm)\b)/

function indiceVirgolaStrutturale(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ',') continue
    const prima = s[i - 1]
    const dopo = s[i + 1]
    // Virgola decimale = cifra prima E cifra subito dopo (es. "84,5"): non è un separatore.
    const decimale = prima >= '0' && prima <= '9' && dopo >= '0' && dopo <= '9'
    if (!decimale) return i
  }
  return -1
}

export function estraiTitolo(descrizioneBreve: string, marchio?: string): string {
  const breve = (descrizioneBreve ?? '').trim()
  if (!breve) return ''

  const mMisura = breve.match(MISURA_FISICA)
  const idxMisura = mMisura ? mMisura.index! : -1
  const idxVirgola = indiceVirgolaStrutturale(breve)

  const candidati = [idxMisura, idxVirgola].filter((i) => i >= 0)
  const taglio = candidati.length ? Math.min(...candidati) : -1

  let titolo = (taglio >= 0 ? breve.slice(0, taglio) : breve).trim()

  // Toglie un marchio eventualmente rimasto in coda (caso misure incollate senza virgola prima
  // del marchio), solo su confine di parola per non intaccare nomi che lo contengono.
  if (marchio) {
    const m = marchio.trim().toLowerCase()
    if (m && titolo.toLowerCase().endsWith(m)) {
      const pre = titolo.slice(0, titolo.length - m.length)
      if (pre === '' || /[\s,]$/.test(pre)) titolo = pre
    }
  }

  // Ripulisce separatori/punteggiatura di coda ("… ," "…-" spazi).
  titolo = titolo.replace(/[\s,;·|/-]+$/, '').trim()

  // Difesa: se dopo i tagli non resta nulla (nome tutto-misure), ripiega sul vecchio criterio.
  return titolo || breve.split(',')[0].trim()
}
