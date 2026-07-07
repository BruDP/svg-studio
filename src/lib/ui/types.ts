import type { Scene } from '@/lib/scene/types'

export interface ProposeResult {
  scene: Scene
  svg: string
  prodotto: { sku: string; descrizioneBreve: string }
}
