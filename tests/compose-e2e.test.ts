import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { composeSceneForProduct } from '../scripts/compose-lib'
import { parseScene } from '@/lib/scene/schema'
import type { SchedaProposal } from '@/lib/extraction/engine'
import type { ProductRecord } from '@/lib/feed/types'

const product: ProductRecord = {
  sku: '2137070',
  images: ['https://x/foto.png'],
  descrizioneBreve: 'Barbecue',
  descrizioneEstesa: '',
  notaTecnica: [],
  notaEmozionale: '',
  prezzo: '',
  marchio: '',
  urlSlug: '',
  colore: '',
  materiale: '',
  imballo: { lunghezza: null, larghezza: null, altezza: null },
}

const proposal: SchedaProposal = {
  sku: '2137070',
  categoria: 'barbecue',
  features: [{ chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false }],
  badges: [],
  dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 },
}

async function sampleImage(): Promise<Buffer> {
  const w = 80
  const h = 80
  const px = Buffer.alloc(w * h * 3, 255)
  for (let y = 20; y < 60; y++) for (let x = 20; x < 60; x++) {
    const i = (y * w + x) * 3
    px[i] = px[i + 1] = px[i + 2] = 0
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

describe('composeSceneForProduct', () => {
  it('mette in cache la foto, rileva il bbox e compone una scena valida', async () => {
    const img = await sampleImage()
    const { scene, imageHash } = await composeSceneForProduct({
      proposal,
      product,
      deps: { download: async () => img, dir: 'tests/tmp-compose' },
    })
    expect(() => parseScene(scene)).not.toThrow()
    expect(imageHash).toHaveLength(64)
    expect(scene.elements.some((e) => e.type === 'foto')).toBe(true)
    expect(scene.elements.some((e) => e.type === 'quota')).toBe(true)
  })
})
