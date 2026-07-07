'use client'

import { useMemo } from 'react'
import { renderScene } from '@/lib/render/svg'
import type { Scene } from '@/lib/scene/types'

export function ScenePreview({
  scene,
  iconMap,
  imageDataUri,
}: {
  scene: Scene
  iconMap: Record<string, string>
  imageDataUri: string | null
}) {
  const svg = useMemo(
    () => renderScene(scene, { icon: (k) => iconMap[k] ?? null, image: () => imageDataUri }),
    [scene, iconMap, imageDataUri],
  )
  return (
    <div
      className="w-full max-w-[1000px] aspect-square border border-zinc-200 bg-white"
      // SVG dal renderer canonico (stesso output dell'export) — testo XML-escapato, icone sanitizzate
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
