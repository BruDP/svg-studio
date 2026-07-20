'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { cercaSkuAction, generaSchedaAction } from '../actions'

export type VoceLista = { sku: string; descrizioneBreve: string }

type StatoRiga =
  | { stato: 'in-corso' }
  | { stato: 'fatto'; path: string }
  | { stato: 'errore'; errore: string }

/**
 * Vista "banco di lavoro": ricerca prodotti a sinistra, lista di lavoro persistente a destra.
 * Da qui si apre l'editor sulla singola scheda (`onApri`) o si genera in blocco (`generaTutte`,
 * SEMPRE sequenziale — vedi commento su `generaTutte`).
 */
export function Banco({
  listaLavoro,
  setListaLavoro,
  onApri,
}: {
  listaLavoro: VoceLista[]
  setListaLavoro: Dispatch<SetStateAction<VoceLista[]>>
  onApri: (sku: string) => void
}) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState<VoceLista[]>([])
  const [cercando, setCercando] = useState(false)
  const [statoRighe, setStatoRighe] = useState<Record<string, StatoRiga>>({})
  const [generazioneInCorso, setGenerazioneInCorso] = useState(false)
  const [riepilogo, setRiepilogo] = useState<{ ok: number; errori: number } | null>(null)

  // Debounce ~300ms, min 2 caratteri: evita una chiamata server a ogni tasto premuto.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setRisultati([])
      setCercando(false)
      return
    }
    setCercando(true)
    const timer = setTimeout(() => {
      cercaSkuAction(q)
        .then((r) => setRisultati(r))
        .finally(() => setCercando(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const skuInLista = new Set(listaLavoro.map((l) => l.sku))

  function aggiungi(voce: VoceLista) {
    setListaLavoro((prev) => (prev.some((p) => p.sku === voce.sku) ? prev : [...prev, voce]))
  }

  function rimuovi(sku: string) {
    setListaLavoro((prev) => prev.filter((p) => p.sku !== sku))
    setStatoRighe((prev) => {
      const { [sku]: _tolta, ...resto } = prev
      return resto
    })
  }

  function svuota() {
    setListaLavoro([])
    setStatoRighe({})
    setRiepilogo(null)
  }

  // Batch SEMPRE sequenziale: due `composeSceneForProduct` in parallelo urtano il vincolo
  // unique (sku, inputHash) della cache estrazioni. Mai Promise.all qui.
  async function generaTutte() {
    setGenerazioneInCorso(true)
    setRiepilogo(null)
    let ok = 0
    let errori = 0
    for (const voce of listaLavoro) {
      setStatoRighe((prev) => ({ ...prev, [voce.sku]: { stato: 'in-corso' } }))
      try {
        const r = await generaSchedaAction(voce.sku)
        if (r.ok && r.path) {
          ok++
          setStatoRighe((prev) => ({ ...prev, [voce.sku]: { stato: 'fatto', path: r.path! } }))
        } else {
          errori++
          setStatoRighe((prev) => ({ ...prev, [voce.sku]: { stato: 'errore', errore: r.errore ?? 'Errore sconosciuto' } }))
        }
      } catch (e) {
        errori++
        setStatoRighe((prev) => ({ ...prev, [voce.sku]: { stato: 'errore', errore: e instanceof Error ? e.message : 'Errore' } }))
      }
    }
    setRiepilogo({ ok, errori })
    setGenerazioneInCorso(false)
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <section aria-label="Ricerca prodotti" className="flex-1 space-y-3">
        <div>
          <label htmlFor="ricerca-banco" className="block text-sm font-medium text-zinc-700">
            Cerca per codice o descrizione
          </label>
          <input
            id="ricerca-banco"
            aria-label="Cerca per codice o descrizione"
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 transition-colors duration-150 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
            placeholder="Es. 2137070 oppure barbecue"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="reparto-banco" className="block text-sm font-medium text-zinc-700">
            Reparto
          </label>
          <select
            id="reparto-banco"
            aria-label="Reparto (prossimamente disponibile)"
            title="Il feed non ha ancora la colonna reparto: filtro non disponibile"
            disabled
            className="mt-1 w-full cursor-not-allowed rounded border border-zinc-300 bg-zinc-100 px-2 py-2 text-sm text-zinc-400"
          >
            <option>Reparto (prossimamente)</option>
          </select>
        </div>

        {cercando && <p className="text-sm text-zinc-500">Cerco…</p>}
        {!cercando && query.trim().length >= 2 && risultati.length === 0 && (
          <p className="text-sm text-zinc-500">Nessun risultato per &laquo;{query.trim()}&raquo;.</p>
        )}

        {risultati.length > 0 && (
          <ul className="divide-y divide-zinc-200 rounded border border-zinc-200">
            {risultati.map((r) => {
              const giaAggiunto = skuInLista.has(r.sku)
              return (
                <li key={r.sku} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="text-zinc-500">{r.sku}</span> — {r.descrizioneBreve}
                  </div>
                  <button
                    type="button"
                    aria-label={giaAggiunto ? `${r.sku} già aggiunto alla lista` : `Aggiungi ${r.sku} alla lista di lavoro`}
                    className="min-h-[40px] shrink-0 rounded bg-emerald-700 px-3 py-2 text-sm text-white transition-colors duration-150 hover:bg-emerald-800 disabled:bg-zinc-300 disabled:text-zinc-600"
                    disabled={giaAggiunto}
                    onClick={() => aggiungi(r)}
                  >
                    {giaAggiunto ? '✓ aggiunto' : '+ Aggiungi'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-label="Lista di lavoro" className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-700">Lista di lavoro ({listaLavoro.length})</h2>
          <button
            type="button"
            className="min-h-[40px] rounded px-3 py-2 text-sm text-zinc-600 underline decoration-zinc-400 underline-offset-2 transition-colors duration-150 hover:text-zinc-900 disabled:opacity-40"
            onClick={svuota}
            disabled={listaLavoro.length === 0 || generazioneInCorso}
          >
            Svuota
          </button>
        </div>

        {listaLavoro.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuna scheda in lista. Cerca un prodotto a sinistra e aggiungilo.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded border border-zinc-200">
            {listaLavoro.map((voce) => {
              const s = statoRighe[voce.sku]
              return (
                <li key={voce.sku} className="flex items-center gap-1 px-3 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <div>
                      <span className="text-zinc-500">{voce.sku}</span> — {voce.descrizioneBreve}
                    </div>
                    {s?.stato === 'in-corso' && <p className="text-xs text-amber-700">⏳ in corso</p>}
                    {s?.stato === 'fatto' && <p className="text-xs text-emerald-700">✓ fatto ({s.path})</p>}
                    {s?.stato === 'errore' && (
                      <p role="alert" className="text-xs text-red-600">✗ {s.errore}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Apri ${voce.sku}`}
                    className="min-h-[40px] shrink-0 rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors duration-150 hover:border-emerald-600 disabled:opacity-40"
                    onClick={() => onApri(voce.sku)}
                    disabled={generazioneInCorso}
                  >
                    Apri
                  </button>
                  <button
                    type="button"
                    aria-label={`Rimuovi ${voce.sku} dalla lista`}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded text-red-600 transition-colors duration-150 hover:bg-red-50 disabled:opacity-30"
                    onClick={() => rimuovi(voce.sku)}
                    disabled={generazioneInCorso}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white py-3">
          <button
            type="button"
            className="min-h-[40px] rounded bg-zinc-800 px-4 py-2 text-white transition-colors duration-150 hover:bg-zinc-900 disabled:opacity-50"
            onClick={generaTutte}
            disabled={listaLavoro.length === 0 || generazioneInCorso}
          >
            {generazioneInCorso ? 'Genero…' : 'Genera tutte'}
          </button>
          {riepilogo && (
            <p className="text-sm text-zinc-700">
              {riepilogo.ok} generate, {riepilogo.errori} errori
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
