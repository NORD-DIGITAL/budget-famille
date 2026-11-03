import { openAccHistory, openMemHistory } from '../components/TxDetail'
import { ChevronRight, Plus } from 'lucide-react'
import { openAddMoney } from '../components/AddMoney'
import { useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt, monthLabel } from '../lib/format'
import { useHidden } from '../lib/prefs'
import { Header, IconTile } from '../components/ui'
import { LOW } from './Carnet'

export default function PortefeuilleScreen({ onManage, onBack }: { onManage: (p: 'comptes' | 'membres') => void; onBack?: () => void }) {
  const { accounts, members, txs, cur, month, carnet, ledger } = useData()
  const [hidden, toggleHidden] = useHidden()
  const mask = (s: string) => (hidden ? '••••••' : s)

  const balances = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const a of accounts) m.set(a.id, a.initial_balance)
    for (const e of ledger) for (const l of e.legs) {
      const k = l.account_id && m.has(l.account_id) ? l.account_id : null
      m.set(k, (m.get(k) ?? 0) + l.amount)
    }
    return m
  }, [accounts, ledger])
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
      <Header title="Portefeuille" onBack={onBack} />
      <div className="space-y-7 px-5 pb-6 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:space-y-0 lg:gap-y-8 lg:px-8">
        {/* Carte valeur nette */}
        <div className={`relative overflow-hidden rounded-[28px] p-6 lg:col-span-2 transition-colors ${total < LOW ? 'bg-red-500 text-white' : 'bg-sun-500'}`}>
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border-[18px] border-white/25" />
          <div className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/15" />
          <p className="relative text-sm font-medium">{carnet?.name}</p>
          <p className="relative mt-6 text-sm">Valeur nette{total < LOW ? ' · solde bas' : ''}</p>
          <div className="relative flex items-center gap-3">
            <p className="tabular text-[2rem] font-semibold tracking-tight">{mask(fmt(total, ''))}<span className="ml-1.5 text-xl">{cur}</span></p>
            <button onClick={toggleHidden} aria-label={hidden ? 'Afficher les montants' : 'Masquer les montants'} className="rounded-full p-1.5 hover:bg-white/30">
              {hidden ? <Eye size={22} strokeWidth={1.8} /> : <EyeOff size={22} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">Comptes</h2>
            <button onClick={() => onManage('comptes')} className="pill">Gérer</button>
          </div>
          <div>
            {accounts.filter((a) => !a.archived).map((a) => {
              const b = balances.get(a.id) ?? 0
              return (
                <div key={a.id} className="flex items-center gap-2 border-b border-neutral-100 last:border-0">
                  <button onClick={() => openAccHistory(a.id)} className="flex min-w-0 flex-1 items-center gap-4 py-3.5 text-left">
                    <IconTile name={a.name} emoji={a.icon} />
                    <span className="min-w-0 flex-1 truncate text-[1.0625rem]">{a.name}</span>
                    <span className={`tabular font-semibold ${!hidden && b < 0 ? 'text-red-600' : !hidden && b < LOW ? 'text-orange-500' : ''}`}>{mask(fmt(b, cur))}</span>
                    <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                  </button>
                  <button onClick={() => openAddMoney(a.id)} aria-label={`Ajouter sur ${a.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white"><Plus size={18} /></button>
                </div>
              )
            })}
            {unassigned !== 0 && (
              <div className="flex items-center gap-4 py-3.5 text-ink-muted">
                <IconTile name="" emoji="❔" />
                <span className="flex-1">Sans compte</span>
                <span className="tabular font-semibold">{mask(fmt(unassigned, cur))}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-muted">« + » : ajoute de l'argent sur un compte en choisissant d'où il vient (un autre compte ou un revenu). Le solde de départ de chaque compte se règle dans « Gérer ».</p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Membres <span className="text-sm font-normal text-ink-muted">· {monthLabel(month)}</span></h2>
            <button onClick={() => onManage('membres')} className="pill">Gérer</button>
          </div>
          <div className="space-y-4">
            {perMember.map(({ m, exp, inc }) => (
              <button key={m.id} onClick={() => openMemHistory(m.id)} className="flex w-full items-center gap-4 text-left">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white">{m.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{m.name}</span>
                    <span className="tabular font-semibold">{mask('−' + fmt(exp, cur))}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-sun-500" style={{ width: `${(exp / maxExp) * 100}%` }} /></div>
                    {inc > 0 && <span className="tabular text-xs text-emerald-600">{mask('+' + fmt(inc, cur))}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
