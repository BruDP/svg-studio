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
import { Banco, type VoceLista } from './Banco'

type Bundle = {
  iconMap: Record<string, string>
  imageMap: Record<string, string>
  categoriaFeatures: ProposeResult['categoriaFeatures']
  immagini: string[]
  iconeNonApprovate: string[]
}

/**
 * Gruppi (sotto-prodotti) presenti nella scena, in ordine di prima comparsa. Scena a prodotto
 * singolo → []. Solo `foto`/`quota`/`badge` portano `gruppo`; gli altri tipi ne sono privi.
 */
function gruppiDiScena(scene: Scene | null): string[] {
  if (!scene) return []
  return [
    ...new Set(
      scene.elements
        .map((e) => ('gruppo' in e ? e.gruppo : undefined))
        .filter((g): g is string => Boolean(g)),
    ),
  ]
}

export function StudioClient() {
  const [vista, setVista] = useState<'banco' | 'editor'>('banco')
  const [listaLavoro, setListaLavoro] = useState<VoceLista[]>([])

  const [sku, setSku] = useState('')
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [scene, dispatch] = useReducer(
    (s: Scene | null, a: Parameters<typeof applyMutation>[1] | { type: 'reset'; scene: Scene | null }) =>
      a.type === 'reset' ? a.scene : s ? applyMutation(s, a) : s,
    null,
  )
  const [prodotto, setProdotto] = useState<ProposeResult['prodotto'] | null>(null)
  const [salvataDisponibile, setSalvata] = useState(false)
  const [thumb, setThumb] = useState<string | null>(null)
  const [avvisoExport, setAvvisoExport] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [pickerChiave, setPickerChiave] = useState<string | null>(null)
  const [fotoUrlCorrente, setFotoUrlCorrente] = useState<string>('')
  const [gruppoAttivo, setGruppoAttivo] = useState<string | null>(null)
  const [inCorso, start] = useTransition()

  const gruppi = gruppiDiScena(scene)

  function proponiSku(skuArg: string = sku) {
    setErrore(null); setThumb(null); setMsg(null)
    // Pulisce la scheda precedente (se aperta da un'altra voce della lista) prima di caricare
    // la nuova, così non lampeggia un editor disallineato mentre la propose è in corso.
    dispatch({ type: 'reset', scene: null })
    setBundle(null)
    setProdotto(null)
    start(async () => {
      try {
        const r = await proposeSceneAction(skuArg)
        dispatch({ type: 'reset', scene: r.scene })
        setBundle({ iconMap: r.iconMap, imageMap: r.imageMap, categoriaFeatures: r.categoriaFeatures, immagini: r.immagini, iconeNonApprovate: r.iconeNonApprovate })
        setProdotto(r.prodotto)
        setSalvata(r.salvataDisponibile)
        setFotoUrlCorrente(r.immagini?.[0] ?? '')
        setGruppoAttivo(gruppiDiScena(r.scene)[0] ?? null)
      } catch (e) { setBundle(null); setErrore(e instanceof Error ? e.message : 'Errore') }
    })
  }

  /** Apre l'editor su uno SKU della lista di lavoro (voce "Apri"). */
  function apri(skuScelto: string) {
    setSku(skuScelto)
    setVista('editor')
    proponiSku(skuScelto)
  }

  /** Torna al banco SENZA perdere la lista di lavoro (che vive in questo componente). */
  function tornaAlBanco() {
    setVista('banco')
  }

  function riprendi() {
    setErrore(null); setThumb(null); setMsg(null)
    start(async () => {
      try {
        const r = await loadSceneAction(sku)
        if (!r) { setMsg('Nessuna scheda salvata per questo SKU'); return }
        dispatch({ type: 'reset', scene: r.scene })
        setBundle((b) => (b ? { ...b, iconMap: r.iconMap, imageMap: r.imageMap, iconeNonApprovate: r.iconeNonApprovate } : b))
        setFotoUrlCorrente(bundle?.immagini?.[0] ?? '')
        setGruppoAttivo(gruppiDiScena(r.scene)[0] ?? null)
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
    setErrore(null); setMsg(null)
    start(async () => {
      try {
        const r = await cambiaFotoAction(prodotto.sku, url, gruppoAttivo ? { gruppo: gruppoAttivo } : undefined)
        dispatch({ type: 'imposta-foto', imageHash: r.imageHash, foto: r.foto, quote: r.quote, ...(r.gruppo ? { gruppo: r.gruppo } : {}) })
        setBundle((b) => (b ? { ...b, imageMap: { ...b.imageMap, [r.imageHash]: r.imageDataUri } } : b))
        setFotoUrlCorrente(url)
        if (!r.ritagliata) setMsg("Bbox non rilevato: uso l'immagine intera (quote da sistemare a mano).")
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore cambio foto')
      }
    })
  }

  function ricalcolaConVision() {
    if (!prodotto || !fotoUrlCorrente) return
    setErrore(null); setMsg(null)
    start(async () => {
      try {
        const r = await cambiaFotoAction(prodotto.sku, fotoUrlCorrente, { forzaVision: true, ...(gruppoAttivo ? { gruppo: gruppoAttivo } : {}) })
        dispatch({ type: 'imposta-foto', imageHash: r.imageHash, foto: r.foto, quote: r.quote, ...(r.gruppo ? { gruppo: r.gruppo } : {}) })
        setBundle((b) => (b ? { ...b, imageMap: { ...b.imageMap, [r.imageHash]: r.imageDataUri } } : b))
        setMsg(r.ritagliata ? 'Ritaglio ricalcolato con Vision.' : "Vision non ha rilevato un prodotto: uso l'immagine intera.")
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore Vision')
      }
    })
  }

  function esporta() {
    if (!scene) return
    setErrore(null); setAvvisoExport(null)
    start(async () => {
      try {
        const r = await exportSceneAction(JSON.stringify(scene))
        setThumb(r.thumbDataUri)
        if (r.iconeNonApprovate.length > 0) {
          setAvvisoExport(`⚠ ${r.iconeNonApprovate.length} icone non approvate non sono nella scheda. Approvale in /icone.`)
        }
      }
      catch (e) { setErrore(e instanceof Error ? e.message : 'Errore export') }
    })
  }

  if (vista === 'banco') {
    return <Banco listaLavoro={listaLavoro} setListaLavoro={setListaLavoro} onApri={apri} />
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="min-h-[40px] self-start rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors duration-150 hover:border-emerald-600 disabled:opacity-50"
        onClick={tornaAlBanco}
        disabled={inCorso}
      >
        ← Torna al banco
      </button>

      {errore && <p role="alert" className="text-red-600">{errore}</p>}
      {msg && <p className="text-emerald-700">{msg}</p>}
      {inCorso && !scene && <p className="text-zinc-500">Carico scheda {sku}…</p>}

      {scene && bundle && prodotto && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1"><EditorPreview scene={scene} iconMap={bundle.iconMap} imageMap={bundle.imageMap} dispatch={dispatch} inRevisione={bundle.iconeNonApprovate} /></div>
          <aside className="w-full md:w-80 space-y-3">
            <div>
              <h2 className="font-medium text-zinc-700">{prodotto.descrizioneBreve}</h2>
              <p className="text-sm text-zinc-500">SKU {prodotto.sku}</p>
            </div>
            {gruppi.length > 0 && (
              <div>
                <label htmlFor="gruppo-attivo" className="block text-sm font-medium text-zinc-700">
                  Pezzo da modificare
                </label>
                <select
                  id="gruppo-attivo"
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  value={gruppoAttivo ?? gruppi[0]}
                  onChange={(e) => setGruppoAttivo(e.target.value)}
                  disabled={inCorso}
                >
                  {gruppi.map((g, i) => (
                    <option key={g} value={g}>{`Pezzo ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            )}
            <PhotoPicker
              immagini={bundle.immagini}
              urlCorrente={fotoUrlCorrente}
              onScegli={cambiaFoto}
              onRicalcola={ricalcolaConVision}
              inCorso={inCorso}
              pezzoAttivo={gruppi.length > 0 ? `Pezzo ${gruppi.indexOf(gruppoAttivo ?? gruppi[0]) + 1}` : null}
            />
            <FeaturePanel scene={scene} categoriaFeatures={bundle.categoriaFeatures} dispatch={dispatch} onCambiaIcona={setPickerChiave} />
            {scene.elements.some((e) => e.type === 'quota') && (
              <button
                type="button"
                className="min-h-[40px] self-start rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors duration-150 hover:border-red-500 hover:text-red-600 disabled:opacity-50"
                onClick={() => dispatch({ type: 'rimuovi-quote' })}
                disabled={inCorso}
              >
                Rimuovi misure
              </button>
            )}
            <div className="flex gap-2">
              <button className="rounded bg-zinc-700 px-4 py-2 text-white disabled:opacity-50" onClick={salva} disabled={inCorso}>Salva</button>
              <button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={esporta} disabled={inCorso}>Esporta PNG + SVG</button>
              {salvataDisponibile && (
                <button className="rounded border border-zinc-300 px-4 py-2 text-zinc-700 disabled:opacity-50" onClick={riprendi} disabled={inCorso}>Riprendi salvata</button>
              )}
            </div>
            {thumb && (
              <div>
                <p className="text-sm text-zinc-500">Esportata:</p>
                <img alt="Anteprima esportata" src={thumb} className="mt-1 border border-zinc-200" width={240} height={240} />
                {avvisoExport && <p role="alert" className="mt-1 text-sm text-amber-700">{avvisoExport}</p>}
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
