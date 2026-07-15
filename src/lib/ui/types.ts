import type { Scene } from '@/lib/scene/types'

export interface ProposeResult {
  scene: Scene
  iconMap: Record<string, string>
  imageMap: Record<string, string>
  prodotto: { sku: string; descrizioneBreve: string }
  categoriaFeatures: { chiave: string; etichetta: string }[]
  salvataDisponibile: boolean
  immagini: string[]
  iconeNonApprovate: string[]
}
