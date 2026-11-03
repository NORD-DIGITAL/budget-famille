import { ArrowLeftRight, Briefcase, HandCoins, PiggyBank, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import type { Entry, EntrySource } from '../lib/ledger'
import type { SubPage } from '../screens/Plus'
import { IconTile } from './ui'
import { openAccHistory, openTx } from './TxDetail'
import { openProject } from '../lib/invest'

const ICON: Record<Exclude<EntrySource, 'operation'>, LucideIcon> = {
  epargne: PiggyBank, dette: HandCoins, transfert: ArrowLeftRight, investissement: TrendingUp, projet: Briefcase,
}

/** Ouvre ce qui correspond à un mouvement du grand livre. */
export function openEntry(e: Entry, openSub: (p: SubPage) => void) {
  if (e.tx) return openTx(e.tx)
  if (e.source === 'epargne') return openSub('objectifs')
  if (e.source === 'dette') return openSub('dettes')
  if (e.source === 'transfert') return e.legs[0]?.account_id ? openAccHistory(e.legs[0].account_id) : undefined
  if (e.projectId) { openProject(e.projectId); return openSub('projet') }
}

/** Ligne d'un mouvement hors opération (épargne, dette, transfert, investissement, projet). */
export function LedgerRow({ e, hidden, onClick, amount }: { e: Entry; hidden: boolean; onClick?: () => void; amount?: number }) {
  const { cur, catById, accById, memById } = useData()
  const a = amount ?? e.shown
  const neutral = amount === undefined && (e.source === 'transfert' || e.source === 'projet')
  const t = e.tx
  const c = t?.category_id ? catById.get(t.category_id) : undefined
  const Icon = e.source === 'operation' ? TrendingUp : ICON[e.source]
  const title = t ? c?.name ?? 'Sans catégorie' : e.title
  const detail = t ? [c?.parent_id ? catById.get(c.parent_id)?.name : null, t.account_id ? accById.get(t.account_id)?.name : null, t.member_id ? memById.get(t.member_id)?.name : null, t.note].filter(Boolean).join(' · ') : e.detail
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-0">
      {t ? <IconTile name={c?.name ?? ''} emoji={c?.icon} color={c?.color} /> : <IconTile name="" icon={<Icon size={20} strokeWidth={1.8} />} />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {detail && <p className="truncate text-xs text-ink-muted">{detail}</p>}
      </div>
      <span className={`tabular shrink-0 font-semibold ${neutral ? 'text-ink-muted' : a > 0 ? 'text-emerald-600' : ''}`}>
        {hidden ? '••••' : neutral ? fmt(Math.abs(a), cur) : `${a > 0 ? '+' : '−'}${fmt(Math.abs(a), cur)}`}
      </span>
    </button>
  )
}
