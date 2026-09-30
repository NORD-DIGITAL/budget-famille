import { useMemo, useState } from 'react'
import { ShoppingCart, BellRing, RefreshCw, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, MoreVertical, PieChart, PiggyBank, Search, Target, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useData } from '../lib/data'
import { dayLabel, fmt, signed } from '../lib/format'
import { useHidden, userInfo } from '../lib/prefs'
import type { Kind, Tx } from '../lib/types'
import { ByNord, Empty, IconTile } from '../components/ui'
import { CarnetSwitcher } from '../components/Carnets'
import { dueReminders } from '../lib/reminders'
import { AccueilAside } from './AccueilAside'
import { MonthBar, fmtMonthLong } from '../components/DatePicker'
import type { SubPage } from './Plus'

export const LOW = 20000

export type Shortcut = { label: string; Icon: LucideIcon; run: () => void }

export default function AccueilScreen({ onEdit, onAdd, openSub, goCharts, openAll, goAccount, onRefresh }: {
  onRefresh: () => Promise<void>; onEdit: (t: Tx) => void; onAdd: (k: Kind) => void; openSub: (p: SubPage) => void; goCharts: () => void; openAll: () => void; goAccount: () => void
}) {
  const { txs, month, catById, accById, memById, cur, session, profile, catPath, goals, moves } = useData()
  const due = dueReminders(goals, moves)
  const [hidden, toggleHidden] = useHidden()
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const me = userInfo(session, profile)

  const monthTx = useMemo(() => txs.filter((t) => t.occurred_on.startsWith(month)), [txs, month])
  const inc = monthTx.filter((t) => t.kind === 'revenu').reduce((a, t) => a + t.amount, 0)
  const exp = monthTx.filter((t) => t.kind === 'depense').reduce((a, t) => a + t.amount, 0)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return monthTx
    return txs.filter((t) => {
      const c = catPath(t.category_id) + ' ' + (t.child_name ?? '')
      return (t.note ?? '').toLowerCase().includes(s) || c.toLowerCase().includes(s)
    })
  }, [txs, monthTx, q, catPath])

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>()
    for (const t of list) { if (!m.has(t.occurred_on)) m.set(t.occurred_on, []); m.get(t.occurred_on)!.push(t) }
    return [...m.entries()]
  }, [list])

  const mask = (n: string) => (hidden ? '••••••' : n)

  const shortcuts: Shortcut[] = [
    { label: 'Dépense', Icon: ArrowUpRight, run: () => onAdd('depense') },
    { label: 'Revenu', Icon: ArrowDownLeft, run: () => onAdd('revenu') },
    { label: 'Budget', Icon: Target, run: () => openSub('budget') },
    { label: 'Épargne', Icon: PiggyBank, run: () => openSub('objectifs') },
    { label: 'Courses', Icon: ShoppingCart, run: () => openSub('courses') },
    { label: 'Membres', Icon: Users, run: () => openSub('membres') },
    { label: 'Graphiques', Icon: PieChart, run: goCharts },
    { label: 'Voir tout', Icon: MoreVertical, run: openAll },
  ]

  return (
    <div className="bg-white lg:grid lg:grid-cols-[400px_1fr] lg:items-start lg:gap-2 lg:p-4 xl:grid-cols-[440px_1fr] 2xl:grid-cols-[440px_1fr_380px] 2xl:gap-4">
      <div className="hero pb-8 lg:sticky lg:top-4 lg:overflow-hidden lg:rounded-[28px] lg:pb-2">
      {/* En-tête : salutation */}
      <header className="pt-safe px-5">
        <div className="flex items-center gap-3 py-4">
          <button onClick={goAccount} aria-label="Mon compte" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-base font-semibold text-white">{me.initials}</button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="hero-muted text-sm">Bonjour</p>
            <p className="truncate text-[1.0625rem] font-medium">{me.name}</p>
            {me.phone && <p className="hero-muted tabular text-sm">{me.phone}</p>}
          </div>
          <button aria-label="Actualiser" onClick={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false) }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/25">
            <RefreshCw size={22} strokeWidth={1.8} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button aria-label={searching ? 'Fermer la recherche' : 'Rechercher'} onClick={() => { setSearching(!searching); setQ('') }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/25">
            {searching ? <X size={24} strokeWidth={1.8} /> : <Search size={24} strokeWidth={1.8} />}
          </button>
        </div>
        <div className="-mt-2 mb-2 flex justify-center"><CarnetSwitcher variant="chip" /></div>
        {searching && (
          <div className="mb-4 flex items-center gap-3 rounded-full border border-cream-line bg-white px-5 py-3 text-ink">
            <Search size={20} strokeWidth={1.8} className="text-ink-muted" />
            <input autoFocus className="w-full bg-transparent outline-none" placeholder="Rechercher (note, catégorie)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </header>

      {!searching && (
        <>
          {/* Solde du mois */}
          <section className="px-5 pb-2 pt-2 text-center">
            <p className="text-lg font-semibold">Solde <span className="hero-muted font-normal">du mois</span></p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <p className={`tabular text-[2.125rem] font-semibold tracking-tight ${!hidden && inc - exp < LOW ? 'low-balance' : ''}`}>{hidden ? '••••••' : signed(inc - exp, '')}<span className="ml-2 text-2xl">{cur}</span></p>
              <button onClick={toggleHidden} aria-label={hidden ? 'Afficher les montants' : 'Masquer les montants'} className="rounded-full p-1.5 hover:bg-white/25">
                {hidden ? <Eye size={24} strokeWidth={1.8} /> : <EyeOff size={24} strokeWidth={1.8} />}
              </button>
            </div>
            {!hidden && inc - exp < LOW && <p className="mx-auto mt-1 w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">Solde bas : moins de {fmt(LOW, cur)}</p>}
            <div className="mx-auto mt-4 max-w-xs text-ink"><MonthBar /></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-ink">
              <div className="rounded-2xl bg-white px-4 py-3 text-left">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="h-2 w-2 rounded-full bg-emerald-500" />Revenus</p>
                <p className="tabular mt-0.5 font-semibold">{mask(fmt(inc, cur))}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-left">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="h-2 w-2 rounded-full bg-red-500" />Dépenses</p>
                <p className="tabular mt-0.5 font-semibold">{mask(fmt(exp, cur))}</p>
              </div>
            </div>
          </section>

          {/* Raccourcis */}
          {due.length > 0 && (
            <button onClick={() => openSub('objectifs')} className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl border border-sun-300 bg-white px-4 py-3 text-left text-ink">
              <BellRing size={22} className="shrink-0 text-sun-600" />
              <span className="min-w-0 flex-1 text-sm"><b>Épargne du mois à faire</b><br /><span className="text-ink-muted">{due.map((g) => `${g.name} (le ${g.monthly_day}${g.monthly_amount ? `, ${fmt(g.monthly_amount, cur)}` : ''})`).join(' · ')}</span></span>
            </button>
          )}
          <section className="grid grid-cols-4 gap-y-5 px-3 pb-6 pt-6">
            {shortcuts.map(({ label, Icon, run }) => (
              <button key={label} onClick={run} className="flex flex-col items-center gap-2 text-center">
                <Icon size={30} strokeWidth={1.5} />
                <span className="text-[0.8125rem] leading-tight">{label}</span>
              </button>
            ))}
          </section>
          <ByNord onHero className="pb-4" />
        </>
      )}
      </div>

      {/* Opérations */}
      <section className="relative -mt-6 min-h-[40vh] rounded-t-[28px] bg-white px-5 pb-6 pt-6 lg:mt-0 lg:px-8 lg:pt-4">
        <h2 className="section-title mb-3">{q ? 'Résultats' : 'Opérations du mois'}</h2>
        {groups.length === 0 && <Empty icon="📒" text={q ? 'Aucun résultat.' : 'Aucune opération ce mois-ci. Touche le bouton jaune pour en ajouter une.'} />}
        <div className="space-y-5">
          {groups.map(([day, items]) => {
            const net = items.reduce((a, t) => a + (t.kind === 'revenu' ? t.amount : -t.amount), 0)
            return (
              <div key={day}>
                <div className="mb-1 flex justify-between text-xs text-ink-muted">
                  <span>{dayLabel(day)}</span><span className="tabular">{mask(signed(net, cur))}</span>
                </div>
                {items.map((t) => {
                  const c = t.category_id ? catById.get(t.category_id) : undefined
                  const a = t.account_id ? accById.get(t.account_id) : undefined
                  const m = t.member_id ? memById.get(t.member_id) : undefined
                  return (
                    <button key={t.id} onClick={() => onEdit(t)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
                      <IconTile name={c?.name ?? ''} emoji={c?.icon} color={c?.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c?.name ?? 'Sans catégorie'}</p>
                        <p className="truncate text-xs text-ink-muted">{[
                          c?.parent_id ? catById.get(c.parent_id)?.name : null,
                          t.quantity ? `${String(t.quantity).replace('.', ',')} ${t.unit ?? ''}` : null,
                          t.for_month ? `mois : ${fmtMonthLong(t.for_month)}` : null,
                          t.child_name, t.beneficiary, a?.name, t.ref ? `Réf. ${t.ref}` : null, m?.name, t.note,
                        ].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className={`tabular shrink-0 font-semibold ${t.kind === 'revenu' ? 'text-emerald-600' : ''}`}>
                        {hidden ? '••••' : `${t.kind === 'revenu' ? '+' : '−'}${fmt(t.amount, cur)}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>
      <AccueilAside openSub={openSub} goCharts={goCharts} />
    </div>
  )
}
