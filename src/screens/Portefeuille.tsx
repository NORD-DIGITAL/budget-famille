import { useMemo } from 'react'
import { useData } from '../lib/data'
import { fmt, monthLabel } from '../lib/format'
import { Header, IconBubble } from '../components/ui'

export default function PortefeuilleScreen({ onManage }: { onManage: (p: 'comptes' | 'membres') => void }) {
  const { accounts, members, txs, cur, month } = useData()

  const balances = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const a of accounts) m.set(a.id, a.initial_balance)
    for (const t of txs) {
      const k = t.account_id && m.has(t.account_id) ? t.account_id : null
      m.set(k, (m.get(k) ?? 0) + (t.kind === 'revenu' ? t.amount : -t.amount))
    }
    return m
  }, [accounts, txs])

  const total = [...balances.values()].reduce((a, b) => a + b, 0)
  const unassigned = balances.get(null) ?? 0

  const perMember = useMemo(() => members.filter((m) => !m.archived).map((m) => {
    const list = txs.filter((t) => t.member_id === m.id && t.occurred_on.startsWith(month))
    return {
      m,
      exp: list.filter((t) => t.kind === 'depense').reduce((a, t) => a + t.amount, 0),
      inc: list.filter((t) => t.kind === 'revenu').reduce((a, t) => a + t.amount, 0),
    }
  }), [members, txs, month])
  const maxExp = Math.max(1, ...perMember.map((x) => x.exp))

  return (
    <>
      <Header title="Portefeuille">
        <div className="px-4 pb-5 text-center">
          <p className="text-sm text-white/70">Valeur nette</p>
          <p className="text-3xl font-bold">{fmt(total, cur)}</p>
        </div>
      </Header>
      <div className="space-y-5 p-4">
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="font-semibold">Comptes</h2>
            <button onClick={() => onManage('comptes')} className="text-sm font-medium text-brand-600">Gérer</button>
          </div>
          <div className="card divide-y divide-slate-100">
            {accounts.filter((a) => !a.archived).map((a) => {
              const b = balances.get(a.id) ?? 0
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-3">
                  <IconBubble icon={a.icon} color="#8b5cf6" />
                  <span className="flex-1 font-medium">{a.name}</span>
                  <span className={`font-semibold ${b < 0 ? 'text-red-600' : ''}`}>{fmt(b, cur)}</span>
                </div>
              )
            })}
            {unassigned !== 0 && (
              <div className="flex items-center gap-3 px-3 py-3 text-slate-500">
                <IconBubble icon="❔" color="#64748b" />
                <span className="flex-1">Sans compte</span>
                <span className="font-semibold">{fmt(unassigned, cur)}</span>
              </div>
            )}
          </div>
          <p className="mt-2 px-1 text-xs text-slate-400">Astuce : indique le solde de départ de chaque compte dans « Gérer ».</p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="font-semibold">Membres · {monthLabel(month)}</h2>
            <button onClick={() => onManage('membres')} className="text-sm font-medium text-brand-600">Gérer</button>
          </div>
          <div className="card divide-y divide-slate-100">
            {perMember.map(({ m, exp, inc }) => (
              <div key={m.id} className="px-3 py-3">
                <div className="mb-1.5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</div>
                  <span className="flex-1 font-medium">{m.name}</span>
                  <div className="text-right text-sm">
                    <p className="font-semibold">−{fmt(exp, cur)}</p>
                    {inc > 0 && <p className="text-xs text-green-600">+{fmt(inc, cur)}</p>}
                  </div>
                </div>
                <div className="ml-12 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(exp / maxExp) * 100}%`, background: m.color }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
