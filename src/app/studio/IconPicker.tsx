'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { cercaIconeAction, scegliIconaAction } from '../actions'

const FOCUSABILI = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function IconPicker({
  chiave,
  onScelta,
  onChiudi,
}: {
  chiave: string
  onScelta: (innerSvg: string) => void
  onChiudi: () => void
}) {
  const [q, setQ] = useState('')
  const [cand, setCand] = useState<{ id: string; innerSvg: string }[]>([])
  const [inCorso, start] = useTransition()
  const pannelloRef = useRef<HTMLDivElement>(null)

  function cerca() {
    start(async () => setCand(await cercaIconeAction(q)))
  }
  function scegli(id: string) {
    start(async () => {
      const { innerSvg } = await scegliIconaAction(chiave, id)
      onScelta(innerSvg)
      onChiudi()
    })
  }

  // Focus al primo elemento del dialog all'apertura; Escape per chiudere; Tab intrappolato nel dialog.
  useEffect(() => {
    const pannello = pannelloRef.current
    const primo = pannello?.querySelector<HTMLElement>(FOCUSABILI)
    primo?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onChiudi()
        return
      }
      if (e.key !== 'Tab' || !pannello) return
      const focusabili = Array.from(pannello.querySelectorAll<HTMLElement>(FOCUSABILI))
      if (focusabili.length === 0) return
      const [primoEl, ultimoEl] = [focusabili[0], focusabili[focusabili.length - 1]]
      if (e.shiftKey && document.activeElement === primoEl) {
        e.preventDefault()
        ultimoEl.focus()
      } else if (!e.shiftKey && document.activeElement === ultimoEl) {
        e.preventDefault()
        primoEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChiudi stabile per la durata del dialog
  }, [])

  return (
    <div role="dialog" aria-label={`Scegli icona per ${chiave}`} className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div ref={pannelloRef} className="w-full max-w-md rounded bg-white p-4 shadow-lg">
        <div className="mb-2 flex gap-2">
          <input aria-label="Cerca icona" className="flex-1 rounded border border-zinc-300 px-2 py-1"
            placeholder="Cerca icona…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cerca()} />
          <button className="rounded bg-zinc-800 px-3 py-1 text-white disabled:opacity-50" onClick={cerca} disabled={inCorso || q.trim().length < 2}>Cerca</button>
          <button aria-label="Chiudi" className="rounded border border-zinc-300 px-3 py-1" onClick={onChiudi}>✕</button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {cand.map((c) => (
            <button key={c.id} aria-label={`Usa ${c.id}`} onClick={() => scegli(c.id)}
              className="flex aspect-square items-center justify-center rounded border border-zinc-200 p-1 hover:border-emerald-600"
              // SVG candidato: normalizzato/sanitizzato lato server (normalizeIconSvg) prima di arrivare qui
              dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" width="100%" height="100%">${c.innerSvg}</svg>` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
