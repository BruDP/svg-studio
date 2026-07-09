'use client'

import { useState } from 'react'
import type { Scene, IconLabelElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'

export function FeaturePanel({
  scene,
  categoriaFeatures,
  dispatch,
  onCambiaIcona,
}: {
  scene: Scene
  categoriaFeatures: { chiave: string; etichetta: string }[]
  dispatch: (a: SceneAction) => void
  onCambiaIcona: (chiave: string) => void
}) {
  const [daAggiungere, setDaAggiungere] = useState('')
  const icone = scene.elements.filter((e): e is IconLabelElement => e.type === 'icona-label')
  const presenti = new Set(icone.map((e) => e.chiave))
  const aggiungibili = categoriaFeatures.filter((f) => !presenti.has(f.chiave))

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-zinc-700">Caratteristiche</h3>
      <ul className="space-y-1">
        {icone.map((el, i) => (
          <li key={el.id} className="flex items-center gap-1">
            <input
              aria-label={`Etichetta ${el.chiave}`}
              className={`flex-1 rounded border px-2 py-1 text-sm ${el.verificata ? 'border-zinc-300' : 'border-amber-400'}`}
              value={el.etichetta}
              onChange={(e) => dispatch({ type: 'modifica-etichetta', id: el.id, etichetta: e.target.value })}
            />
            <button aria-label={`Su ${el.chiave}`} disabled={i === 0} className="px-1 disabled:opacity-30"
              onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'su' })}>↑</button>
            <button aria-label={`Giù ${el.chiave}`} disabled={i === icone.length - 1} className="px-1 disabled:opacity-30"
              onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'giu' })}>↓</button>
            <button aria-label={`Cambia icona ${el.chiave}`} className="px-1" onClick={() => onCambiaIcona(el.chiave)}>🎨</button>
            <button aria-label={`Rimuovi ${el.chiave}`} className="px-1 text-red-600"
              onClick={() => dispatch({ type: 'rimuovi', id: el.id })}>✕</button>
          </li>
        ))}
      </ul>
      {aggiungibili.length > 0 && (
        <div className="flex gap-1">
          <select aria-label="Aggiungi caratteristica" className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
            value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
            <option value="">+ aggiungi…</option>
            {aggiungibili.map((f) => <option key={f.chiave} value={f.chiave}>{f.etichetta || f.chiave}</option>)}
          </select>
          <button className="rounded bg-zinc-800 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={!daAggiungere}
            onClick={() => {
              const f = aggiungibili.find((x) => x.chiave === daAggiungere)
              if (f) dispatch({ type: 'aggiungi-feature', chiave: f.chiave, etichetta: f.etichetta || f.chiave })
              setDaAggiungere('')
            }}>Aggiungi</button>
        </div>
      )}
    </div>
  )
}
