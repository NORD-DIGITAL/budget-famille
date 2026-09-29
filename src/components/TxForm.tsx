import { useEffect, useState } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import type { Kind, Tx } from '../lib/types'
import { BareIcon, Segmented, Sheet, useKeyboardOpen } from './ui'
import { DateField } from './DatePicker'


export default function TxForm({ open, onClose, tx, initialKind = 'depense' }: { open: boolean; onClose: () => void; tx: Tx | null; initialKind?: Kind }) {
  const { carnet, accounts, members, reload, cur, catById, childrenOf, catPath, familyChildren, rootOf } = useData()
  const kb = useKeyboardOpen()
  const [kind, setKind] = useState<Kind>('depense')
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [kids, setKids] = useState<string[]>([])
  const [unitSel, setUnitSel] = useState<string | null>(null)
  const [forMonth, setForMonth] = useState('')
  const [accId, setAccId] = useState<string | null>(null)
  const [memId, setMemId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    setErr(''); setConfirmDel(false)
    if (tx) {
      const c = tx.category_id ? catById.get(tx.category_id) : undefined
      setKind(tx.kind); setAmount(tx.amount.toLocaleString('fr-FR')); setCatId(tx.category_id)
      setLevel(c ? ((childrenOf.get(c.id)?.length ? c.id : c.parent_id) ?? null) : null)
      setQty(tx.quantity ? String(tx.quantity).replace('.', ',') : ''); setKids(tx.child_name ? tx.child_name.split(', ') : []); setUnitSel(tx.unit); setForMonth(tx.for_month ?? '')
      setAccId(tx.account_id); setMemId(tx.member_id); setDate(tx.occurred_on); setNote(tx.note ?? '')
    } else {
      setKind(initialKind); setAmount(''); setCatId(null); setLevel(null); setQty(''); setKids([]); setUnitSel(null); setForMonth('')
      setAccId(accounts.find((a) => !a.archived)?.id ?? null); setMemId(members.find((m) => !m.archived)?.id ?? null); setDate(todayISO()); setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx])

  const levelCat = level ? catById.get(level) : undefined
  const tiles = (childrenOf.get(level) ?? []).filter((c) => c.kind === kind && (!c.archived || c.id === catId))
  const selected = catId ? catById.get(catId) : undefined
  const unitOptions = selected?.unit ? selected.unit.split('|') : []
  const unit = unitOptions.length ? (unitSel && unitOptions.includes(unitSel) ? unitSel : unitOptions[0]) : null
  const inEcole = rootOf(selected?.id ?? null)?.name === 'École'
  const isEcolage = !!selected && /[ée]colage/i.test(selected.name)
  const qtyNum = Number(qty.replace(',', '.')) || 0
  const amt = parseAmount(amount)
  const showKids = !!selected && (/enfant/i.test(selected.name) || inEcole)
  const kidChoices = inEcole ? familyChildren.filter((k) => k.school === true) : familyChildren
  const toggleKid = (n: string) => setKids(kids.includes(n) ? kids.filter((x) => x !== n) : [...kids, n])

  const pick = (id: string) => {
    setCatId(id); setQty(''); setUnitSel(null)
    if (/[ée]colage/i.test(catById.get(id)?.name ?? '') && !forMonth) setForMonth(date.slice(0, 7))
    if (childrenOf.get(id)?.some((c) => !c.archived)) setLevel(id)
  }
  const goUp = () => { setLevel(levelCat?.parent_id ?? null) }

  const save = async () => {
    if (!amt) return setErr('Indique un montant.')
    if (!catId) return setErr('Choisis une catégorie.')
    setBusy(true)
    const row = {
      carnet_id: carnet!.id, kind, amount: amt, category_id: catId, account_id: accId, member_id: memId, occurred_on: date, note: note.trim() || null,
      quantity: unit && qtyNum > 0 ? qtyNum : null, unit: unit && qtyNum > 0 ? unit : null, child_name: showKids && kids.length ? kids.join(', ') : null, for_month: isEcolage && forMonth ? forMonth : null,
    }
    const { error } = tx ? await supabase.from('transactions').update(row).eq('id', tx.id) : await supabase.from('transactions').insert(row)
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); onClose()
  }

  const remove = async () => {
    if (!tx) return
    if (!confirmDel) return setConfirmDel(true)
    setBusy(true)
    await supabase.from('transactions').delete().eq('id', tx.id)
    setBusy(false); await reload(); onClose()
  }

  const chip = (active: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm transition ${active ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`
  const tileCls = (active: boolean) => `flex ${kb ? 'h-11 flex-row items-center gap-2 px-2' : 'h-[92px] flex-col justify-between p-2.5'} rounded-2xl border text-left transition ${active ? 'border-sun-500 bg-sun-100' : 'border-cream-line bg-cream-tile'}`

  return (
    <Sheet open={open} onClose={onClose} title={tx ? "Modifier l'opération" : 'Nouvelle opération'}>
      <div className="space-y-5">
        <Segmented value={kind} onChange={(k) => { if (k !== kind) { setCatId(null); setLevel(null) } setKind(k) }} options={[['depense', 'Dépense'], ['revenu', 'Revenu']]} />

        <div className={`flex items-baseline justify-center gap-2 rounded-3xl bg-sun-50 ${kb ? "py-2" : "py-5"}`}>
          <input autoFocus={!tx} inputMode="numeric" placeholder="0" value={amount} aria-label="Montant"
            onChange={(e) => { const n = parseAmount(e.target.value); setAmount(n ? n.toLocaleString('fr-FR') : '') }}
            style={{ width: `${Math.max(2, amount.length + 1)}ch` }}
            className={`tabular max-w-[75%] bg-transparent text-right text-[40px] font-semibold outline-none placeholder:text-neutral-300 ${kind === 'revenu' ? 'text-emerald-600' : 'text-ink'}`} />
          <span className="text-2xl font-medium text-ink-muted">{cur}</span>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            {levelCat ? (
              <button onClick={goUp} className="flex items-center gap-1 rounded-full border border-cream-line bg-cream-tile py-1.5 pl-2 pr-4 text-sm font-medium">
                <ChevronLeft size={18} /> {levelCat.name}
              </button>
            ) : <p className="section-title text-base">Catégorie</p>}
            {selected && <p className="truncate text-xs text-ink-muted">{catPath(selected.id)}</p>}
          </div>
          <div className={`grid grid-cols-3 ${kb ? "gap-1.5" : "gap-2.5"}`}>
            {levelCat && (
              <button onClick={() => { setCatId(levelCat.id); setQty('') }} className={tileCls(catId === levelCat.id)}>
                <BareIcon name={levelCat.name} emoji={levelCat.icon} size={kb ? 18 : 28} />
                <span className={`${kb ? "line-clamp-1" : "line-clamp-2"} text-[12px] leading-tight`}>{levelCat.name} (général)</span>
              </button>
            )}
            {tiles.map((c) => {
              const hasKids = !!childrenOf.get(c.id)?.some((x) => !x.archived)
              return (
                <button key={c.id} onClick={() => pick(c.id)} className={tileCls(catId === c.id)}>
                  <div className={`flex items-start justify-between ${kb ? 'shrink-0' : ''}`}>
                    <BareIcon name={c.name} emoji={c.icon} size={kb ? 18 : 28} />
                    {hasKids && !kb && <span className="rounded-full bg-white px-1.5 text-[10px] text-ink-muted">+{childrenOf.get(c.id)!.filter((x) => !x.archived).length}</span>}
                  </div>
                  <span className={`${kb ? "line-clamp-1" : "line-clamp-2"} break-words text-[12px] leading-tight`}>{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {unit && (
          <div className="rounded-2xl border border-cream-line bg-cream-tile p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="label mb-0" htmlFor="tx-qty">Quantité</label>
              {unitOptions.length > 1 && (
                <div className="flex rounded-full bg-white p-0.5">
                  {unitOptions.map((u) => (
                    <button key={u} type="button" onClick={() => setUnitSel(u)} className={`rounded-full px-3 py-1 text-sm transition ${unit === u ? 'bg-ink text-white' : 'text-ink-muted'}`}>{u === 'kg' ? 'Kilo' : u.charAt(0).toUpperCase() + u.slice(1)}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-36">
                <input id="tx-qty" inputMode="decimal" className="input tabular bg-white py-3 pr-14" placeholder="Ex : 5" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ''))} />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">{unit}</span>
              </div>
              <p className="text-sm text-ink-soft">{qtyNum > 0 && amt > 0 ? <>soit <b className="tabular">{fmt(Math.round(amt / qtyNum), cur)}</b> / {unit}</> : `Prix total en ${cur} au-dessus`}</p>
            </div>
          </div>
        )}

        {isEcolage && (
          <div>
            <p className="section-title mb-2 text-base">Écolage de quel mois ?</p>
            <DateField value={forMonth} mode="month" onChange={setForMonth} placeholder="Choisir le mois" />
          </div>
        )}

        {showKids && (
          <div>
            <p className="section-title mb-2 text-base">Pour quel(s) enfant(s) ? <span className="text-sm font-normal text-ink-muted">plusieurs possibles</span></p>
            {kidChoices.length ? (
              <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
                {kidChoices.map((k) => <button key={k.name} type="button" onClick={() => toggleKid(k.name)} className={chip(kids.includes(k.name))}>{k.name}</button>)}
              </div>
            ) : (
              <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm text-ink-soft">
                {inEcole ? "Indique dans Compte › Voir le profil quels enfants vont à l'école (Oui)." : 'Ajoute tes enfants dans Compte › Voir le profil pour les choisir ici.'}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="section-title mb-2 text-base">Compte</p>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
            {accounts.filter((a) => !a.archived || a.id === accId).map((a) => <button key={a.id} onClick={() => setAccId(a.id)} className={chip(accId === a.id)}>{a.name}</button>)}
          </div>
        </div>

        <div>
          <p className="section-title mb-2 text-base">{kind === 'depense' ? 'Payé par' : 'Reçu par'}</p>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
            {members.filter((m) => !m.archived || m.id === memId).map((m) => <button key={m.id} onClick={() => setMemId(m.id)} className={chip(memId === m.id)}>{m.name}</button>)}
          </div>
        </div>

        <div className="grid grid-cols-[auto,1fr] items-center gap-3">
          <label className="label mb-0" htmlFor="tx-date">Date</label>
          <DateField id="tx-date" value={date} onChange={setDate} className="py-3" />
          <label className="label mb-0" htmlFor="tx-note">Note</label>
          <input id="tx-note" className="input py-3" placeholder="Ex : marché d'Analakely" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          {tx && (
            <button onClick={remove} disabled={busy} className={`btn ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`} aria-label="Supprimer">
              <Trash2 size={18} />{confirmDel && 'Confirmer'}
            </button>
          )}
          <button onClick={save} disabled={busy} className="btn-primary flex-1 text-lg">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </Sheet>
  )
}
