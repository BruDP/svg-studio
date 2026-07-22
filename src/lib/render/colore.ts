/** Utilità colore pura per il renderer: nessuna dipendenza da theme/scene. */

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function hexAComponenti(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) throw new Error(`colore non valido: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function componentiAHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp255(v).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

/**
 * Miscela lineare tra due colori hex. `quota` è il peso di `hexA` (0 = tutto hexB, 1 = tutto hexA).
 * Usata per derivare a runtime i toni tenui (chip icona, anello) da un accento qualsiasi — niente
 * tinte hard-codate per categoria da mantenere in sincrono a mano.
 */
export function mescola(hexA: string, hexB: string, quota: number): string {
  const q = Math.max(0, Math.min(1, quota))
  const [r1, g1, b1] = hexAComponenti(hexA)
  const [r2, g2, b2] = hexAComponenti(hexB)
  return componentiAHex(r1 * q + r2 * (1 - q), g1 * q + g2 * (1 - q), b1 * q + b2 * (1 - q))
}
