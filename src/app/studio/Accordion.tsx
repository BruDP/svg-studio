'use client'

import { useState, type ReactNode } from 'react'

/**
 * Pannello collassabile per la aside dell'editor. Aperto di default: i pannelli contengono
 * campi/azioni usati anche dai test E2E (etichette feature, rimuovi, foto…), che devono restare
 * visibili/interagibili senza un click preventivo sull'utente di test.
 */
export function Accordion({ header, children, defaultOpen = true }: { header: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [aperto, setAperto] = useState(defaultOpen)
  return (
    <div className="rounded-[var(--r-lg)]" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        <span
          className={`accordion-chevron ${aperto ? 'is-open' : ''}`}
          style={{ color: 'var(--fg-muted)' }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className={`accordion-content ${aperto ? 'is-open' : ''}`}>
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  )
}
