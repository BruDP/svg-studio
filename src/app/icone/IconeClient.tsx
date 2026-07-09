'use client'

import { useEffect, useState, useTransition } from 'react'
import { listIconeAction, approveIconAction, seedIconeAction } from '../actions'

type Icona = { key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }

export function IconeClient() {
  const [icone, setIcone] = useState<Icona[]>([])
  const [inCorso, start] = useTransition()

  function ricarica() {
    start(async () => setIcone(await listIconeAction()))
  }
  useEffect(ricarica, [])

  function approva(key: string) {
    start(async () => { await approveIconAction(key); setIcone(await listIconeAction()) })
  }
  function approvaTutte() {
    start(async () => {
      for (const i of icone.filter((x) => x.status === 'in-revisione')) await approveIconAction(i.key)
      setIcone(await listIconeAction())
    })
  }
  function semina() {
    start(async () => { await seedIconeAction(); setIcone(await listIconeAction()) })
  }

  const daApprovare = icone.filter((i) => i.status === 'in-revisione').length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button className="rounded border border-zinc-300 px-3 py-1" onClick={semina} disabled={inCorso}>Semina dal dizionario</button>
        <button className="rounded bg-emerald-700 px-3 py-1 text-white disabled:opacity-50" onClick={approvaTutte} disabled={inCorso || daApprovare === 0}>Approva tutte ({daApprovare})</button>
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {icone.map((i) => (
          <div key={i.key} className={`flex flex-col items-center gap-1 rounded border p-2 ${i.status === 'in-revisione' ? 'border-amber-400' : 'border-zinc-200'}`}>
            <div className="h-10 w-10" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" width="100%" height="100%">${i.innerSvg}</svg>` }} />
            <span className="truncate text-[10px] text-zinc-600" title={i.key}>{i.key}</span>
            {i.status === 'in-revisione'
              ? <button aria-label={`Approva ${i.key}`} className="rounded bg-amber-500 px-2 text-xs text-white" onClick={() => approva(i.key)}>Approva</button>
              : <span className="text-[10px] text-emerald-700">approvata</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
