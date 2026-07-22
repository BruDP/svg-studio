'use client'

import type { Scene, QuotaElement, TestoElement, BadgeElement } from '@/lib/scene/types'
import type { SceneAction } from '@/lib/scene/mutations'

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

  return (
    <div className="space-y-2">
      <h3 className="font-medium text-zinc-700">Elementi</h3>
      <ul className="space-y-1">
        {testi.map((el) => (
          <li key={el.id} className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`testo-${el.id}`}>{NOME_RUOLO[el.ruolo]}</label>
            <input
              id={`testo-${el.id}`}
              aria-label={NOME_RUOLO[el.ruolo]}
              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={el.testo}
              onChange={(e) => dispatch({ type: 'modifica-testo', id: el.id, testo: e.target.value })}
            />
            <button
              type="button"
              aria-label={`${el.nascosto ? 'Mostra' : 'Nascondi'} ${NOME_RUOLO[el.ruolo]}`}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-emerald-600"
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            >
              {el.nascosto ? 'Mostra' : 'Nascondi'}
            </button>
          </li>
        ))}
        {quote.map((el) => (
          <li key={el.id} className="flex items-center gap-1">
            <span className="flex-1 text-sm text-zinc-700">
              {NOME_MISURA[el.orientamento]} <span className="text-zinc-400">({el.valore})</span>
            </span>
            <button
              type="button"
              aria-label={`${el.nascosta ? 'Mostra' : 'Nascondi'} ${NOME_MISURA[el.orientamento]}`}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-emerald-600"
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            >
              {el.nascosta ? 'Mostra' : 'Nascondi'}
            </button>
          </li>
        ))}
        {badges.map((el, i) => (
          <li key={el.id} className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`badge-${el.id}`}>{`Badge ${i + 1}`}</label>
            <input
              id={`badge-${el.id}`}
              aria-label={`Badge ${i + 1}`}
              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={el.testo}
              onChange={(e) => dispatch({ type: 'modifica-testo', id: el.id, testo: e.target.value })}
            />
            <button
              type="button"
              aria-label={`${el.nascosto ? 'Mostra' : 'Nascondi'} badge ${i + 1}`}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-emerald-600"
              onClick={() => dispatch({ type: 'toggle-elemento', id: el.id })}
            >
              {el.nascosto ? 'Mostra' : 'Nascondi'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
