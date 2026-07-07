'use client'

import { useState, useTransition } from 'react'
import { proposeSceneAction, exportSceneAction } from '../actions'
import type { ProposeResult } from '@/lib/ui/types'

export function StudioClient() {
  const [sku, setSku] = useState('')
  const [data, setData] = useState<ProposeResult | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, startTransition] = useTransition()

  function proponi() {
    setErrore(null)
    setThumb(null)
    startTransition(async () => {
      try {
        setData(await proposeSceneAction(sku))
      } catch (e) {
        setData(null)
        setErrore(e instanceof Error ? e.message : 'Errore sconosciuto')
      }
    })
  }

  function esporta() {
    if (!data) return
    setErrore(null)
    startTransition(async () => {
      try {
        const res = await exportSceneAction(JSON.stringify(data.scene))
        setThumb(res.thumbDataUri)
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore export')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          aria-label="SKU"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
          placeholder="Inserisci SKU (es. 2137070)"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && proponi()}
        />
        <button
          className="rounded bg-zinc-800 px-4 py-2 text-white disabled:opacity-50"
          onClick={proponi}
          disabled={inCorso || sku.trim() === ''}
        >
          {inCorso ? 'Elaboro…' : 'Proponi'}
        </button>
      </div>

      {errore && <p role="alert" className="text-red-600">{errore}</p>}

      {data && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            {/* Anteprima client-side (renderScene su scena+iconMap+imageDataUri): Task 4 di Fase 3b. */}
            {data.imageDataUri && (
              <img
                alt="Foto prodotto"
                src={data.imageDataUri}
                className="w-full max-w-[1000px] aspect-square border border-zinc-200 bg-white object-contain"
              />
            )}
          </div>
          <aside className="w-full md:w-72">
            <h2 className="font-medium text-zinc-700">{data.prodotto.descrizioneBreve}</h2>
            <p className="mb-2 text-sm text-zinc-500">SKU {data.prodotto.sku}</p>
            <ul className="mb-4 space-y-1 text-sm">
              {data.scene.elements
                .filter((el) => el.type === 'icona-label')
                .map((el) => (
                  <li key={el.id} className={'verificata' in el && !el.verificata ? 'text-amber-600' : 'text-zinc-700'}>
                    {'etichetta' in el ? el.etichetta : ''}
                    {'verificata' in el && !el.verificata ? ' ⚠︎' : ''}
                  </li>
                ))}
            </ul>
            <button
              className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              onClick={esporta}
              disabled={inCorso}
            >
              Esporta JPEG
            </button>
            {thumb && (
              <div className="mt-3">
                <p className="text-sm text-zinc-500">Esportata:</p>
                {/* miniatura di conferma; è un data URI generato da noi */}
                <img alt="Anteprima esportata" src={thumb} className="mt-1 border border-zinc-200" width={240} height={240} />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
