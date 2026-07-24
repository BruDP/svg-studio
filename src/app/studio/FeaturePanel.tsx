'use client'

import { useState } from 'react'
import type { Scene, IconLabelElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'
import { Accordion } from './Accordion'

export function FeaturePanel({
  scene,
  categoriaFeatures,
  dispatch,
  onCambiaIcona,
  sku,
  onMiglioraFeature,
}: {
  scene: Scene
  categoriaFeatures: { chiave: string; etichetta: string }[]
  dispatch: (a: SceneAction) => void
  onCambiaIcona: (chiave: string) => void
  sku: string
  onMiglioraFeature?: (sku: string) => Promise<void>
}) {
  const [daAggiungere, setDaAggiungere] = useState('')
  const icone = scene.elements.filter((e): e is IconLabelElement => e.type === 'icona-label')
  const presenti = new Set(icone.map((e) => e.chiave))
  const aggiungibili = categoriaFeatures.filter((f) => !presenti.has(f.chiave))

  const [migliorando, setMigliorando] = useState(false)

  const header = (
    <>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-sm)] text-sm"
        style={{ background: 'linear-gradient(135deg, #A78BFA, #EC4899)' }}
        aria-hidden
      >
        📋
      </span>
      <h3 className="truncate font-medium" style={{ color: 'var(--fg)' }}>Caratteristiche</h3>
    </>
  )

  return (
    <Accordion header={header}>
      <div className="space-y-2">
        {onMiglioraFeature && (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMigliorando(true)
                onMiglioraFeature(sku).finally(() => setMigliorando(false))
              }}
              disabled={migliorando || !sku}
              className="rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent-cta)', boxShadow: migliorando ? 'none' : undefined }}
              onMouseEnter={(e) => { if (!migliorando) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-accent)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              title="Ri-estrai le feature con prompt migliorato"
            >
              {migliorando ? '⏳ Miglioro…' : '✦ Migliora con AI'}
            </button>
          </div>
        )}
        <ul className="space-y-1.5">
          {icone.map((el, i) => (
            <li
              key={el.id}
              className="flex items-center gap-1 rounded-[var(--r-md)] px-3 py-2.5"
              style={{ background: 'var(--surface-2)' }}
            >
              <input
                aria-label={`Etichetta ${el.chiave}`}
                className="min-w-0 flex-1 rounded-[var(--r-sm)] px-2 py-1 text-sm"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${el.verificata ? 'var(--border)' : 'var(--warning)'}`,
                  color: 'var(--fg)',
                }}
                value={el.etichetta}
                onChange={(e) => dispatch({ type: 'modifica-etichetta', id: el.id, etichetta: e.target.value })}
              />
              <button aria-label={`Su ${el.chiave}`} disabled={i === 0} className="px-1 disabled:opacity-30"
                style={{ color: 'var(--fg-muted)' }}
                onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'su' })}>↑</button>
              <button aria-label={`Giù ${el.chiave}`} disabled={i === icone.length - 1} className="px-1 disabled:opacity-30"
                style={{ color: 'var(--fg-muted)' }}
                onClick={() => dispatch({ type: 'sposta-feature', id: el.id, direzione: 'giu' })}>↓</button>
              <button aria-label={`Cambia icona ${el.chiave}`} className="px-1" onClick={() => onCambiaIcona(el.chiave)}>🎨</button>
              <button aria-label={`Rimuovi ${el.chiave}`} className="px-1" style={{ color: 'var(--danger)' }}
                onClick={() => dispatch({ type: 'rimuovi', id: el.id })}>✕</button>
            </li>
          ))}
        </ul>
        {aggiungibili.length > 0 && (
          <div className="flex gap-1.5">
            <select
              aria-label="Aggiungi caratteristica"
              className="min-w-0 flex-1 rounded-[var(--r-sm)] px-2 py-1.5 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}
            >
              <option value="">+ aggiungi…</option>
              {aggiungibili.map((f) => <option key={f.chiave} value={f.chiave}>{f.etichetta || f.chiave}</option>)}
            </select>
            <button
              className="shrink-0 rounded-[var(--r-sm)] px-3 py-1.5 text-sm disabled:opacity-50"
              style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              disabled={!daAggiungere}
              onClick={() => {
                const f = aggiungibili.find((x) => x.chiave === daAggiungere)
                if (f) dispatch({ type: 'aggiungi-feature', chiave: f.chiave, etichetta: f.etichetta || f.chiave })
                setDaAggiungere('')
              }}>Aggiungi</button>
          </div>
        )}
      </div>
    </Accordion>
  )
}
