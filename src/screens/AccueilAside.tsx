import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import { BareIcon, Progress } from '../components/ui'
import type { SubPage } from './Plus'

/** Colonne d'aperçu, affichée seulement sur les très grands écrans. */
export function AccueilAside({ openSub, goCharts }: { openSub: (p: SubPage) => void; goCharts: () => void }) {
  const { txs, month, budgets, goals, debts, cur, catById, rootOf } = useData()
  const monthTx = useMemo(() => txs.filter((t) => t.occurred_on.startsWith(month) && t.kind === 'depense'), [txs, month])
  const spent = monthTx.reduce((a, t) => a + t.amount, 0)
  const global = budgets.find((b) => !b.category_id)
  const top = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTx) { const r = rootOf(t.category_id); const k = r?.id ?? ''; m.set(k, (m.get(k) ?? 0) + t.amount) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [monthTx, rootOf])
  const owe = debts.filter((d) => d.direction === 'je_dois').reduce((a, d) => a + Math.max(0, d.amount - d.paid), 0)
  const Head = ({ t, onClick }: { t: string; onClick: () => void }) => (
    <button onClick={onClick} className="mb-2 flex w-full items-center justify-between font-semibold">{t}<ChevronRight size={18} className="text-ink-muted" /></button>
  )
  return (
    <aside className="hidden space-y-4 2xl:sticky 2xl:top-4 2xl:block">
      <section className="tile p-5">
        <Head t="Budget du mois" onClick={() => openSub('budget')} />
        {global ? (
          <>
            <div className="mb-2 flex justify-between text-sm"><span className="tabular">{fmt(spent, cur)}</span><span className="tabular text-ink-muted">/ {fmt(global.monthly_amount, cur)}</span></div>
            <Progress value={spent} max={global.monthly_amount} />
            <p className="mt-1 text-xs text-ink-muted">{spent > global.monthly_amount ? `Dépassé de ${fmt(spent - global.monthly_amount, cur)}` : `Reste ${fmt(global.monthly_amount - spent, cur)}`}</p>
          </>
        ) : <p className="text-sm text-ink-muted">Aucun budget global défini.</p>}
      </section>
      <section className="tile p-5">
        <Head t="Où va l'argent" onClick={goCharts} />
        {top.length === 0 && <p className="text-sm text-ink-muted">Aucune dépense ce mois-ci.</p>}
        {top.map(([id, v]) => {
          const c = catById.get(id)
          return (
            <div key={id} className="py-1.5">
              <div className="mb-1 flex items-center gap-2 text-sm"><BareIcon name={c?.name ?? ''} emoji={c?.icon} size={18} /><span className="flex-1 truncate">{c?.name ?? 'Sans catégorie'}</span><span className="tabular">{fmt(v, cur)}</span></div>
              <Progress value={v} max={spent || 1} color={c?.color} />
            </div>
          )
        })}
      </section>
      <section className="tile p-5">
        <Head t="Épargnes" onClick={() => openSub('objectifs')} />
        <p className="tabular text-2xl font-semibold">{fmt(goals.reduce((a, g) => a + g.saved_amount, 0), cur)}</p>
        {goals.slice(0, 4).map((g) => <div key={g.id} className="flex justify-between py-1 text-sm"><span className="truncate">{g.name}</span><span className="tabular text-ink-muted">{fmt(g.saved_amount, cur)}</span></div>)}
      </section>
      <section className="tile p-5">
        <Head t="Dettes" onClick={() => openSub('dettes')} />
        <p className={`tabular text-2xl font-semibold ${owe ? 'text-red-600' : ''}`}>{fmt(owe, cur)}</p>
        <p className="text-xs text-ink-muted">restant à rembourser</p>
      </section>
    </aside>
  )
}
