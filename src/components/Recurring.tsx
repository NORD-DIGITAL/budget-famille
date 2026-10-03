import { useState } from 'react'
import { CalendarClock, Check, Plus, Repeat } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, monthKey, parseAmount, todayISO } from '../lib/format'
import type { Recurring, RecurringDue } from '../lib/types'
import { fmtMonthLong } from './DatePicker'
import { DateField } from './DatePicker'
import { Empty, IconBubble, Segmented, Sheet } from './ui'

const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? 'border-ink bg-ink text-white' : 'border-cream-line bg-white'}`

type Draft = { r: Recurring | null; label: string; amount: string; catId: string | null; accId: string | null; memId: string | null; day: number; mode: 'auto' | 'valider'; active: boolean; startOn: string }

/** Échéances déjà passées entre la date de commencement et aujourd'hui (mois YYYY-MM). */
function pastMonths(startOn: string, day: number, after: string | null) {
  const out: string[] = []
  const today = todayISO()
  let y = Number(startOn.slice(0, 4)), m = Number(startOn.slice(5, 7))
  for (let i = 0; i < 120; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key > today.slice(0, 7)) break
    const due = `${key}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, '0')}`
    if (due <= today && (!after || key > after)) out.push(key)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

/** Liste et réglage des dépenses fixes (loyer, Jirama, écolage…), affichée dans Budget. */
export function RecurringSection() {
  const { recurring, categories, accounts, members, catById, catPath, carnet, cur, reload } = useData()
  const [edit, setEdit] = useState<Draft | null>(null)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const month = monthKey(new Date())

  const open = (r: Recurring | null) => {
    setErr(''); setConfirmDel(false)
    const day = r?.day_of_month ?? new Date().getDate()
    setEdit(r
      ? { r, label: r.label, amount: r.amount.toLocaleString('fr-FR'), catId: r.category_id, accId: r.account_id, memId: r.member_id, day, mode: r.mode, active: r.active, startOn: r.start_on ?? `${r.start_month}-${String(Math.min(day, 28)).padStart(2, '0')}` }
      : { r: null, label: '', amount: '', catId: null, accId: accounts.find((a) => !a.archived)?.id ?? null, memId: null, day, mode: 'valider', active: true, startOn: todayISO() })
  }

  const save = async () => {
    if (!edit) return
    const amount = parseAmount(edit.amount)
    if (!edit.label.trim()) return setErr('Donne un nom (ex : Loyer).')
    if (!amount) return setErr('Montant requis.')
    if (!edit.startOn) return setErr('Choisis la date de commencement.')
    const row = {
      label: edit.label.trim(), amount, category_id: edit.catId, account_id: edit.accId, member_id: edit.memId,
      day_of_month: edit.day, mode: edit.mode, active: edit.active,
      // Date de commencement : les échéances passées depuis cette date sont rattrapées
      start_on: edit.startOn, start_month: edit.startOn.slice(0, 7),
      ...(edit.r ? {} : { last_month: null }),
    }
    const { error } = edit.r
      ? await supabase.from('recurring_expenses').update(row).eq('id', edit.r.id)
      : await supabase.from('recurring_expenses').insert({ ...row, carnet_id: carnet!.id })
    if (error) return setErr(error.message)
    await reload(); setEdit(null)
  }
  const remove = async () => {
    if (!edit?.r) return
    if (!confirmDel) return setConfirmDel(true)
    await supabase.from('recurring_expenses').delete().eq('id', edit.r.id)
    await reload(); setEdit(null)
  }

  const total = recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0)
  const catchUp = edit && edit.startOn ? pastMonths(edit.startOn, edit.day, edit.r?.last_month ?? null) : []

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-semibold"><Repeat size={18} /> Dépenses fixes</h2>
        <button onClick={() => open(null)} className="flex items-center gap-1 text-sm font-medium text-brand-600"><Plus size={16} /> Ajouter</button>
      </div>
      {recurring.length === 0 ? <Empty icon="🔁" text="Loyer, Jirama, écolage… Déclare-les une fois : l'application les ajoute chaque mois, ou te demande de les valider." /> : (
        <div className="card divide-y divide-neutral-100">
          {recurring.map((r) => {
            const c = r.category_id ? catById.get(r.category_id) : undefined
            const done = r.last_month === month
            return (
              <button key={r.id} onClick={() => open(r)} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${r.active ? '' : 'opacity-50'}`}>
                <IconBubble name={c?.name ?? r.label} icon={c?.icon ?? '🔁'} color={c?.color ?? 'var(--accent)'} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.label}</p>
                  <p className="text-xs text-neutral-400">
                    Le {r.day_of_month} du mois · {r.mode === 'auto' ? 'automatique' : 'à valider'}{!r.active ? ' · en pause' : done ? ' · fait ce mois-ci ✓' : ''}
                  </p>
                </div>
                <p className="font-semibold">{fmt(r.amount, cur)}</p>
              </button>
            )
          })}
          <p className="px-3 py-2 text-right text-xs text-neutral-500">Total mensuel : <b>{fmt(total, cur)}</b></p>
        </div>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.r ? 'Modifier la dépense fixe' : 'Nouvelle dépense fixe'}>
        {edit && (
          <div className="space-y-3">
            <div><label className="label">Nom</label>
              <input className="input" placeholder="Ex : Loyer, Jirama, Écolage" maxLength={80} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
            <div><label className="label">Montant mensuel ({cur})</label>
              <input className="input text-lg font-semibold" inputMode="numeric" value={edit.amount}
                onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, amount: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
            <div><p className="label">Date de commencement (1re échéance)</p>
              <DateField value={edit.startOn} max={todayISO().slice(0, 4) + '-12-31'} onChange={(v) => setEdit({ ...edit, startOn: v, day: Number(v.slice(8, 10)) })} />
              <p className="mt-1 text-xs text-ink-muted">Si tu l'ajoutes en retard, choisis la vraie date de départ : les mois passés seront rattrapés.</p></div>
            <div><label className="label">Jour du mois</label>
              <select className="input" value={edit.day} onChange={(e) => setEdit({ ...edit, day: Number(e.target.value) })}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 31 ? 'Dernier jour du mois' : `Le ${d}`}</option>)}
              </select></div>
            <div><label className="label">Catégorie</label>
              <select className="input" value={edit.catId ?? ''} onChange={(e) => setEdit({ ...edit, catId: e.target.value || null })}>
                <option value="">Aucune</option>
                {categories.filter((c) => c.kind === 'depense' && (!c.archived || c.id === edit.catId)).sort((a, b) => catPath(a.id).localeCompare(catPath(b.id), 'fr')).map((c) => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}
              </select></div>
            <div><p className="label">Payé avec</p>
              <div className="flex flex-wrap gap-2">{accounts.filter((a) => !a.archived || a.id === edit.accId).map((a) => <button key={a.id} onClick={() => setEdit({ ...edit, accId: a.id })} className={chip(edit.accId === a.id)}>{a.name}</button>)}</div></div>
            {members.length > 1 && <div><p className="label">Par qui</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEdit({ ...edit, memId: null })} className={chip(!edit.memId)}>—</button>
                {members.filter((m) => !m.archived || m.id === edit.memId).map((m) => <button key={m.id} onClick={() => setEdit({ ...edit, memId: m.id })} className={chip(edit.memId === m.id)}>{m.name}</button>)}
              </div></div>}
            <div><p className="label">Chaque mois</p>
              <Segmented value={edit.mode} onChange={(mode) => setEdit({ ...edit, mode })} options={[['valider', 'Me demander de valider'], ['auto', 'Ajouter automatiquement']]} />
              <p className="mt-1 text-xs text-ink-muted">{edit.mode === 'valider' ? "Pratique si le montant change (Jirama) : tu confirmes ou corriges le montant à l'échéance." : "La dépense est ajoutée toute seule le jour prévu, avec ce montant."}</p></div>
            {catchUp.length > 0 && (
              <p className="rounded-2xl bg-sun-100 p-3 text-sm">
                <b>{catchUp.length} échéance{catchUp.length > 1 ? 's' : ''} déjà passée{catchUp.length > 1 ? 's' : ''}</b> ({catchUp.map((k) => fmtMonthLong(k).replace(/ \d{4}$/, '')).join(', ')}) :
                {edit.mode === 'auto' ? ' elles seront ajoutées automatiquement, chacune à sa date.' : " elles te seront demandées une par une sur l'accueil (valider ou ignorer)."}
                {!edit.r && ' Si tu as déjà saisi certains mois toi-même, choisis une date de commencement plus tard.'}
              </p>
            )}
            {edit.r && (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (décocher pour mettre en pause)
              </label>
            )}
            {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              {edit.r && <button onClick={remove} className={`btn ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>{confirmDel ? 'Confirmer' : 'Supprimer'}</button>}
              <button onClick={save} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}

/** Accueil : dépenses fixes arrivées à échéance, à valider (montant modifiable) ou à ignorer pour ce mois. */
export function RecurringDueCard() {
  const { recurringDue, cur, reload } = useData()
  const [sel, setSel] = useState<{ r: RecurringDue; amount: string; date: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!recurringDue.length) return null

  const confirm = async () => {
    if (!sel) return
    const amt = parseAmount(sel.amount)
    if (!amt) return setErr('Montant requis.')
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('recurring_confirm', { p_id: sel.r.id, p_amount: amt, p_date: sel.date })
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); setSel(null)
  }
  const skip = async (r: RecurringDue) => { await supabase.rpc('recurring_skip', { p_id: r.id }); await reload(); setSel(null) }

  return (
    <div className="mb-4 rounded-2xl border border-sun-500 bg-sun-50 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarClock size={18} /> Dépenses fixes à valider</p>
      <div className="space-y-2">
        {recurringDue.map((r, i) => {
          // On valide dans l'ordre : seule la plus ancienne échéance de chaque dépense fixe est active
          const first = recurringDue.findIndex((x) => x.id === r.id) === i
          const late = r.due_month < todayISO().slice(0, 7)
          return (
          <div key={r.id + r.due_month} className={`flex items-center gap-2 rounded-xl bg-white px-3 py-2 ${first ? '' : 'opacity-50'}`}>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.label} <span className="text-xs font-normal text-ink-muted">· {fmtMonthLong(r.due_month).toLowerCase()}</span></p><p className={`text-xs ${late ? 'text-red-600' : 'text-ink-muted'}`}>{late ? 'En retard · ' : ''}le {new Date(r.due_date + 'T00:00:00').toLocaleDateString('fr-FR')} · {fmt(r.amount, cur)}</p></div>
            {first && <button onClick={() => { setErr(''); setSel({ r, amount: r.amount.toLocaleString('fr-FR'), date: r.due_date }) }} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-sm text-white"><Check size={15} /> Valider</button>}
          </div>
          )
        })}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `Valider : ${sel.r.label} (${fmtMonthLong(sel.r.due_month).toLowerCase()})` : ''}>
        {sel && (
          <div className="space-y-3">
            <div><label className="label">Montant payé ({cur})</label>
              <input className="input text-lg font-semibold" inputMode="numeric" autoFocus value={sel.amount}
                onChange={(e) => { const n = parseAmount(e.target.value); setSel({ ...sel, amount: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
            <div><p className="label">Date</p><DateField value={sel.date} onChange={(date) => setSel({ ...sel, date })} max={todayISO()} /></div>
            {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
            <button onClick={confirm} disabled={busy} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
            <button onClick={() => skip(sel.r)} className="w-full py-2 text-sm text-ink-muted">Ignorer cette échéance</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
