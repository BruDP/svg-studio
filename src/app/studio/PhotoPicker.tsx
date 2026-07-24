'use client'

import { Accordion } from './Accordion'

export function PhotoPicker({
  immagini,
  urlCorrente,
  onScegli,
  onRicalcola,
  inCorso = false,
  pezzoAttivo = null,
}: {
  immagini: string[]
  urlCorrente: string
  onScegli: (url: string) => void
  onRicalcola: () => void
  inCorso?: boolean
  /** Etichetta del sotto-prodotto (set) su cui agiranno la scelta foto e il ricalcolo. Assente per prodotto singolo. */
  pezzoAttivo?: string | null
}) {
  if (immagini.length < 1) return null

  const header = (
    <>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-sm)] text-sm"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}
        aria-hidden
      >
        🖼️
      </span>
      <h3 className="truncate font-medium" style={{ color: 'var(--fg)' }}>Foto</h3>
    </>
  )

  return (
    <Accordion header={header}>
      <div className="space-y-2">
        {pezzoAttivo && (
          <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>Sto modificando: {pezzoAttivo}</p>
        )}
        {immagini.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {immagini.map((url, i) => {
              const selezionata = url === urlCorrente
              return (
                <button
                  key={url}
                  aria-label={`Foto ${i + 1}`}
                  onClick={() => onScegli(url)}
                  className="h-16 w-16 overflow-hidden rounded-[var(--r-md)] transition-transform duration-150"
                  style={{
                    border: selezionata ? '2px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow: selezionata ? 'var(--focus-ring)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = selezionata ? 'var(--focus-ring)' : 'none'
                  }}
                >
                  {/* miniatura remota: solo anteprima di scelta, non entra nella scena */}
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onRicalcola}
          disabled={!urlCorrente || inCorso}
          className="w-full rounded-[var(--r-md)] px-3 py-2 text-sm disabled:opacity-50"
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)' }}
        >
          ↻ Ricalcola Vision
        </button>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Rifà il rilevamento del prodotto con l&apos;AI di visione, anche su sfondo uniforme.</p>
      </div>
    </Accordion>
  )
}
