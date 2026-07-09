'use client'

import { useReducer, useState, useTransition } from 'react'
import { proposeSceneAction, exportSceneAction, saveSceneAction, loadSceneAction, cambiaFotoAction } from '../actions'
import type { ProposeResult } from '@/lib/ui/types'
import type { Scene } from '@/lib/scene/types'
import { applyMutation } from '@/lib/scene/mutations'
import { EditorPreview } from '@/lib/ui/EditorPreview'
import { FeaturePanel } from './FeaturePanel'
import { IconPicker } from './IconPicker'
import { PhotoPicker } from './PhotoPicker'
import { SkuSearch } from './SkuSearch'

type Bundle = {
  iconMap: Record<string, string>
  imageDataUri: string | null
  categoriaFeatures: ProposeResult['categoriaFeatures']
  immagini: string[]
  iconeNonApprovate: string[]
}

export function StudioClient() {
  const [sku, setSku] = useState('')
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [scene, dispatch] = useReducer(
    (s: Scene | null, a: Parameters<typeof applyMutation>[1] | { type: 'reset'; scene: Scene }) =>
      a.type === 'reset' ? a.scene : s ? applyMutation(s, a) : s,
    null,
  )
  const [prodotto, setProdotto] = useState<ProposeResult['prodotto'] | null>(null)
  const [salvataDisponibile, setSalvata] = useState(false)
  const [thumb, setThumb] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [pickerChiave, setPickerChiave] = useState<string | null>(null)
  const [inCorso, start] = useTransition()

  function proponiSku(skuArg: string = sku) {
    setErrore(null); setThumb(null); setMsg(null)
    start(async () => {
      try {
        const r = await proposeSceneAction(skuArg)
        dispatch({ type: 'reset', scene: r.scene })
        setBundle({ iconMap: r.iconMap, imageDataUri: r.imageDataUri, categoriaFeatures: r.categoriaFeatures, immagini: r.immagini, iconeNonApprovate: r.iconeNonApprovate })
        setProdotto(r.prodotto)
        setSalvata(r.salvataDisponibile)
      } catch (e) { setBundle(null); setErrore(e instanceof Error ? e.message : 'Errore') }
    })
  }

  function riprendi() {
    setErrore(null); setThumb(null); setMsg(null)
    start(async () => {
      try {
        const r = await loadSceneAction(sku)
        if (!r) { setMsg('Nessuna scheda salvata per questo SKU'); return }
        dispatch({ type: 'reset', scene: r.scene })
        setBundle((b) => (b ? { ...b, iconMap: r.iconMap, imageDataUri: r.imageDataUri, iconeNonApprovate: r.iconeNonApprovate } : b))
      } catch (e) { setErrore(e instanceof Error ? e.message : 'Errore') }
    })
  }

  function salva() {
    if (!scene) return
    start(async () => {
      try { await saveSceneAction(JSON.stringify(scene)); setMsg('Scheda salvata'); setSalvata(true) }
      catch (e) { setErrore(e instanceof Error ? e.message : 'Errore salvataggio') }
    })
  }

  function cambiaFoto(url: string) {
    if (!prodotto) return
    start(async () => {
      try {
        const { imageHash, imageDataUri } = await cambiaFotoAction(prodotto.sku, url)
        dispatch({ type: 'imposta-foto', imageHash })
        setBundle((b) => (b ? { ...b, imageDataUri } : b))
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore cambio foto')
      }
    })
  }

  function esporta() {
    if (!scene) return
    setErrore(null)
    start(async () => {
      try { setThumb((await exportSceneAction(JSON.stringify(scene))).thumbDataUri) }
      catch (e) { setErrore(e instanceof Error ? e.message : 'Errore export') }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input aria-label="SKU" className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Inserisci SKU (es. 2137070)" value={sku}
          onChange={(e) => setSku(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && proponiSku()} />
        <button className="rounded bg-zinc-800 px-4 py-2 text-white disabled:opacity-50"
          onClick={() => proponiSku()} disabled={inCorso || sku.trim() === ''}>{inCorso ? 'Elaboro…' : 'Proponi'}</button>
      </div>

      <SkuSearch onScegli={(s) => { setSku(s); proponiSku(s) }} />

      {errore && <p role="alert" className="text-red-600">{errore}</p>}
      {msg && <p className="text-emerald-700">{msg}</p>}

      {scene && bundle && prodotto && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1"><EditorPreview scene={scene} iconMap={bundle.iconMap} imageDataUri={bundle.imageDataUri} dispatch={dispatch} /></div>
          <aside className="w-full md:w-80 space-y-3">
            <div>
              <h2 className="font-medium text-zinc-700">{prodotto.descrizioneBreve}</h2>
              <p className="text-sm text-zinc-500">SKU {prodotto.sku}</p>
            </div>
            <PhotoPicker immagini={bundle.immagini} onScegli={cambiaFoto} />
            <FeaturePanel scene={scene} categoriaFeatures={bundle.categoriaFeatures} dispatch={dispatch} onCambiaIcona={setPickerChiave} />
            <div className="flex gap-2">
              <button className="rounded bg-zinc-700 px-4 py-2 text-white disabled:opacity-50" onClick={salva} disabled={inCorso}>Salva</button>
              <button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={esporta} disabled={inCorso}>Esporta JPEG</button>
              {salvataDisponibile && (
                <button className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 disabled:opacity-50" onClick={riprendi} disabled={inCorso}>Riprendi salvata</button>
              )}
            </div>
            {thumb && (
              <div>
                <p className="text-sm text-zinc-500">Esportata:</p>
                <img alt="Anteprima esportata" src={thumb} className="mt-1 border border-zinc-200" width={240} height={240} />
              </div>
            )}
          </aside>
        </div>
      )}

      {pickerChiave && (
        <IconPicker
          chiave={pickerChiave}
          onChiudi={() => setPickerChiave(null)}
          onScelta={(innerSvg) => {
            setBundle((b) => (b ? { ...b, iconMap: { ...b.iconMap, [pickerChiave]: innerSvg }, iconeNonApprovate: [...new Set([...(b.iconeNonApprovate ?? []), pickerChiave])] } : b))
          }}
        />
      )}
    </div>
  )
}
