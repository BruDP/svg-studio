import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, existsSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { renderSvgToPng, exportScene } from '@/lib/export/raster'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#FFFFFF"/><text x="60" y="100" font-family="Poppins" font-size="40" fill="#4A4A4A">Ciao</text></svg>\n'

afterAll(() => {
  rmSync('tests/tmp-out', { recursive: true, force: true })
})

describe('renderSvgToPng', () => {
  it('produce un PNG 1000×1000', async () => {
    const png = renderSvgToPng(svg)
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1000)
    expect(meta.height).toBe(1000)
  })

  it('è stabile: due rasterizzazioni identiche sono byte-identiche', () => {
    expect(renderSvgToPng(svg).equals(renderSvgToPng(svg))).toBe(true)
  })
})

describe('exportScene', () => {
  it('scrive {sku}.png (PNG 2000px) e {sku}.svg (sorgente vettoriale)', async () => {
    const p = await exportScene({ svg, sku: 'TEST123', dir: 'tests/tmp-out' })
    // formato primario = PNG ad alta risoluzione
    expect(p).toContain('TEST123.png')
    expect(existsSync(p)).toBe(true)
    const meta = await sharp(p).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(2000)
    expect(meta.height).toBe(2000)
    // esporta anche il sorgente SVG, identico all'input
    const svgPath = p.replace(/\.png$/, '.svg')
    expect(existsSync(svgPath)).toBe(true)
    expect(readFileSync(svgPath, 'utf8')).toBe(svg)
  })
})
