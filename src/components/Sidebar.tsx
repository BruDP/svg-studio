'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Shell di navigazione comune a tutte le pagine (Studio, Icone). Desktop: colonna 248px con
 * etichette. Tablet: rail 72px solo icone. Mobile: barra in basso.
 *
 * Nota: la Banco vive come "vista" interna a /studio (vedi StudioClient), non ha una route
 * propria — la voce di navigazione unifica quindi Banco+Studio su un'unica destinazione /studio,
 * al posto delle tre voci separate "Banco/Studio/Icone" della spec (che presuppongono route
 * distinte non ancora esistenti). Se in futuro Banco diventa una route a parte, si riseparano.
 */
const NAV = [
  { href: '/studio', label: 'Studio', icon: IconHome },
  { href: '/icone', label: 'Icone', icon: IconGrid },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    const salvato = window.localStorage.getItem('svg-studio-theme')
    if (salvato === 'light' || salvato === 'dark') {
      // Lettura del tema persistito DOPO il mount (evita mismatch di idratazione: il server non
      // conosce localStorage). Pattern standard per il theme toggle, da qui il disable mirato.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(salvato)
      document.documentElement.dataset.theme = salvato
    }
  }, [])

  function toggleTheme() {
    const prossimo = theme === 'dark' ? 'light' : 'dark'
    setTheme(prossimo)
    document.documentElement.dataset.theme = prossimo
    window.localStorage.setItem('svg-studio-theme', prossimo)
  }

  return (
    <>
      {/* Desktop (>=1024px: 248px con etichette) / Tablet (768-1023px: rail 72px solo icone) */}
      <nav
        aria-label="Navigazione principale"
        className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto md:flex md:w-[72px] lg:w-[248px]"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 px-4 py-5">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
          >
            S
          </div>
          <span className="hidden truncate font-semibold lg:inline" style={{ color: 'var(--fg)' }}>
            SVG Studio
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const attiva = pathname?.startsWith(item.href) ?? false
            const Icon = item.icon
            return (
              <li key={item.href} className="relative">
                {attiva && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                    style={{ background: 'var(--primary)' }}
                    aria-hidden
                  />
                )}
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm"
                  style={
                    attiva
                      ? {
                          background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(236,72,153,.10))',
                          color: 'var(--primary)',
                          fontWeight: 600,
                          transition: 'all var(--transition-fast)',
                        }
                      : { color: 'var(--fg-muted)', transition: 'all var(--transition-fast)' }
                  }
                  onMouseEnter={(e) => {
                    if (!attiva) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    if (!attiva) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <Icon color={attiva ? 'var(--primary)' : 'var(--fg-muted)'} />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-4" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-full text-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--fg)' }}
          >
            {theme === 'dark' ? '☀️' : '☾'}
          </button>
          <div
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold lg:grid"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}
            title="Utente"
          >
            BD
          </div>
        </div>
      </nav>

      {/* Mobile (<768px): barra in basso */}
      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 flex md:hidden"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        {NAV.map((item) => {
          const attiva = pathname?.startsWith(item.href) ?? false
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs"
              style={{ color: attiva ? 'var(--primary)' : 'var(--fg-muted)', fontWeight: attiva ? 600 : 400 }}
            >
              <Icon color={attiva ? 'var(--primary)' : 'var(--fg-muted)'} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

type IconProps = { color: string }

function IconHome({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function IconGrid({ color }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}
