import { parse } from 'csv-parse/sync'
import he from 'he'
import type { ProductRecord } from './types'

/** Decodifica entità HTML e rimuove i tag, preservando il testo. */
function clean(raw: string | undefined): string {
  if (!raw) return ''
  return he
    .decode(raw)
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .trim()
}

/** La Nota Tecnica usa "&#13;<br>" come separatore di riga. */
function splitNota(raw: string | undefined): string[] {
  if (!raw) return []
  return he
    .decode(raw)
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, '').replace(/\r/g, '').trim())
    .filter((line) => line.length > 0)
}

function toNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseFeed(csvText: string): ProductRecord[] {
  const rows: Record<string, string>[] = parse(csvText, {
    delimiter: ';',
    columns: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
  })

  return rows
    .filter((r) => r['SKU']?.trim())
    .map((r) => {
      const imageKeys = ['url1thumb', 'url2base', 'url3small', 'url4img1', 'url5img2', 'url6img3', 'url7img4', 'url8img5']
      const images = [...new Set(imageKeys.map((k) => r[k]?.trim()).filter((u): u is string => !!u))]
      return {
        sku: r['SKU'].trim(),
        images,
        descrizioneBreve: clean(r['Descrizione_Breve']),
        descrizioneEstesa: clean(r['Descrizione Estesa']),
        notaTecnica: splitNota(r['Nota Tecnica']),
        notaEmozionale: clean(r['Nota emozionale']),
        prezzo: r['Prezzo']?.trim() ?? '',
        marchio: r['Marchio']?.trim() ?? '',
        urlSlug: r['Url']?.trim() ?? '',
        colore: r['Colore']?.trim() ?? '',
        materiale: r['Materiale']?.trim() ?? '',
        imballo: {
          lunghezza: toNumber(r['Imballo Lenght']),
          larghezza: toNumber(r['Imballo Width']),
          altezza: toNumber(r['Imballo Height']),
        },
      }
    })
}
