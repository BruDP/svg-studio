import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const { db } = await import('@/lib/db')
  const { loadDictionary } = await import('@/lib/dictionary/loader')
  const { fetchIconifySvg, searchIconify } = await import('@/lib/icons/iconify')
  const { saveIcon, getIcon, approveIcon } = await import('@/lib/icons/repository')

  const dict = loadDictionary()
  const keys = Object.keys(dict.features).sort()
  const approva = process.argv.includes('--approve')
  let creati = 0
  let saltati = 0

  for (const key of keys) {
    if (await getIcon(key)) {
      saltati++
      continue
    }
    const preferita = dict.features[key].icona // forma "set:name" dal dizionario
    let id = preferita
    try {
      // se l'icona preferita non è in forma set:name, ripiega su una ricerca per chiave
      if (!preferita.includes(':')) {
        const candidati = await searchIconify(key.replace(/_/g, ' '))
        if (candidati[0]) id = candidati[0].id
      }
      const rawSvg = await fetchIconifySvg(id)
      await saveIcon({ key, rawSvg, source: `iconify:${id.split(':')[0]}`, license: 'iconify-permissive' })
      if (approva) await approveIcon(key)
      creati++
      console.error(`✓ ${key} ← ${id}`)
    } catch (e) {
      console.error(`✗ ${key}: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.error(`\nSeeding completato: ${creati} create${approva ? ' e approvate' : ''}, ${saltati} già presenti.`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
