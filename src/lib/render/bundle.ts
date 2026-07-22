import type { Scene } from '@/lib/scene/types'
import { getApprovedIcon, getIcon } from '@/lib/icons/repository'
import { readCachedImage } from '@/lib/images/cache'
import { renderScene } from '@/lib/render/svg'
import { extToMime } from '@/lib/ui/mime'
import { chiaveLogo } from '@/lib/branding/marchio'
import { caricaLogoMarchio } from '@/lib/branding/logo-loader'

export interface RenderBundle {
  iconMap: Record<string, string>
  imageMap: Record<string, string>
}

type BundleDeps = {
  getIcon?: (k: string) => Promise<{ svg: string } | null>
  readImage?: (hash: string) => { bytes: Buffer; ext: string } | null
  // Logo del marchio come data URI (o null). Override per i test; default = file in assets/loghi.
  readLogo?: (marchio: string) => string | null
}

/** Estrae il contenuto interno di un SVG normalizzato (rimuove il wrapper <svg>…</svg>). */
export function innerSvg(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
}

/** Un hash immagine valido è uno sha256 esadecimale minuscolo (64 caratteri), come prodotto da data/images. */
export function isValidImageHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash)
}

export async function resolveRenderBundle(scene: Scene, deps: BundleDeps = {}): Promise<RenderBundle> {
  const getIcon = deps.getIcon ?? ((k: string) => getApprovedIcon(k))
  const readImage =
    deps.readImage ??
    ((hash: string) => {
      if (!isValidImageHash(hash)) return null
      for (const ext of ['jpg', 'png', 'webp']) {
        try {
          return { bytes: readCachedImage(hash, ext), ext }
        } catch {
          // prova la prossima estensione
        }
      }
      return null
    })

  const readLogo = deps.readLogo ?? ((marchio: string) => caricaLogoMarchio(marchio))

  const iconMap: Record<string, string> = {}
  const imageMap: Record<string, string> = {}

  for (const el of scene.elements) {
    if (el.type === 'icona-label' && !(el.chiave in iconMap)) {
      const rec = await getIcon(el.chiave)
      if (rec) iconMap[el.chiave] = innerSvg(rec.svg)
    }
    if (el.type === 'foto' && !(el.imageHash in imageMap)) {
      const img = readImage(el.imageHash)
      if (img) imageMap[el.imageHash] = `data:${extToMime(img.ext)};base64,${img.bytes.toString('base64')}`
    }
    // Logo del marchio: risolto dall'eyebrow (testo/sottotitolo = marchio) e messo nella imageMap
    // sotto la chiave `logo:<slug>` — riusa il resolver immagini già propagato a preview ed export,
    // niente plumbing nuovo lato client. Se il file non c'è, il renderer disegna il wordmark.
    if (el.type === 'testo' && el.ruolo === 'sottotitolo') {
      const chiave = chiaveLogo(el.testo)
      if (!(chiave in imageMap)) {
        const dataUri = readLogo(el.testo)
        if (dataUri) imageMap[chiave] = dataUri
      }
    }
  }

  return { iconMap, imageMap }
}

/** Mappa chiave→inner-SVG per le chiavi con icona approvata (le altre assenti). */
export async function resolveIconsForKeys(
  chiavi: string[],
  deps: { getIcon?: (k: string) => Promise<{ svg: string } | null> } = {},
): Promise<Record<string, string>> {
  const getIcon = deps.getIcon ?? ((k: string) => getApprovedIcon(k))
  const out: Record<string, string> = {}
  for (const k of chiavi) {
    if (k in out) continue
    const rec = await getIcon(k)
    if (rec) out[k] = innerSvg(rec.svg)
  }
  return out
}

/** Bundle per l'EDITOR: include icone approvate E in-revisione (l'icona scelta è subito visibile),
 *  e restituisce l'elenco delle chiavi non approvate (per la marcatura). L'export usa comunque
 *  solo le approvate (getApprovedIcon in resolveRenderBundle) — regola d'oro §7. */
export async function resolveEditorIcons(
  chiavi: string[],
  deps: { getIcon?: (k: string) => Promise<{ svg: string; status: 'approvata' | 'in-revisione' } | null> } = {},
): Promise<{ iconMap: Record<string, string>; inRevisione: string[] }> {
  const get = deps.getIcon ?? ((k: string) => getIcon(k))
  const iconMap: Record<string, string> = {}
  const inRevisione: string[] = []
  for (const k of chiavi) {
    if (k in iconMap) continue
    const rec = await get(k)
    if (!rec) continue
    iconMap[k] = innerSvg(rec.svg)
    if (rec.status === 'in-revisione') inRevisione.push(k)
  }
  return { iconMap, inRevisione }
}

/** Render canonico server-side: bundle + renderScene → stringa SVG. Usato da preview ed export. */
export async function renderSceneServer(scene: Scene, deps: BundleDeps = {}): Promise<string> {
  const bundle = await resolveRenderBundle(scene, deps)
  return renderScene(scene, {
    icon: (k) => bundle.iconMap[k] ?? null,
    image: (hash) => bundle.imageMap[hash] ?? null,
  })
}
