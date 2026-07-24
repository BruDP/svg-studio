'use client'

import { useEffect, useState, useTransition } from 'react'
import { listIconeAction, approveIconAction, seedIconeAction } from '../actions'

type Icona = { key: string; innerSvg: string; status: 'approvata' | 'in-revisione' }

export function IconeClient() {
  const [icone, setIcone] = useState<Icona[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, start] = useTransition()

  function ricarica() {
    setErrore(null)
    start(async () => {
      try {
        setIcone(await listIconeAction())
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore nel caricamento delle icone')
      }
    })
  }
  useEffect(ricarica, [])

  function approva(key: string) {
    setErrore(null)
    start(async () => {
      try {
        await approveIconAction(key)
        setIcone(await listIconeAction())
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore durante l\'approvazione')
      }
    })
  }
  function approvaTutte() {
    setErrore(null)
    start(async () => {
      try {
        for (const i of icone.filter((x) => x.status === 'in-revisione')) await approveIconAction(i.key)
        setIcone(await listIconeAction())
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore durante l\'approvazione massiva')
      }
    })
  }
  function semina() {
    setErrore(null)
    start(async () => {
      try {
        await seedIconeAction()
        setIcone(await listIconeAction())
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Errore durante il seeding')
      }
    })
  }

  const daApprovare = icone.filter((i) => i.status === 'in-revisione').length

  return (
    <div className="flex flex-col gap-4">
      {errore && <p role="alert" className="text-sm rounded-lg p-3" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>{errore}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className="text-sm font-medium transition-all duration-150"
          style={{
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            padding: '8px 12px',
            backgroundColor: 'var(--surface)',
            color: 'var(--fg)',
            cursor: inCorso ? 'default' : 'pointer',
            opacity: inCorso ? 0.5 : 1,
          }}
          onClick={semina}
          disabled={inCorso}
          onMouseEnter={(e) => {
            if (!inCorso) {
              e.currentTarget.style.backgroundColor = 'var(--surface-2)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }
          }}
          onMouseLeave={(e) => {
            if (!inCorso) {
              e.currentTarget.style.backgroundColor = 'var(--surface)'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        >
          Semina dal dizionario
        </button>
        <button
          className="text-sm font-medium transition-all duration-150"
          style={{
            borderRadius: 'var(--r-md)',
            padding: '8px 12px',
            backgroundColor: daApprovare === 0 || inCorso ? 'var(--surface-2)' : 'var(--accent-cta)',
            color: daApprovare === 0 || inCorso ? 'var(--fg-muted)' : 'white',
            border: 'none',
            boxShadow: daApprovare === 0 || inCorso ? 'none' : 'var(--glow-accent)',
            cursor: daApprovare === 0 || inCorso ? 'default' : 'pointer',
            opacity: daApprovare === 0 || inCorso ? 0.5 : 1,
          }}
          onClick={approvaTutte}
          disabled={inCorso || daApprovare === 0}
          onMouseEnter={(e) => {
            if (!(daApprovare === 0 || inCorso)) {
              e.currentTarget.style.filter = 'brightness(1.1)'
            }
          }}
          onMouseLeave={(e) => {
            if (!(daApprovare === 0 || inCorso)) {
              e.currentTarget.style.filter = 'brightness(1)'
            }
          }}
        >
          Approva tutte ({daApprovare})
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
        {icone.map((i) => (
          <div
            key={i.key}
            className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-150"
            style={{
              backgroundColor: 'var(--surface)',
              border: i.status === 'in-revisione' ? '1px solid var(--warning)' : '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div className="h-10 w-10 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="100%" height="100%" style="stroke: var(--fg)">${i.innerSvg}</svg>` }} />
            <span className="truncate text-[11px]" style={{ color: 'var(--fg-muted)' }} title={i.key}>{i.key}</span>
            {i.status === 'in-revisione'
              ? <button
                  aria-label={`Approva ${i.key}`}
                  className="text-xs font-medium transition-all duration-150"
                  style={{
                    borderRadius: 'var(--r-md)',
                    backgroundColor: 'var(--warning)',
                    color: 'white',
                    padding: '4px 8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => approva(i.key)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)'
                  }}
                >
                  Approva
                </button>
              : <span className="text-[11px] font-medium" style={{ color: 'var(--success)' }}>approvata</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
