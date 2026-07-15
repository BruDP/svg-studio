import { describe, it, expect, afterAll } from 'vitest'
import { rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

afterAll(() => {
  rmSync('tests/tmp-compose', { recursive: true, force: true })
})

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

const setProposal: SchedaProposal = {
  sku: '2137071',
  categoria: 'barbecue',
  features: [{ chiave: 'materiale_acciaio', etichetta: 'Acciaio', valore: null, verificata: true, priorita: 80, badge: false }],
  badges: [],
  dimensioni: null,
  sottoProdotti: [
    { gruppo: 'g0', etichetta: 'Base', dimensioni: { larghezza: 51, profondita: 63, altezza: 84.5 }, badges: [] },
    { gruppo: 'g1', etichetta: 'Coperchio', dimensioni: { larghezza: 51, profondita: 63, altezza: 10 }, badges: [] },
    { gruppo: 'g2', etichetta: 'Carrello', dimensioni: { larghezza: 51, profondita: 63, altezza: 90 }, badges: [] },
  ],
}

const setProduct: ProductRecord = { ...product, sku: '2137071' }

describe('composeSceneForProduct', () => {
  it('con sottoProdotti (>= 2) sceglie il template multi-prodotto e ritaglia una foto per gruppo', async () => {
    const img = await sampleImage()
    const { scene, imageHash } = await composeSceneForProduct({
      proposal: setProposal,
      product: setProduct,
      deps: { download: async () => img, dir: 'tests/tmp-compose' },
    })
    expect(() => parseScene(scene)).not.toThrow()
    expect(scene.templateId).toBe('multi-prodotto')
    expect(imageHash).toHaveLength(64)

    const foto = scene.elements.filter((e) => e.type === 'foto')
    expect(foto).toHaveLength(3)
    const gruppi = foto.map((f) => (f as { gruppo?: string }).gruppo).sort()
    expect(gruppi).toEqual(['g0', 'g1', 'g2'])
    foto.forEach((f) => {
      expect((f as { imageHash: string }).imageHash).toHaveLength(64)
    })
  })

  it('prodotto singolo (nessun sottoProdotti) sceglie il template colonna-sinistra: nessuna regressione', async () => {
    const img = await sampleImage()
    const { scene } = await composeSceneForProduct({
      proposal,
      product,
      deps: { download: async () => img, dir: 'tests/tmp-compose' },
    })
    expect(scene.templateId).toBe('colonna-sinistra')
  })

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

  it('ritaglia la foto sul bbox del prodotto: l\'imageHash è quello dell\'immagine ritagliata, non quello originale', async () => {
    const img = await sampleImage()
    const origHash = createHash('sha256').update(img).digest('hex')
    const croppedBytes = await sharp(img).extract({ left: 20, top: 20, width: 40, height: 40 }).png().toBuffer()
    const croppedHash = createHash('sha256').update(croppedBytes).digest('hex')

    const { scene, imageHash } = await composeSceneForProduct({
      proposal,
      product,
      deps: { download: async () => img, dir: 'tests/tmp-compose' },
    })

    expect(imageHash).not.toBe(origHash)
    expect(imageHash).toBe(croppedHash)
    const foto = scene.elements.find((e) => e.type === 'foto')
    expect(foto).toBeDefined()
    expect((foto as { imageHash: string }).imageHash).toBe(croppedHash)
    expect(scene.elements.some((e) => e.type === 'quota')).toBe(true)
  })
})
