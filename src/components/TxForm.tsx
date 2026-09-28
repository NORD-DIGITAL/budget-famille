import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { parseAmount, todayISO } from '../lib/format'
import type { Kind, Tx } from '../lib/types'
import { Sheet } from './ui'

export default function TxForm({ open, onClose, tx }: { open: boolean; onClose: () => void; tx: Tx | null }) {
  const { carnet, categories, accounts, members, reload, cur } = useData()
  const [kind, setKind] = useState<Kind>('depense')
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState<string | null>(null)
  const [accId, setAccId] = useState<string | null>(null)
  const [memId, setMemId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const activeAcc = accounts.filter((a) => !a.archived)
  const activeMem = members.filter((m) => !m.archived)

  useEffect(() => {
    if (!open) return
    setErr('')
    if (tx) {
      setKind(tx.kind); setAmount(tx.amount.toLocaleString('fr-FR')); setCatId(tx.category_id)
      setAccId(tx.account_id); setMemId(tx.member_id); setDate(tx.occurred_on); setNote(tx.note ?? '')
    } else {
      setKind('depense'); setAmount(''); setCatId(null)
      setAccId(activeAcc[0]?.id ?? null); setMemId(activeMem[0]?.id ?? null); setDate(todayISO()); setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx])

  const cats = categories.filter((c) => c.kind === kind && (!c.archived || c.id === catId))

  const save = async () => {
    const amt = parseAmount(amount)
    if (!amt) return setErr('Indique un montant.')
    if (!catId) return setErr('Choisis une catégorie.')
    setBusy(true)
    const row = { carnet_id: carnet!.id, kind, amount: amt, category_id: catId, account_id: accId, member_id: memId, occurred_on: date, note: note.trim() || null }
    const { error } = tx
      ? await supabase.from('transactions').update(row).eq('id', tx.id)
      : await supabase.from('transactions').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }

  const remove = async () => {
    if (!tx || !confirm('Supprimer cette opération ?')) return
    setBusy(true)
    await supabase.from('transactions').delete().eq('id', tx.id)
    setBusy(false); await reload(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={tx ? "Modifier l'opération" : 'Nouvelle opération'}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(['depense', 'revenu'] as Kind[]).map((k) => (
          <button key={k} onClick={() => { setKind(k); if (k !== kind) setCatId(null) }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${kind === k ? (k === 'depense' ? 'bg-white text-red-600 shadow' : 'bg-white text-green-600 shadow') : 'text-slate-500'}`}>
            {k === 'depense' ? 'Dépense' : 'Revenu'}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-baseline justify-center gap-2 border-b border-slate-100 pb-3">
        <input autoFocus={!tx} inputMode="numeric" placeholder="0" value={amount}
          onChange={(e) => { const n = parseAmount(e.target.value); setAmount(n ? n.toLocaleString('fr-FR') : '') }}
          style={{ width: `${Math.max(2, amount.length + 1)}ch` }}
          className={`max-w-[80%] bg-transparent text-right text-4xl font-bold outline-none ${kind === 'depense' ? 'text-red-600' : 'text-green-600'}`} />
        <span className="text-xl font-semibold text-slate-400">{cur}</span>
      </div>

      <p className="label">Catégorie</p>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {cats.map((c) => (
          <button key={c.id} onClick={() => setCatId(c.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-[11px] leading-tight transition ${catId === c.id ? 'border-brand-500 bg-brand-50' : 'border-transparent bg-slate-50'}`}>
            <span className="text-2xl">{c.icon}</span>
            <span className="line-clamp-2 text-center">{c.name}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Compte</label>
          <select className="input" value={accId ?? ''} onChange={(e) => setAccId(e.target.value || null)}>
            <option value="">—</option>
            {accounts.filter((a) => !a.archived || a.id === accId).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Membre</label>
          <select className="input" value={memId ?? ''} onChange={(e) => setMemId(e.target.value || null)}>
            <option value="">—</option>
            {members.filter((m) => !m.archived || m.id === memId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-3">
        <label className="label">Date</label>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="mb-4">
        <label className="label">Note</label>
        <input className="input" placeholder="Ex : marché d'Analakely" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {err && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        {tx && <button onClick={remove} disabled={busy} className="btn bg-red-50 text-red-600" aria-label="Supprimer"><Trash2 size={18} /></button>}
        <button onClick={save} disabled={busy} className="btn-primary flex-1">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </Sheet>
  )
}
