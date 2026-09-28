import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../lib/data'
import { addMonths, daysInMonth, fmt, monthShort, signed, todayISO } from '../lib/format'
import type { Kind } from '../lib/types'
import { Empty, Header, IconTile, MonthBar, Segmented } from '../components/ui'

type Tab = 'cat' | 'rd' | 'net'
const short = (n: number) => Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)

export default function GraphiquesScreen() {
  const [tab, setTab] = useState<Tab>('cat')
  const [kind, setKind] = useState<Kind>('depense')
  const { txs, month, catById, cur, accounts } = useData()

  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of txs) if (t.kind === kind && t.occurred_on.startsWith(month)) m.set(t.category_id ?? '', (m.get(t.category_id ?? '') ?? 0) + t.amount)
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    return {
      total,
      rows: [...m.entries()].map(([id, v]) => {
        const c = catById.get(id)
        return { id, name: c?.name ?? 'Sans catégorie', icon: c?.icon ?? '❔', color: c?.color ?? '#94a3b8', value: v, pct: total ? (v / total) * 100 : 0 }
      }).sort((a, b) => b.value - a.value),
    }
  }, [txs, month, kind, catById])

  const sixMonths = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const k = addMonths(month, i - 5)
    const l = txs.filter((t) => t.occurred_on.startsWith(k))
    const rev = l.filter((t) => t.kind === 'revenu').reduce((a, t) => a + t.amount, 0)
    const dep = l.filter((t) => t.kind === 'depense').reduce((a, t) => a + t.amount, 0)
    return { key: k, label: monthShort(k), Revenus: rev, Dépenses: dep, solde: rev - dep }
  }), [txs, month])

  const net = useMemo(() => {
    const start = accounts.reduce((a, x) => a + x.initial_balance, 0)
    const first = `${month}-01`
    let bal = start + txs.filter((t) => t.occurred_on < first).reduce((a, t) => a + (t.kind === 'revenu' ? t.amount : -t.amount), 0)
    const days = daysInMonth(month)
    const byDay = new Map<string, number>()
    for (const t of txs) if (t.occurred_on.startsWith(month)) byDay.set(t.occurred_on, (byDay.get(t.occurred_on) ?? 0) + (t.kind === 'revenu' ? t.amount : -t.amount))
    const points = []
    const rows: { day: string; delta: number; bal: number }[] = []
    const today = todayISO()
    for (let d = 1; d <= days; d++) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      if (iso > today && month >= today.slice(0, 7)) break
      const delta = byDay.get(iso) ?? 0
      bal += delta
      points.push({ label: String(d).padStart(2, '0'), Solde: bal })
      if (delta) rows.push({ day: iso, delta, bal })
    }
    return { points, rows: rows.reverse(), end: bal }
  }, [txs, month, accounts])

  return (
    <>
      <Header title="Graphiques" />
      <div className="space-y-3 px-5">
        <MonthBar />
        <div className="flex gap-2">
          {([['cat', 'Catégories'], ['rd', 'Évolution'], ['net', 'Valeur nette']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full border px-2 py-2 text-sm transition ${tab === k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {tab === 'cat' && (
          <>
            <Segmented value={kind} onChange={setKind} options={[['depense', 'Dépenses'], ['revenu', 'Revenus']]} />
            {byCat.rows.length === 0 ? <Empty icon="📊" text="Aucune donnée pour ce mois." /> : (
              <>
                <div className="tile relative p-2">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={byCat.rows} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {byCat.rows.map((r) => <Cell key={r.id} fill={r.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(Number(v), cur)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-neutral-400">Total</span>
                    <span className="text-lg font-bold">{fmt(byCat.total, cur)}</span>
                  </div>
                </div>
                <div className="card divide-y divide-neutral-100">
                  {byCat.rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <IconTile name={r.name} emoji={r.icon} color={r.color} size={40} />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm"><span className="font-medium">{r.name}</span><span className="font-semibold">{fmt(r.value, cur)}</span></div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} /></div>
                          <span className="w-11 text-right text-xs text-neutral-400">{r.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'rd' && (
          <>
            <div className="tile p-2 pt-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sixMonths} margin={{ left: -10, right: 6 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip formatter={(v) => fmt(Number(v), cur)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenus" fill="#10B981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Dépenses" fill="#141414" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card divide-y divide-neutral-100 text-sm">
              <div className="grid grid-cols-4 px-3 py-2 text-xs font-medium text-neutral-400"><span>Mois</span><span className="text-right">Revenus</span><span className="text-right">Dépenses</span><span className="text-right">Solde</span></div>
              {[...sixMonths].reverse().map((r) => (
                <div key={r.key} className="grid grid-cols-4 px-3 py-2.5">
                  <span className="font-medium capitalize">{r.label}</span>
                  <span className="text-right text-green-600">{short(r.Revenus)}</span>
                  <span className="text-right text-red-500">{short(r.Dépenses)}</span>
                  <span className={`text-right font-semibold ${r.solde < 0 ? 'text-red-600' : ''}`}>{short(r.solde)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'net' && (
          <>
            <div className="tile p-2 pt-4">
              <p className="px-2 text-xs text-neutral-400">Fin de période</p>
              <p className="mb-2 px-2 text-2xl font-bold">{fmt(net.end, cur)}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={net.points} margin={{ left: -10, right: 6 }}>
                  <defs><linearGradient id="gnet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6B800" stopOpacity={0.45} /><stop offset="1" stopColor="#E6B800" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={4} />
                  <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip formatter={(v) => fmt(Number(v), cur)} labelFormatter={(l) => `Jour ${l}`} />
                  <Area type="monotone" dataKey="Solde" stroke="#141414" strokeWidth={2} fill="url(#gnet)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {net.rows.length > 0 && (
              <div className="card divide-y divide-neutral-100 text-sm">
                <div className="grid grid-cols-3 px-3 py-2 text-xs font-medium text-neutral-400"><span>Date</span><span className="text-right">Variation</span><span className="text-right">Solde</span></div>
                {net.rows.map((r) => (
                  <div key={r.day} className="grid grid-cols-3 px-3 py-2.5">
                    <span>{r.day.slice(8)}/{r.day.slice(5, 7)}</span>
                    <span className={`text-right ${r.delta < 0 ? 'text-red-500' : 'text-green-600'}`}>{signed(r.delta, cur)}</span>
                    <span className="text-right font-semibold">{fmt(r.bal, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
