'use client'

import type { Scene, IconLabelElement } from '@/lib/scene/types'
import { theme } from '@/lib/theme'

const CANVAS = 1000

export function IconMarkOverlay({ scene, inRevisione }: { scene: Scene; inRevisione: string[] }) {
  const marcate = scene.elements.filter(
    (e): e is IconLabelElement => e.type === 'icona-label' && inRevisione.includes(e.chiave),
  )
  return (
    <>
      {marcate.map((el) => (
        <span
          key={el.id}
          data-testid={`icona-marcata-${el.chiave}`}
          title="Icona da approvare"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow"
          style={{ left: `${((el.x + theme.icona.raggio * 2) / CANVAS) * 100}%`, top: `${(el.y / CANVAS) * 100}%` }}
        >
          !
        </span>
      ))}
    </>
  )
}
