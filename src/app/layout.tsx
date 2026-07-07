import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SVG Studio',
  description: 'Generatore di schede tecniche prodotto da feed Magento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
