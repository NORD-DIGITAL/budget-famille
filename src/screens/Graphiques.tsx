import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../lib/data'
import { addMonths, daysInMonth, fmt, monthShort, signed, todayISO } from '../lib/format'
import type { Kind } from '../lib/types'
import { BareIcon, Empty, Header, IconTile, Segmented, Progress } from '../components/ui'
import { MonthBar } from '../components/DatePicker'

type Tab = 'global' | 'cat' | 'rd' | 'net'
const short = (n: number) => Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)

export default function GraphiquesScreen() {
  const [tab, setTab] = useState<Tab>('global')
  const [kind, setKind] = useState<Kind>('depense')
  const { txs, month, catById, cur, accounts, rootOf, goals, debts } = useData()
  const [open, setOpen] = useState<string | null>(null)

  const rollup = useMemo(() => (k: Kind) => {
    const m = new Map<string, { value: number; subs: Map<string, number> }>()
    for (const t of txs) {
      if (t.kind !== k || !t.occurred_on.startsWith(month)) continue
      const root = rootOf(t.category_id)
      const rk = root?.id ?? ''
      // sous-catégorie directe de la racine sur le chemin
      let sub = t.category_id ? catById.get(t.category_id) : undefined
      while (sub?.parent_id && sub.parent_id !== rk) sub = catById.get(sub.parent_id)
      const sk = sub && sub.id !== rk ? sub.id : rk
      if (!m.has(rk)) m.set(rk, { value: 0, subs: new Map() })
      const e = m.get(rk)!
      e.value += t.amount
      e.subs.set(sk, (e.subs.get(sk) ?? 0) + t.amount)
    }
    const total = [...m.values()].reduce((a, b) => a + b.value, 0)
    return {
      total,
      rows: [...m.entries()].map(([id, e]) => {
        const c = catById.get(id)
        return {
          id, name: c?.name ?? 'Sans catégorie', icon: c?.icon ?? '❔', color: c?.color ?? '#94a3b8', value: e.value, pct: total ? (e.value / total) * 100 : 0,
          subs: [...e.subs.entries()].map(([sid, v]) => ({ id: sid, name: sid === id ? `${c?.name ?? ''} (général)` : catById.get(sid)?.name ?? '?', icon: catById.get(sid)?.icon, value: v })).sort((a, b) => b.value - a.value),
        }
      }).sort((a, b) => b.value - a.value),
    }
  }, [txs, month, catById, rootOf])
  const byCat = useMemo(() => rollup(kind), [rollup, kind])
  const depAll = useMemo(() => rollup('depense'), [rollup])
  const revAll = useMemo(() => rollup('revenu'), [rollup])

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
      <div className="space-y-3 px-5 lg:mx-auto lg:max-w-4xl">
        <MonthBar />
        <div className="flex gap-2">
          {([['global', 'Global'], ['cat', 'Catégories'], ['rd', 'Évolution'], ['net', 'Valeur nette']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-full border px-1 py-2 text-[13px] transition ${tab === k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4 lg:mx-auto lg:max-w-4xl">
        {tab === 'global' && (() => {
          const inc = revAll.total, exp = depAll.total, sol = inc - exp
          const rate = inc > 0 ? Math.round((sol / inc) * 100) : null
          const max = Math.max(inc, exp, 1)
          const monthTx = txs.filter((t) => t.occurred_on.startsWith(month))
          const biggest = monthTx.filter((t) => t.kind === 'depense').sort((a, b) => b.amount - a.amount).slice(0, 5)
          const kids = new Map<string, number>()
          for (const t of monthTx) if (t.kind === 'depense' && t.child_name) {
            const names = t.child_name.split(', ')
            for (const n of names) kids.set(n, (kids.get(n) ?? 0) + Math.round(t.amount / names.length))
          }
          const saved = goals.reduce((a, g) => a + g.saved_amount, 0), target = goals.reduce((a, g) => a + g.target_amount, 0)
          const owe = debts.filter((d) => d.direction === 'je_dois').reduce((a, d) => a + Math.max(0, d.amount - d.paid), 0)
          const owed = debts.filter((d) => d.direction === 'on_me_doit').reduce((a, d) => a + Math.max(0, d.amount - d.paid), 0)
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Revenus</p><p className="tabular text-lg font-semibold">{fmt(inc, cur)}</p></div>
                <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs text-red-700">Dépenses</p><p className="tabular text-lg font-semibold">{fmt(exp, cur)}</p></div>
                <div className="rounded-2xl bg-sun-100 p-4"><p className="text-xs">Solde du mois</p><p className={`tabular text-lg font-semibold ${sol < 0 ? 'text-red-600' : ''}`}>{signed(sol, cur)}</p></div>
                <div className="rounded-2xl bg-cream-tile p-4"><p className="text-xs text-ink-muted">Part épargnée</p><p className="tabular text-lg font-semibold">{rate == null ? '—' : `${rate} %`}</p></div>
              </div>

              <section className="tile space-y-3 p-4">
                <h3 className="font-semibold">Revenus et dépenses</h3>
                {[['Revenus', inc, '#10B981'], ['Dépenses', exp, '#141414']].map(([l, v, c]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="tabular font-medium">{fmt(v as number, cur)}</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full" style={{ width: `${((v as number) / max) * 100}%`, background: c as string }} /></div>
                  </div>
                ))}
              </section>

              {depAll.rows.length > 0 && (
                <section className="tile p-4">
                  <h3 className="mb-1 font-semibold">Où va l'argent</h3>
                  <div className="flex items-center gap-2">
                    <div className="h-[150px] w-[150px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={depAll.rows} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                            {depAll.rows.map((r) => <Cell key={r.id} fill={r.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                      {depAll.rows.slice(0, 5).map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          <span className="tabular text-ink-muted">{Math.round(r.pct)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {revAll.rows.length > 0 && (
                <section className="tile p-4">
                  <h3 className="mb-2 font-semibold">D'où vient l'argent</h3>
                  {revAll.rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-1 text-sm"><span className="flex items-center gap-2"><BareIcon name={r.name} emoji={r.icon} size={18} />{r.name}</span><span className="tabular font-medium">{fmt(r.value, cur)}</span></div>
                  ))}
                </section>
              )}

              <section className="grid grid-cols-2 gap-3">
                <div className="tile p-4">
                  <p className="text-xs text-ink-muted">Épargne cumulée</p>
                  <p className="tabular font-semibold">{fmt(saved, cur)}</p>
                  {target > 0 && <div className="mt-2"><Progress value={saved} max={target} /></div>}
                </div>
                <div className="tile p-4">
                  <p className="text-xs text-ink-muted">Dettes restantes</p>
                  <p className="tabular font-semibold text-red-600">{fmt(owe, cur)}</p>
                  {owed > 0 && <p className="tabular mt-1 text-xs text-emerald-700">On me doit {fmt(owed, cur)}</p>}
                </div>
              </section>

              {kids.size > 0 && (
                <section className="tile p-4">
                  <h3 className="mb-2 font-semibold">Dépenses par enfant</h3>
                  {[...kids.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                    <div key={n} className="flex justify-between py-1 text-sm"><span>{n}</span><span className="tabular font-medium">{fmt(v, cur)}</span></div>
                  ))}
                </section>
              )}

              {biggest.length > 0 && (
                <section>
                  <h3 className="mb-1 font-semibold">Plus grosses dépenses</h3>
                  {biggest.map((t) => {
                    const c = t.category_id ? catById.get(t.category_id) : undefined
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0">
                        <IconTile name={c?.name ?? ''} emoji={c?.icon} size={36} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c?.name ?? 'Sans catégorie'}</p><p className="truncate text-xs text-ink-muted">{t.occurred_on.slice(8)}/{t.occurred_on.slice(5, 7)}{t.note ? ` · ${t.note}` : ''}</p></div>
                        <span className="tabular text-sm font-semibold">{fmt(t.amount, cur)}</span>
                      </div>
                    )
                  })}
                </section>
              )}
              {inc === 0 && exp === 0 && <Empty icon="📊" text="Aucune opération ce mois-ci." />}
            </>
          )
        })()}

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
                    <div key={r.id}>
                      <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                        <IconTile name={r.name} emoji={r.icon} color={r.color} size={40} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm"><span className="font-medium">{r.name}{r.subs.length > 1 ? <span className="ml-1 text-ink-muted">{open === r.id ? '▾' : '▸'}</span> : null}</span><span className="tabular font-semibold">{fmt(r.value, cur)}</span></div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} /></div>
                            <span className="w-11 text-right text-xs text-neutral-400">{r.pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </button>
                      {open === r.id && r.subs.length > 1 && (
                        <div className="mb-2 ml-[64px] mr-3 space-y-1.5 border-l-2 border-sun-300 pl-3">
                          {r.subs.map((x) => (
                            <div key={x.id} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2"><BareIcon name={x.name} emoji={x.icon} size={18} />{x.name}</span>
                              <span className="tabular">{fmt(x.value, cur)}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
