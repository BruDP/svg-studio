'use client'

import { useRef } from 'react'
import type { Scene } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'
import { ScenePreview } from '@/lib/ui/ScenePreview'
import { QuotaOverlay } from '@/lib/ui/QuotaOverlay'
import { IconMarkOverlay } from '@/lib/ui/IconMarkOverlay'

export function EditorPreview({
  scene,
  iconMap,
  imageMap,
  dispatch,
  inRevisione,
}: {
  scene: Scene
  iconMap: Record<string, string>
  imageMap: Record<string, string>
  dispatch: (a: SceneAction) => void
  inRevisione: string[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-md)' }}
    >
      <div
        ref={ref}
        data-testid="anteprima-editor"
        className="relative w-full max-w-[1000px] aspect-square rounded-[var(--r-md)] overflow-hidden"
        style={{
          border: '1px solid var(--border)',
          // Checkerboard tenue: dà "aria" alla scheda bianca senza un bordo netto
          backgroundImage: `linear-gradient(45deg, var(--surface-2) 25%, transparent 25%),
            linear-gradient(-45deg, var(--surface-2) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--surface-2) 75%),
            linear-gradient(-45deg, transparent 75%, var(--surface-2) 75%)`,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
          backgroundColor: 'var(--surface)',
        }}
      >
        <ScenePreview scene={scene} iconMap={iconMap} imageMap={imageMap} />
        <QuotaOverlay scene={scene} containerRef={ref} dispatch={dispatch} />
        <IconMarkOverlay scene={scene} inRevisione={inRevisione} />
      </div>
    </div>
  )
}

/** Skeleton shimmer mostrato mentre la scheda è in caricamento (nessuna `scene` ancora pronta). */
export function EditorPreviewSkeleton({ sku }: { sku: string }) {
  return (
    <div className="rounded-[var(--r-lg)] p-5" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-md)' }}>
      <div
        className="relative w-full max-w-[1000px] aspect-square animate-pulse rounded-[var(--r-md)]"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Carico scheda {sku}…</p>
        </div>
      </div>
    </div>
  )
}
