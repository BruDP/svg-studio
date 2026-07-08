'use client'

export function PhotoPicker({ immagini, onScegli }: { immagini: string[]; onScegli: (url: string) => void }) {
  if (immagini.length <= 1) return null
  return (
    <div>
      <h3 className="font-medium text-zinc-700">Foto</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {immagini.map((url, i) => (
          <button
            key={url}
            aria-label={`Foto ${i + 1}`}
            onClick={() => onScegli(url)}
            className="h-16 w-16 overflow-hidden rounded border border-zinc-300 hover:border-emerald-600"
          >
            {/* miniatura remota: solo anteprima di scelta, non entra nella scena */}
            <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
