import { normalizzaBrand } from './marchio'

/**
 * Rilevamento della LINEA di prodotto dal testo. Il feed non ha un campo "linea": la linea è
 * l'ULTIMO segmento della `descrizioneBreve` (verificato sul feed reale — es. "…, BestBQ",
 * "…, Esté", "…, Kooper X"). Qui matchiamo quel segmento contro un elenco canonico di linee note,
 * così possiamo mostrare il LOGO di linea (più specifico del marchio) e selezionare i target.
 *
 * Solo le linee note vengono riconosciute (un ultimo segmento tipo "5 cm" o un colore → null,
 * si ripiega sul marchio).
 */
interface Linea {
  display: string // nome canonico (diventa anche lo slug del logo via marchioInfo)
  keys: string[] // forme normalizzate accettate per l'ultimo segmento
}

const LINEE: Linea[] = [
  { display: 'Kooper X', keys: ['kooper x', 'kooperx'] },
  { display: 'BestBQ', keys: ['bestbq', 'best bq'] },
  { display: 'Esté', keys: ['este', 'garden beach'] },
  { display: 'FitLover', keys: ['fitlover', 'fit lover'] },
  { display: 'Duppidù', keys: ['duppidu'] },
  { display: 'SìChef', keys: ['sichef'] },
  { display: 'Sìordine', keys: ['siordine'] },
  { display: "Santa's House", keys: ["santa's house", 'santas house'] },
  { display: 'Sibilla', keys: ['sibilla'] }, // + varianti "Solid/Manhattan Sibilla" (match a fine parola)
]

/** Linea rilevata (nome canonico) dall'ultimo segmento della descrizioneBreve, o null. */
export function rilevaLinea(descrizioneBreve: string): string | null {
  const parti = (descrizioneBreve ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const ultimo = normalizzaBrand(parti[parti.length - 1] ?? '')
  if (!ultimo) return null
  for (const l of LINEE) {
    if (l.keys.some((k) => ultimo === k || ultimo.endsWith(' ' + k))) return l.display
  }
  return null
}

/**
 * Marca da mostrare nell'intestazione: la LINEA se riconosciuta (più specifica), altrimenti il
 * marchio del feed (Galileo/Kooper/Villa d'Este). È la stringa che finisce nell'eyebrow → il
 * renderer ne risolve logo (assets/loghi/<slug>) o wordmark di ripiego.
 */
export function brandDaMostrare(descrizioneBreve: string, marchio: string): string {
  return rilevaLinea(descrizioneBreve) ?? marchio
}
