import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

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
      <body suppressHydrationWarning>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 pb-20 md:px-6 md:pb-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  )
}
