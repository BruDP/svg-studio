import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SVG Studio',
  description: 'Generatore di schede tecniche prodotto da feed Magento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      {/* suppressHydrationWarning: alcune estensioni del browser (es. tool di cattura schermo che
          aggiungono class="kapture-loaded") modificano il <body> prima che React idrati, causando
          un mismatch di hydration innocuo. Sopprime SOLO l'avviso su questo elemento, non altrove. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
