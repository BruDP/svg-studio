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
    <div ref={ref} data-testid="anteprima-editor" className="relative w-full max-w-[1000px] aspect-square">
      <ScenePreview scene={scene} iconMap={iconMap} imageMap={imageMap} />
      <QuotaOverlay scene={scene} containerRef={ref} dispatch={dispatch} />
      <IconMarkOverlay scene={scene} inRevisione={inRevisione} />
    </div>
  )
}
