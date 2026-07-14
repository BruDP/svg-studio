'use client'

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
  return (
    <div>
      {pezzoAttivo && (
        <p className="text-xs font-medium text-emerald-700">Sto modificando: {pezzoAttivo}</p>
      )}
      {immagini.length > 1 && (
        <>
          <h3 className="font-medium text-zinc-700">Foto</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            {immagini.map((url, i) => (
              <button
                key={url}
                aria-label={`Foto ${i + 1}`}
                onClick={() => onScegli(url)}
                className={`h-16 w-16 overflow-hidden rounded border hover:border-emerald-600 ${
                  url === urlCorrente ? 'border-emerald-600' : 'border-zinc-300'
                }`}
              >
                {/* miniatura remota: solo anteprima di scelta, non entra nella scena */}
                <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onRicalcola}
        disabled={!urlCorrente || inCorso}
        className="mt-2 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-emerald-600 disabled:opacity-50"
      >
        Ricalcola ritaglio con Vision
      </button>
      <p className="mt-1 text-xs text-zinc-500">Rifà il rilevamento del prodotto con l&apos;AI di visione, anche su sfondo uniforme.</p>
    </div>
  )
}
