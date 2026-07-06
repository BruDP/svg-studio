import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface CachedImage {
  hash: string
  path: string
  ext: string
}

const DEFAULT_DIR = 'data/images'
const MANIFEST_FILE = 'manifest.json'

// In-memory manifest cache per directory
const manifestCache = new Map<string, Map<string, { hash: string; ext: string }>>()

async function defaultDownload(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download immagine fallito: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Deduce l'estensione dai magic byte; default png. */
function extFromBytes(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'png'
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'RIFF') return 'webp'
  return 'png'
}

function getManifest(dir: string): Map<string, { hash: string; ext: string }> {
  // Always reload from disk to handle test cleanup (beforeEach wipes the dir)
  const manifestPath = path.join(dir, MANIFEST_FILE)
  let manifest = new Map<string, { hash: string; ext: string }>()
  if (existsSync(manifestPath)) {
    try {
      const data = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      manifest = new Map(Object.entries(data))
    } catch {
      // If manifest is corrupted, start fresh
    }
  }
  manifestCache.set(dir, manifest)
  return manifest
}

function saveManifest(dir: string, manifest: Map<string, { hash: string; ext: string }>): void {
  mkdirSync(dir, { recursive: true })
  const data = Object.fromEntries(manifest)
  writeFileSync(path.join(dir, MANIFEST_FILE), JSON.stringify(data, null, 2))
}

export async function cacheImage(
  url: string,
  deps: { download?: (url: string) => Promise<Buffer>; dir?: string } = {},
): Promise<CachedImage> {
  const download = deps.download ?? defaultDownload
  const dir = deps.dir ?? DEFAULT_DIR
  const manifest = getManifest(dir)

  // Check if we've already cached this URL
  if (manifest.has(url)) {
    const { hash, ext } = manifest.get(url)!
    const filePath = path.join(dir, `${hash}.${ext}`)
    return { hash, path: filePath, ext }
  }

  const buf = await download(url)
  const hash = createHash('sha256').update(buf).digest('hex')
  const ext = extFromBytes(buf)
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${hash}.${ext}`)
  if (!existsSync(filePath)) {
    writeFileSync(filePath, buf)
  }

  // Track this URL in manifest
  manifest.set(url, { hash, ext })
  saveManifest(dir, manifest)

  return { hash, path: filePath, ext }
}

export function readCachedImage(hash: string, ext: string, dir = DEFAULT_DIR): Buffer {
  return readFileSync(path.join(dir, `${hash}.${ext}`))
}
