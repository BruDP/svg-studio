'use client'

import { useState, useTransition } from 'react'
import { cercaSkuAction } from '../actions'

export function SkuSearch({ onScegli }: { onScegli: (sku: string) => void }) {
  const [q, setQ] = useState('')
  const [risultati, setRisultati] = useState<{ sku: string; descrizioneBreve: string }[]>([])
  const [inCorso, start] = useTransition()

  function cerca() {
    start(async () => setRisultati(await cercaSkuAction(q)))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          aria-label="Cerca per nome"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Cerca per nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && cerca()}
        />
        <button className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 disabled:opacity-50" onClick={cerca} disabled={inCorso || q.trim().length < 2}>
          Cerca
        </button>
      </div>
      {risultati.length > 0 && (
        <ul className="rounded border border-zinc-200">
          {risultati.map((r) => (
            <li key={r.sku}>
              <button aria-label={`Scegli ${r.sku}`} className="block w-full px-3 py-1 text-left text-sm hover:bg-zinc-100" onClick={() => onScegli(r.sku)}>
                <span className="text-zinc-500">{r.sku}</span> — {r.descrizioneBreve}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
