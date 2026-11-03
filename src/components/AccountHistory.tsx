import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useData } from '../lib/data'
import { dayLabel, fmt, signed } from '../lib/format'
import { effectOn } from '../lib/ledger'
import { useHidden } from '../lib/prefs'
import { fmtMonthLong } from './DatePicker'
import { LedgerRow } from './LedgerRow'
import { openAddMoney } from './AddMoney'
import { Segmented, Sheet } from './ui'
import { openTx } from './TxDetail'

/** Historique d'un compte : opérations, épargne, dettes, transferts (entrées et sorties) et investissements. */
export function AccountHistorySheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { ledger, accById, accounts, month, cur } = useData()
  const [hidden] = useHidden()
  const [all, setAll] = useState<'mois' | 'tout'>('mois')
  const acc = id ? accById.get(id) : undefined
  const list = useMemo(() => ledger.filter((e) => id && e.legs.some((l) => l.account_id === id) && (all === 'tout' || e.date.startsWith(month))), [ledger, id, all, month])
  const ins = list.reduce((a, e) => a + Math.max(0, effectOn(e, id)), 0)
  const outs = list.reduce((a, e) => a + Math.min(0, effectOn(e, id)), 0)
  const balance = useMemo(() => {
    const a = accounts.find((x) => x.id === id)
    return (a?.initial_balance ?? 0) + ledger.reduce((s, e) => s + effectOn(e, id), 0)
  }, [accounts, ledger, id])
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const e of list) { const k = all === 'tout' ? e.date.slice(0, 7) : e.date; if (!m.has(k)) m.set(k, []); m.get(k)!.push(e) }
    return [...m.entries()]
  }, [list, all])
  const mask = (s: string) => (hidden ? '••••••' : s)

  return (
    <Sheet open={!!id} onClose={() => { setAll('mois'); onClose() }} title={`Compte ${acc?.name ?? ''}`}>
      {id && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-ink p-5 text-white">
            <p className="text-sm text-white/70">Solde actuel</p>
            <p className="tabular text-3xl font-semibold">{mask(fmt(balance, cur))}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs text-white/60">Entrées {all === 'mois' ? 'du mois' : ''}</p><p className="tabular font-semibold text-emerald-300">{mask('+' + fmt(ins, cur))}</p></div>
              <div><p className="text-xs text-white/60">Sorties {all === 'mois' ? 'du mois' : ''}</p><p className="tabular font-semibold text-red-300">{mask('−' + fmt(-outs, cur))}</p></div>
            </div>
          </div>
          <button onClick={() => openAddMoney(id)} className="btn-primary w-full"><Plus size={18} /> Ajouter sur {acc?.name}</button>
          <Segmented value={all} onChange={setAll} options={[['mois', fmtMonthLong(month)], ['tout', "Tout l'historique"]]} />
          {list.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Aucun mouvement.</p>}
          {groups.map(([k, items]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>{all === 'tout' ? fmtMonthLong(k) : dayLabel(k)}</span>
                <span className="tabular">{mask(signed(items.reduce((a, e) => a + effectOn(e, id), 0), cur))}</span>
              </div>
              {items.map((e) => <LedgerRow key={e.key} e={e} hidden={hidden} amount={effectOn(e, id)} onClick={e.tx ? () => openTx(e.tx!) : undefined} />)}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
