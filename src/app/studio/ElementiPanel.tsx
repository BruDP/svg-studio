'use client'

import type { Scene, QuotaElement, TestoElement, BadgeElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'
import { Accordion } from './Accordion'

const NOME_MISURA: Record<QuotaElement['orientamento'], string> = {
  verticale: 'Altezza',
  orizzontale: 'Larghezza',
  diagonale: 'Profondità',
}

const NOME_RUOLO: Record<TestoElement['ruolo'], string> = {
  titolo: 'Titolo',
  sottotitolo: 'Eyebrow (marchio)',
  corpo: 'Testo',
}

/** Chip di stato mostra/nascondi: "attiva" (elemento visibile) = tint secondary + testo primary. */
function ChipToggle({ visibile, label, onClick }: { visibile: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="shrink-0 rounded-[var(--r-full)] px-2.5 py-1 text-xs"
      style={
        visibile
          ? { background: 'rgba(167, 139, 250, .25)', color: 'var(--primary)', fontWeight: 600 }
          : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }
      }
      onClick={onClick}
    >
      {visibile ? 'Mostrato' : 'Nascosto'}
    </button>
  )
}

/**
 * Pannello "Elementi": ogni misura, il titolo/eyebrow e i badge sono mostra/nascondi (toggle,
 * non elimina — coordinate/testo preservati) e, per titolo/eyebrow/badge, il testo è modificabile.
 * Le icone-caratteristica hanno il loro pannello dedicato (FeaturePanel: riordino/rimozione/aggiunta).
 */
export function ElementiPanel({ scene, dispatch }: { scene: Scene; dispatch: (a: SceneAction) => void }) {
  const quote = scene.elements.filter((e): e is QuotaElement => e.type === 'quota')
  const testi = scene.elements.filter((e): e is TestoElement => e.type === 'testo')
  const badges = scene.elements.filter((e): e is BadgeElement => e.type === 'badge')

  if (quote.length === 0 && testi.length === 0 && badges.length === 0) return null

  const header = (
    <>
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-sm)] text-sm"
        style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}
        aria-hidden
      >
        🧩
      </span>
      <h3 className="truncate font-medium" style={{ color: 'var(--fg)' }}>Elementi</h3>
    </>
  )

  return (
    <Accordion header={header}>
      <ul className="space-y-1.5">
        {testi.map((el) => (
          <li key={el.id} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
            <label className="sr-only" htmlFor={`testo-${el.id}`}>{NOME_RUOLO[el.ruolo]}</label>
            <input
              id={`testo-${el.id}`}
              aria-label={NOME_RUOLO[el.ruolo]}
              className="min-w-0 flex-1 rounded-[var(--r-sm)] px-2 py-1 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              value={el.testo}
              onChange={(e) => dispatch({ type: 'modifica-testo', id: el.id, testo: e.target.value })}
            />
            <ChipToggle
              visibile={!el.nascosto}
              label={`${el.nascosto ? 'Mostra' : 'Nascondi'} ${NOME_RUOLO[el.ruolo]}`}
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            />
          </li>
        ))}
        {quote.map((el) => (
          <li key={el.id} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
            <span className="min-w-0 flex-1 text-sm" style={{ color: 'var(--fg)' }}>
              {NOME_MISURA[el.orientamento]} <span style={{ color: 'var(--fg-muted)' }}>({el.valore})</span>
            </span>
            <ChipToggle
              visibile={!el.nascosta}
              label={`${el.nascosta ? 'Mostra' : 'Nascondi'} ${NOME_MISURA[el.orientamento]}`}
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            />
          </li>
        ))}
        {badges.map((el, i) => (
          <li key={el.id} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
            <label className="sr-only" htmlFor={`badge-${el.id}`}>{`Badge ${i + 1}`}</label>
            <input
              id={`badge-${el.id}`}
              aria-label={`Badge ${i + 1}`}
              className="min-w-0 flex-1 rounded-[var(--r-sm)] px-2 py-1 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              value={el.testo}
              onChange={(e) => dispatch({ type: 'modifica-testo', id: el.id, testo: e.target.value })}
            />
            <ChipToggle
              visibile={!el.nascosto}
              label={`${el.nascosto ? 'Mostra' : 'Nascondi'} badge ${i + 1}`}
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            />
          </li>
        ))}
      </ul>
    </Accordion>
  )
}
