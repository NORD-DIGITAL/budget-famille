import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useData } from '../lib/data'
import { dayLabel, fmt, signed } from '../lib/format'
import { effect, effectOn, SOURCE_LABEL } from '../lib/ledger'
import type { Entry, EntrySource } from '../lib/ledger'
import { useHidden } from '../lib/prefs'
import { MonthBar, fmtMonthLong } from '../components/DatePicker'
import { LedgerRow, openEntry } from '../components/LedgerRow'
import { Empty, Segmented } from '../components/ui'
import type { SubPage } from './Plus'

type Filter = 'tout' | EntrySource
const FILTERS: [Filter, string][] = [
  ['tout', 'Tout'], ['operation', 'Opérations'], ['epargne', 'Épargne'], ['dette', 'Dettes'], ['transfert', 'Transferts'], ['investissement', 'Investissements'], ['projet', 'Projets'],
]
const dec = (iso: string) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

/** Journal électronique : tous les mouvements d'argent du carnet, par mois ou par année. */
export function JournalPage({ openSub }: { openSub: (p: SubPage) => void }) {
  const { ledger, month, accounts, cur, balanceAt } = useData()
  const [hidden, toggleHidden] = useHidden()
  const [period, setPeriod] = useState<'mois' | 'annee'>('mois')
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const [filter, setFilter] = useState<Filter>('tout')
  const [acc, setAcc] = useState('')
  const mask = (s: string) => (hidden ? '••••••' : s)

  const prefix = period === 'mois' ? month : String(year)
  const first = period === 'mois' ? `${month}-01` : `${year}-01-01`
  const last = period === 'mois' ? `${month}-31` : `${year}-12-31`
  const amountOf = (e: Entry) => (acc ? effectOn(e, acc) : effect(e))

  const list = useMemo(() => ledger.filter((e) => e.date.startsWith(prefix) && (filter === 'tout' || e.source === filter) && (!acc || e.legs.some((l) => l.account_id === acc))),
    [ledger, prefix, filter, acc])
  const ins = list.reduce((a, e) => a + Math.max(0, amountOf(e)), 0)
  const outs = list.reduce((a, e) => a + Math.min(0, amountOf(e)), 0)
  // Soldes de début et de fin de période (tout le carnet, ou le compte choisi)
  const accStart = (iso: string) => {
    if (!acc) return balanceAt(iso)
    const a = accounts.find((x) => x.id === acc)
    return (a?.initial_balance ?? 0) + ledger.filter((e) => e.date <= iso).reduce((s, e) => s + effectOn(e, acc), 0)
  }
  const start = accStart(dec(first))
  const end = accStart(last)

  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of list) { const k = period === 'mois' ? e.date : e.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e) }
    return [...m.entries()]
  }, [list, period])

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <Segmented value={period} onChange={setPeriod} options={[['mois', 'Par mois'], ['annee', 'Par année']]} />
      {period === 'mois' ? <MonthBar /> : (
        <div className="flex items-center justify-between rounded-full border border-cream-line bg-cream-tile p-1">
          <button aria-label="Année précédente" onClick={() => setYear(year - 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronLeft size={20} /></button>
          <span className="text-sm font-medium">Année {year}</span>
          <button aria-label="Année suivante" onClick={() => setYear(year + 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronRight size={20} /></button>
        </div>
      )}

      <div className="rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/70">{acc ? accounts.find((a) => a.id === acc)?.name : 'Tous les comptes'} · {period === 'mois' ? fmtMonthLong(month) : year}</p>
          <button onClick={toggleHidden} aria-label={hidden ? 'Afficher les montants' : 'Masquer les montants'} className="rounded-full p-1 hover:bg-white/10">{hidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-white/60">Solde au début</p><p className="tabular font-semibold">{mask(fmt(start, cur))}</p></div>
          <div><p className="text-xs text-white/60">Solde à la fin</p><p className="tabular font-semibold">{mask(fmt(end, cur))}</p></div>
          <div><p className="text-xs text-white/60">Entrées</p><p className="tabular font-semibold text-emerald-300">{mask('+' + fmt(ins, cur))}</p></div>
          <div><p className="text-xs text-white/60">Sorties</p><p className="tabular font-semibold text-red-300">{mask('−' + fmt(-outs, cur))}</p></div>
        </div>
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${filter === k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{l}</button>
        ))}
      </div>
      <select aria-label="Compte" className="input py-2.5 text-sm" value={acc} onChange={(e) => setAcc(e.target.value)}>
        <option value="">Tous les comptes</option>{accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <p className="text-xs text-ink-muted">{list.length} mouvement{list.length > 1 ? 's' : ''}{filter === 'tout' ? '' : ` · ${SOURCE_LABEL[filter as EntrySource]}`}. Les transferts entre comptes et les mouvements internes d'un projet ne changent pas le solde total.</p>
      {list.length === 0 && <Empty icon="📒" text="Aucun mouvement pour cette période." />}
      <div className="space-y-5">
        {groups.map(([k, items]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-xs text-ink-muted">
              <span className={period === 'annee' ? 'text-sm font-semibold text-ink' : ''}>{period === 'mois' ? dayLabel(k) : fmtMonthLong(k)}</span>
              <span className="tabular">{mask(signed(items.reduce((a, e) => a + amountOf(e), 0), cur))}</span>
            </div>
            {items.map((e) => <LedgerRow key={e.key} e={e} hidden={hidden} amount={acc ? effectOn(e, acc) : undefined} onClick={() => openEntry(e, openSub)} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
