'use client'

import { useRef } from 'react'
import type { Scene } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'
import { ScenePreview } from '@/lib/ui/ScenePreview'
import { QuotaOverlay } from '@/lib/ui/QuotaOverlay'

export function EditorPreview({
  scene,
  iconMap,
  imageDataUri,
  dispatch,
}: {
  scene: Scene
  iconMap: Record<string, string>
  imageDataUri: string | null
  dispatch: (a: SceneAction) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="relative w-full max-w-[1000px] aspect-square">
      <ScenePreview scene={scene} iconMap={iconMap} imageDataUri={imageDataUri} />
      <QuotaOverlay scene={scene} containerRef={ref} dispatch={dispatch} />
    </div>
  )
}
