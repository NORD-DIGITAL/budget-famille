import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useData } from '../lib/data'
import { dayLabel, fmt, signed } from '../lib/format'
import type { Tx } from '../lib/types'
import { Empty, Header, IconBubble, MonthBar } from '../components/ui'

export default function CarnetScreen({ onEdit }: { onEdit: (t: Tx) => void }) {
  const { txs, month, catById, accById, memById, cur, carnet } = useData()
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)

  const monthTx = useMemo(() => {
    const s = q.trim().toLowerCase()
    return txs.filter((t) => {
      if (s) {
        const c = t.category_id ? catById.get(t.category_id)?.name ?? '' : ''
        return (t.note ?? '').toLowerCase().includes(s) || c.toLowerCase().includes(s)
      }
      return t.occurred_on.startsWith(month)
    })
  }, [txs, month, q, catById])

  const inc = monthTx.filter((t) => t.kind === 'revenu').reduce((a, t) => a + t.amount, 0)
  const exp = monthTx.filter((t) => t.kind === 'depense').reduce((a, t) => a + t.amount, 0)

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>()
    for (const t of monthTx) { if (!m.has(t.occurred_on)) m.set(t.occurred_on, []); m.get(t.occurred_on)!.push(t) }
    return [...m.entries()]
  }, [monthTx])

  return (
    <>
      <Header title={carnet?.name ?? 'Carnet'}
        right={<button aria-label="Rechercher" onClick={() => { setSearching(!searching); setQ('') }} className="rounded-full p-1.5 hover:bg-white/15">{searching ? <X size={20} /> : <Search size={20} />}</button>}>
        {searching ? (
          <div className="px-4 pb-3"><input autoFocus className="w-full rounded-xl bg-white/20 px-3 py-2 text-white placeholder-white/70 outline-none" placeholder="Rechercher (note, catégorie)…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        ) : <MonthBar />}
        <div className="grid grid-cols-3 gap-1 whitespace-nowrap px-3 pb-4 text-center text-[13px]">
          <div><p className="text-xs text-white/70">Revenus</p><p className="font-semibold">{fmt(inc, cur)}</p></div>
          <div><p className="text-xs text-white/70">Dépenses</p><p className="font-semibold">{fmt(exp, cur)}</p></div>
          <div><p className="text-xs text-white/70">Solde</p><p className="font-bold">{signed(inc - exp, cur)}</p></div>
        </div>
      </Header>

      <div className="space-y-4 p-4">
        {groups.length === 0 && <Empty icon="📒" text={q ? 'Aucun résultat.' : 'Aucune opération ce mois-ci. Appuie sur + pour en ajouter une.'} />}
        {groups.map(([day, list]) => {
          const net = list.reduce((a, t) => a + (t.kind === 'revenu' ? t.amount : -t.amount), 0)
          return (
            <section key={day}>
              <div className="mb-1.5 flex justify-between px-1 text-xs font-medium text-slate-500">
                <span>{dayLabel(day)}</span><span>{signed(net, cur)}</span>
              </div>
              <div className="card divide-y divide-slate-100">
                {list.map((t) => {
                  const c = t.category_id ? catById.get(t.category_id) : undefined
                  const a = t.account_id ? accById.get(t.account_id) : undefined
                  const m = t.member_id ? memById.get(t.member_id) : undefined
                  return (
                    <button key={t.id} onClick={() => onEdit(t)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-slate-50">
                      <IconBubble icon={c?.icon ?? '❔'} color={c?.color ?? '#64748b'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c?.name ?? 'Sans catégorie'}</p>
                        <p className="truncate text-xs text-slate-400">
                          {[a && `${a.icon} ${a.name}`, m?.name, t.note].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className={`shrink-0 font-semibold ${t.kind === 'revenu' ? 'text-green-600' : 'text-slate-800'}`}>
                        {t.kind === 'revenu' ? '+' : '−'}{fmt(t.amount, cur)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
