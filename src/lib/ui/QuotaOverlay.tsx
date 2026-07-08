'use client'

import { type RefObject, useCallback } from 'react'
import type { Scene, QuotaElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'

// Deve coincidere con scene.canvas.width/height (oggi 1000×1000 dal solo template
// colonna-sinistra). Se in futuro i template usassero canvas di dimensioni diverse,
// ricavarlo da scene.canvas invece di questa costante.
const CANVAS = 1000

export function QuotaOverlay({
  scene,
  containerRef,
  dispatch,
}: {
  scene: Scene
  containerRef: RefObject<HTMLDivElement | null>
  dispatch: (a: SceneAction) => void
}) {
  const quote = scene.elements.filter((e): e is QuotaElement => e.type === 'quota')

  const onDrag = useCallback(
    (id: string, estremo: 'inizio' | 'fine') => (e: React.PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect()
        const x = ((ev.clientX - r.left) / r.width) * CANVAS
        const y = ((ev.clientY - r.top) / r.height) * CANVAS
        dispatch({ type: 'sposta-quota', id, estremo, x, y })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      // pointercancel: gesture interrotta (touch/pen, gesture OS, context menu) → stessa pulizia,
      // altrimenti il listener pointermove resterebbe appeso a inseguire il cursore.
      window.addEventListener('pointercancel', up)
    },
    [containerRef, dispatch],
  )

  return (
    <>
      {quote.flatMap((q) => [
        { estremo: 'inizio' as const, x: q.x1, y: q.y1 },
        { estremo: 'fine' as const, x: q.x2, y: q.y2 },
      ].map((h) => (
        <button
          key={`${q.id}-${h.estremo}`}
          data-testid={`quota-${q.id}-${h.estremo}`}
          aria-label={`Estremo ${h.estremo} quota ${q.valore}`}
          onPointerDown={onDrag(q.id, h.estremo)}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-emerald-600 shadow"
          style={{ left: `${(h.x / CANVAS) * 100}%`, top: `${(h.y / CANVAS) * 100}%`, touchAction: 'none' }}
        />
      )))}
    </>
  )
}
