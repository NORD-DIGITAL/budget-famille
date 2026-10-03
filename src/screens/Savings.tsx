import { useMemo, useState } from 'react'
import { BellRing, ChevronRight, Paperclip, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import { deleteEntityPhotos, uploadPhoto } from '../lib/attachments'
import type { Debt, Goal, GoalKind } from '../lib/types'
import { Empty, ICON_SET, IconTile, Progress, Segmented, Sheet } from '../components/ui'
import { DateField } from '../components/DatePicker'
import { isMobileMoney, MethodPicker, PhotoPicker, RefField } from '../components/Money'
import { MoveHistory } from '../components/MoveHistory'
import type { HPatch, HRow } from '../components/MoveHistory'
import { Pencil } from 'lucide-react'

/* ---------------------------------------------------------------- Épargne */

export const GOAL_KINDS: { k: GoalKind; label: string; icon: string; hint: string }[] = [
  { k: 'objectif', label: 'Objectif', icon: 'i:Gift', hint: 'Un montant à atteindre (moto, rentrée…)' },
  { k: 'principal', label: 'Principale', icon: 'i:PiggyBank', hint: 'Montant libre, cumulé' },
  { k: 'familiale', label: 'Familiale', icon: 'i:Users', hint: 'Montant libre, cumulé' },
  { k: 'materiel', label: 'Matériel', icon: 'i:Wrench', hint: 'Montant libre, cumulé' },
  { k: 'perso', label: 'Perso', icon: 'i:Heart', hint: 'Montant libre, cumulé' },
  { k: 'autre', label: 'Autre', icon: 'i:Package', hint: 'Nom et icône au choix' },
]
const KIND_NAME: Record<GoalKind, string> = { objectif: '', principal: 'Épargne principale', familiale: 'Épargne familiale', materiel: 'Épargne matériel', perso: 'Épargne perso', autre: '' }
export const BANKS = ['BNI', 'BRED', 'BMOI', 'BOA', 'MCB']
const PREFIX = { mvola: ['034', '036', '038'], orange: ['032', '037'] } as const
const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`

export function supportLabel(g: Goal) {
  if (g.support === 'banque') return g.bank ? `Banque ${g.bank}` : 'Banque'
  if (g.support === 'mvola') return `MVola${g.phone ? ' ' + g.phone : ''}`
  if (g.support === 'orange') return `Orange Money${g.phone ? ' ' + g.phone : ''}`
  return ''
}

type GoalEdit = {
  g: Goal | null; kind: GoalKind; name: string; icon: string; target: string; deadline: string
  support: Goal['support']; bank: string; prefix: string; phone: string; monthly: boolean; day: string; mAmount: string
}
type MoveEdit = { g: Goal; sign: 1 | -1; amount: string; date: string; method: string; ref: string; note: string; files: File[] }

function IconGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto rounded-2xl border border-cream-line bg-cream-tile p-2">
      {Object.entries(ICON_SET).map(([n, I]) => (
        <button key={n} type="button" aria-label={n} onClick={() => onChange('i:' + n)}
          className={`flex aspect-square items-center justify-center rounded-xl transition ${value === 'i:' + n ? 'bg-sun-500' : 'bg-white'}`}><I size={22} strokeWidth={1.6} /></button>
      ))}
    </div>
  )
}

export function GoalsPage() {
  const { goals, moves, cur, carnet, reload } = useData()
  const [edit, setEdit] = useState<GoalEdit | null>(null)
  const [mv, setMv] = useState<MoveEdit | null>(null)
  const [detail, setDetail] = useState<Goal | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const total = goals.reduce((a, g) => a + g.saved_amount, 0)

  const openEdit = (g: Goal | null) => {
    setErr(''); setConfirmDel(false)
    const digits = (g?.phone ?? '').replace(/\D/g, '')
    setEdit(g ? {
      g, kind: g.kind, name: g.name, icon: g.icon, target: g.target_amount ? g.target_amount.toLocaleString('fr-FR') : '', deadline: g.deadline ?? '',
      support: g.support, bank: g.bank ?? '', prefix: digits.slice(0, 3), phone: digits.slice(3), monthly: !!g.monthly_day,
      day: g.monthly_day ? String(g.monthly_day) : '5', mAmount: g.monthly_amount ? g.monthly_amount.toLocaleString('fr-FR') : '',
    } : { g: null, kind: 'objectif', name: '', icon: 'i:Gift', target: '', deadline: '', support: null, bank: '', prefix: '', phone: '', monthly: false, day: '5', mAmount: '' })
  }

  const save = async () => {
    if (!edit) return
    const name = (edit.name.trim() || KIND_NAME[edit.kind]).trim()
    const target = parseAmount(edit.target)
    if (!name) return setErr('Donne un nom à cette épargne.')
    if (edit.kind === 'objectif' && !target) return setErr('Indique le montant à atteindre.')
    const d = edit.phone.replace(/\D/g, '')
    if (isMobileMoney(edit.support) && d && (d.length !== 7 || !edit.prefix)) return setErr('Numéro : choisis le préfixe puis 7 chiffres.')
    const row = {
      kind: edit.kind, name, icon: edit.icon, target_amount: edit.kind === 'objectif' ? target : null, deadline: edit.kind === 'objectif' ? edit.deadline || null : null,
      support: edit.support, bank: edit.support === 'banque' ? edit.bank || null : null,
      phone: isMobileMoney(edit.support) && d ? `${edit.prefix} ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : null,
      monthly_day: edit.monthly ? Math.min(28, Math.max(1, Number(edit.day) || 1)) : null,
      monthly_amount: edit.monthly ? parseAmount(edit.mAmount) || null : null,
    }
    setBusy(true)
    const { error } = edit.g ? await supabase.from('savings_goals').update(row).eq('id', edit.g.id) : await supabase.from('savings_goals').insert({ ...row, carnet_id: carnet!.id })
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); setEdit(null)
  }
  const remove = async () => {
    if (!edit?.g) return
    if (!confirmDel) return setConfirmDel(true)
    await deleteEntityPhotos(edit.g.id)
    await supabase.from('savings_goals').delete().eq('id', edit.g.id)
    await reload(); setEdit(null)
  }

  const openMove = (g: Goal, sign: 1 | -1) => {
    setErr('')
    setMv({ g, sign, amount: sign === 1 && g.monthly_amount ? g.monthly_amount.toLocaleString('fr-FR') : '', date: todayISO(), method: g.support ?? 'especes', ref: '', note: '', files: [] })
  }
  const saveMove = async () => {
    if (!mv) return
    const n = parseAmount(mv.amount)
    if (!n) return setErr('Indique un montant.')
    if (mv.sign === -1 && n > mv.g.saved_amount) return setErr(`Tu ne peux pas retirer plus que ${fmt(mv.g.saved_amount, cur)}.`)
    setBusy(true)
    const { data, error } = await supabase.from('savings_moves').insert({
      carnet_id: carnet!.id, goal_id: mv.g.id, amount: mv.sign * n, moved_on: mv.date, method: mv.method,
      ref: isMobileMoney(mv.method) && mv.ref.trim() ? mv.ref.trim().toUpperCase() : null, note: mv.note.trim() || null,
    }).select('id').single()
    if (!error) {
      await supabase.from('savings_goals').update({ saved_amount: Math.max(0, mv.g.saved_amount + mv.sign * n) }).eq('id', mv.g.id)
      for (const f of mv.files) { const e = await uploadPhoto(carnet!.id, 'goal', mv.g.id, f, data?.id); if (e) { setErr(e); break } }
    }
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); setMv(null)
  }

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <div className="rounded-3xl bg-sun-500 p-5">
        <p className="text-sm">Total épargné</p>
        <p className="tabular text-3xl font-semibold">{fmt(total, cur)}</p>
        <p className="text-sm">{goals.length} épargne{goals.length > 1 ? 's' : ''}</p>
      </div>
      <button onClick={() => openEdit(null)} className="btn-ghost w-full"><Plus size={18} /> Nouvelle épargne</button>
      {goals.length === 0 && <Empty icon="🐷" text="Épargne principale, familiale, un objectif (moto, rentrée)… sur ta banque, MVola ou Orange Money." />}

      <div className="grid gap-3 lg:grid-cols-2">
        {goals.map((g) => {
          const kind = GOAL_KINDS.find((x) => x.k === g.kind)
          const left = g.target_amount ? g.target_amount - g.saved_amount : 0
          const n = moves.filter((m) => m.goal_id === g.id).length
          return (
            <div key={g.id} className="tile p-4">
              <button onClick={() => setDetail(g)} className="mb-3 flex w-full items-center gap-3 text-left">
                <IconTile name={g.name} emoji={g.icon} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="truncate text-xs text-ink-muted">{[kind?.label, supportLabel(g)].filter(Boolean).join(' · ')}</p>
                  {g.monthly_day && <p className="flex items-center gap-1 text-xs text-ink-soft"><BellRing size={12} /> Le {g.monthly_day} de chaque mois{g.monthly_amount ? ` · ${fmt(g.monthly_amount, cur)}` : ''}</p>}
                </div>
                <div className="text-right">
                  <p className="tabular font-semibold">{fmt(g.saved_amount, cur)}</p>
                  {g.target_amount ? <p className="tabular text-xs text-ink-muted">sur {fmt(g.target_amount, cur)}</p> : <p className="text-xs text-ink-muted">cumulé</p>}
                </div>
              </button>
              {g.target_amount ? (
                <>
                  <Progress value={g.saved_amount} max={g.target_amount} />
                  <p className="mt-1 text-xs text-ink-muted">{left <= 0 ? 'Objectif atteint 🎉' : `Reste ${fmt(left, cur)}${g.deadline ? ` · avant le ${new Date(g.deadline + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}`}</p>
                </>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button onClick={() => openMove(g, 1)} className="btn-primary flex-1 py-2 text-sm">+ Épargner</button>
                <button onClick={() => openMove(g, -1)} className="btn-ghost bg-white py-2 text-sm">Retirer</button>
                <button onClick={() => setDetail(g)} className="btn-ghost bg-white px-3 py-2 text-sm" aria-label="Historique et photos">{n}<ChevronRight size={16} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Création / modification */}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.g ? "Modifier l'épargne" : 'Nouvelle épargne'}>
        {edit && (
          <div className="space-y-4">
            <div>
              <p className="label">Type d'épargne</p>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_KINDS.map((x) => (
                  <button key={x.k} type="button" onClick={() => setEdit({ ...edit, kind: x.k, icon: edit.g ? edit.icon : x.icon, name: x.k === 'objectif' || x.k === 'autre' ? (edit.g ? edit.name : '') : KIND_NAME[x.k] })}
                    className={`rounded-2xl border px-2 py-2.5 text-sm transition ${edit.kind === x.k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{x.label}</button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-muted">{GOAL_KINDS.find((x) => x.k === edit.kind)?.hint}</p>
            </div>
            <div><label className="label" htmlFor="g-name">Nom</label><input id="g-name" className="input" placeholder={edit.kind === 'objectif' ? 'Ex : Moto, Rentrée scolaire' : KIND_NAME[edit.kind] || 'Nom de ton épargne'} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><p className="label">Icône</p><IconGrid value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} /></div>
            {edit.kind === 'objectif' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="g-target">Montant à atteindre</label><input id="g-target" className="input tabular" inputMode="numeric" value={edit.target} onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, target: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
                <div><p className="label">Échéance</p><DateField value={edit.deadline} clearable placeholder="Aucune" onChange={(v) => setEdit({ ...edit, deadline: v })} /></div>
              </div>
            )}
            <div>
              <p className="label">Où est placé l'argent ?</p>
              <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
                {([[null, 'Non précisé'], ['banque', 'Banque'], ['mvola', 'MVola'], ['orange', 'Orange Money']] as [Goal['support'], string][]).map(([k, l]) => (
                  <button key={l} type="button" onClick={() => setEdit({ ...edit, support: k, prefix: k && isMobileMoney(k) ? PREFIX[k as 'mvola' | 'orange'][0] : '' })} className={chip(edit.support === k)}>{l}</button>
                ))}
              </div>
            </div>
            {edit.support === 'banque' && (
              <div className="flex flex-wrap gap-2">{BANKS.map((b) => <button key={b} type="button" onClick={() => setEdit({ ...edit, bank: b })} className={chip(edit.bank === b)}>{b}</button>)}</div>
            )}
            {isMobileMoney(edit.support) && (
              <div>
                <label className="label" htmlFor="g-phone">Numéro {edit.support === 'mvola' ? 'MVola' : 'Orange Money'}</label>
                <div className="flex gap-2">
                  <select aria-label="Préfixe" className="input w-[6.5rem]" value={edit.prefix} onChange={(e) => setEdit({ ...edit, prefix: e.target.value })}>
                    {PREFIX[edit.support as 'mvola' | 'orange'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input id="g-phone" className="input tabular flex-1" inputMode="numeric" placeholder="12 345 67" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value.replace(/\D/g, '').slice(0, 7) })} />
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-cream-line bg-cream-tile p-4">
              <label className="flex items-center justify-between gap-3">
                <span><span className="block font-medium">Répéter chaque mois</span><span className="text-xs text-ink-muted">Rappel le jour choisi (notification sur l'application Android)</span></span>
                <input type="checkbox" className="h-6 w-6 accent-ink" checked={edit.monthly} onChange={(e) => setEdit({ ...edit, monthly: e.target.checked })} />
              </label>
              {edit.monthly && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="g-day">Jour du mois</label>
                    <select id="g-day" className="input bg-white" value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>
                      {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>le {i + 1}</option>)}
                    </select>
                  </div>
                  <div><label className="label" htmlFor="g-mamount">Montant prévu</label><input id="g-mamount" className="input tabular bg-white" inputMode="numeric" placeholder="facultatif" value={edit.mAmount} onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, mAmount: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
                </div>
              )}
            </div>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              {edit.g && <button onClick={remove} className={`btn ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><Trash2 size={18} />{confirmDel ? 'Confirmer' : ''}</button>}
              <button onClick={save} disabled={busy} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Versement / retrait */}
      <Sheet open={!!mv} onClose={() => setMv(null)} title={mv ? `${mv.sign === 1 ? 'Épargner' : 'Retirer'} · ${mv.g.name}` : ''}>
        {mv && (
          <div className="space-y-4">
            <input className="input tabular text-center text-2xl font-bold" inputMode="numeric" autoFocus placeholder={`0 ${cur}`} aria-label="Montant" value={mv.amount} onChange={(e) => { const n = parseAmount(e.target.value); setMv({ ...mv, amount: n ? n.toLocaleString('fr-FR') : '' }) }} />
            <div><p className="label">Date</p><DateField value={mv.date} onChange={(v) => setMv({ ...mv, date: v })} /></div>
            <div><p className="label">Moyen</p><MethodPicker value={mv.method} onChange={(v) => setMv({ ...mv, method: v })} /></div>
            {isMobileMoney(mv.method) && <RefField value={mv.ref} onChange={(v) => setMv({ ...mv, ref: v })} />}
            <div><label className="label" htmlFor="mv-note">Note</label><input id="mv-note" className="input" value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} /></div>
            <PhotoPicker files={mv.files} onChange={(f) => setMv({ ...mv, files: f })} />
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <button onClick={saveMove} disabled={busy} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Valider'}</button>
          </div>
        )}
      </Sheet>

      {/* Fiche de l'épargne : résumé, historique, chaque mouvement a sa fiche */}
      {(() => {
        const g = detail ? goals.find((x) => x.id === detail.id) ?? detail : null
        return (
          <Sheet open={!!g} onClose={() => setDetail(null)} title={g?.name}>
            {g && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-cream-tile p-4">
                  <div className="flex items-center gap-3">
                    <IconTile name={g.name} emoji={g.icon} size={48} />
                    <div className="min-w-0 flex-1"><p className="text-xs text-ink-muted">{[GOAL_KINDS.find((x) => x.k === g.kind)?.label, supportLabel(g)].filter(Boolean).join(' · ')}</p>
                      <p className="tabular text-2xl font-bold">{fmt(g.saved_amount, cur)}</p>{g.target_amount ? <p className="tabular text-xs text-ink-muted">sur {fmt(g.target_amount, cur)}</p> : null}</div>
                  </div>
                  {g.target_amount ? <div className="mt-3"><Progress value={g.saved_amount} max={g.target_amount} /></div> : null}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => openMove(g, 1)} className="btn-primary flex-1 py-2 text-sm">+ Épargner</button>
                    <button onClick={() => openMove(g, -1)} className="btn-ghost bg-white py-2 text-sm">Retirer</button>
                    <button onClick={() => openEdit(g)} className="btn-ghost bg-white px-3 py-2 text-sm" aria-label="Modifier l'épargne"><Pencil size={16} /></button>
                  </div>
                </div>
                <MoveHistory carnetId={carnet!.id} entity="goal" entityId={g.id} title="Historique des mouvements" labels={{ plus: 'Versement', minus: 'Retrait' }}
                  rows={moves.filter((m) => m.goal_id === g.id).map((m): HRow => ({ id: m.id, amount: m.amount, date: m.moved_on, method: m.method, ref: m.ref, note: m.note }))}
                  onDelete={async (row) => {
                    await supabase.from('savings_moves').delete().eq('id', row.id)
                    await supabase.from('savings_goals').update({ saved_amount: Math.max(0, g.saved_amount - row.amount) }).eq('id', g.id)
                    await reload()
                  }}
                  onUpdate={async (row, p: HPatch) => {
                    const { error } = await supabase.from('savings_moves').update({ amount: p.amount, moved_on: p.date, method: p.method, ref: p.ref, note: p.note }).eq('id', row.id)
                    if (error) return error.message
                    await supabase.from('savings_goals').update({ saved_amount: Math.max(0, g.saved_amount + p.amount - row.amount) }).eq('id', g.id)
                    await reload(); return null
                  }} />
              </div>
            )}
          </Sheet>
        )
      })()}
    </div>
  )
}

/* ---------------------------------------------------------------- Dettes */

type DebtEdit = { d: Debt | null; direction: Debt['direction']; person: string; amount: string; due: string; note: string }
type PayEdit = { d: Debt; amount: string; date: string; method: string; ref: string; note: string; files: File[] }

export function DebtsPage() {
  const { debts, payments, cur, carnet, reload } = useData()
  const [tab, setTab] = useState<Debt['direction']>('je_dois')
  const [edit, setEdit] = useState<DebtEdit | null>(null)
  const [pay, setPay] = useState<PayEdit | null>(null)
  const [detail, setDetail] = useState<Debt | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const list = debts.filter((d) => d.direction === tab)
  const open = list.filter((d) => d.paid < d.amount)
  const done = list.filter((d) => d.paid >= d.amount)
  const leftOf = (d: Debt) => Math.max(0, d.amount - d.paid)
  const totalLeft = (dir: Debt['direction']) => debts.filter((d) => d.direction === dir).reduce((a, d) => a + leftOf(d), 0)
  const countPay = useMemo(() => { const m = new Map<string, number>(); for (const p of payments) m.set(p.debt_id, (m.get(p.debt_id) ?? 0) + 1); return m }, [payments])

  const save = async () => {
    if (!edit) return
    const amount = parseAmount(edit.amount)
    if (!edit.person.trim()) return setErr("Indique la personne ou l'organisme.")
    if (!amount) return setErr('Indique le montant.')
    const row = { direction: edit.direction, person: edit.person.trim(), amount, due_date: edit.due || null, note: edit.note.trim() || null }
    const { error } = edit.d ? await supabase.from('debts').update(row).eq('id', edit.d.id) : await supabase.from('debts').insert({ ...row, carnet_id: carnet!.id })
    if (error) return setErr(error.message)
    await reload(); setEdit(null)
  }
  const remove = async () => {
    if (!edit?.d) return
    if (!confirmDel) return setConfirmDel(true)
    await deleteEntityPhotos(edit.d.id)
    await supabase.from('debts').delete().eq('id', edit.d.id)
    await reload(); setEdit(null)
  }
  const repay = async () => {
    if (!pay) return
    const n = parseAmount(pay.amount)
    if (!n) return setErr('Indique un montant.')
    setBusy(true)
    const { data, error } = await supabase.from('debt_payments').insert({
      carnet_id: carnet!.id, debt_id: pay.d.id, amount: n, paid_on: pay.date, method: pay.method,
      ref: isMobileMoney(pay.method) && pay.ref.trim() ? pay.ref.trim().toUpperCase() : null, note: pay.note.trim() || null,
    }).select('id').single()
    if (!error) {
      await supabase.from('debts').update({ paid: Math.min(pay.d.amount, pay.d.paid + n) }).eq('id', pay.d.id)
      for (const f of pay.files) { const e = await uploadPhoto(carnet!.id, 'debt', pay.d.id, f, data?.id); if (e) { setErr(e); break } }
    }
    setBusy(false)
    if (error) return setErr(error.message)
    await reload(); setPay(null)
  }
  const openEdit = (d: Debt | null) => {
    setErr(''); setConfirmDel(false)
    setEdit(d ? { d, direction: d.direction, person: d.person, amount: d.amount.toLocaleString('fr-FR'), due: d.due_date ?? '', note: d.note ?? '' }
      : { d: null, direction: tab, person: '', amount: '', due: '', note: '' })
  }
  const late = (d: Debt) => d.due_date && d.due_date < todayISO() && d.paid < d.amount

  const Card = ({ d }: { d: Debt }) => (
    <div className="tile p-4">
      <button onClick={() => setDetail(d)} className="mb-3 flex w-full items-center gap-3 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white">{d.person.charAt(0).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{d.person}</p>
          <p className={`text-xs ${late(d) ? 'text-red-600' : 'text-ink-muted'}`}>
            {d.paid >= d.amount ? 'Soldée ✔' : d.due_date ? `${late(d) ? 'En retard · ' : ''}échéance ${new Date(d.due_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : 'Sans échéance'}
            {d.note ? ` · ${d.note}` : ''}
          </p>
        </div>
        <div className="text-right"><p className="tabular font-semibold">{fmt(leftOf(d), cur)}</p><p className="tabular text-xs text-ink-muted">sur {fmt(d.amount, cur)}</p></div>
      </button>
      <Progress value={d.paid} max={d.amount} color={d.paid >= d.amount ? '#10B981' : undefined} />
      <div className="mt-3 flex gap-2">
        {d.paid < d.amount && (
          <button onClick={() => { setErr(''); setPay({ d, amount: '', date: todayISO(), method: 'especes', ref: '', note: '', files: [] }) }} className="btn-primary flex-1 py-2.5 text-sm">
            {d.direction === 'je_dois' ? '+ Remboursement' : '+ Paiement reçu'}
          </button>
        )}
        <button onClick={() => setDetail(d)} className="btn-ghost flex-1 bg-white py-2.5 text-sm"><Paperclip size={16} /> Fiche et historique ({countPay.get(d.id) ?? 0})</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs text-red-700">Je dois encore</p><p className="tabular font-semibold">{fmt(totalLeft('je_dois'), cur)}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">On me doit encore</p><p className="tabular font-semibold">{fmt(totalLeft('on_me_doit'), cur)}</p></div>
      </div>
      <Segmented value={tab} onChange={setTab} options={[['je_dois', 'Je dois'], ['on_me_doit', 'On me doit']]} />
      <button onClick={() => openEdit(null)} className="btn-ghost w-full"><Plus size={18} /> {tab === 'je_dois' ? 'Nouvelle dette' : 'Nouvelle créance (on me doit)'}</button>
      {list.length === 0 && <Empty icon="🤝" text={tab === 'je_dois' ? "Aucune dette. Ex : avance MVola, prêt d'un proche, crédit chez l'épicier." : "Personne ne te doit d'argent pour le moment."} />}
      <div className="grid gap-3 lg:grid-cols-2">{open.map((d) => <Card key={d.id} d={d} />)}</div>
      {done.length > 0 && <p className="pt-2 text-sm font-medium text-ink-muted">Soldées</p>}
      <div className="grid gap-3 lg:grid-cols-2">{done.map((d) => <Card key={d.id} d={d} />)}</div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.d ? 'Modifier' : edit?.direction === 'je_dois' ? 'Nouvelle dette' : 'Nouvelle créance'}>
        {edit && (
          <div className="space-y-4">
            <Segmented value={edit.direction} onChange={(v) => setEdit({ ...edit, direction: v })} options={[['je_dois', 'Je dois'], ['on_me_doit', 'On me doit']]} />
            <div><label className="label" htmlFor="debt-person">{edit.direction === 'je_dois' ? 'À qui ?' : 'Qui ?'}</label><input id="debt-person" className="input" placeholder="Ex : Rakoto, MVola Avance, épicerie" value={edit.person} onChange={(e) => setEdit({ ...edit, person: e.target.value })} /></div>
            <div><label className="label" htmlFor="debt-amount">Montant total ({cur})</label><input id="debt-amount" className="input tabular" inputMode="numeric" value={edit.amount} onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, amount: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
            <div><p className="label">Échéance (facultatif)</p><DateField value={edit.due} clearable placeholder="Aucune échéance" onChange={(v) => setEdit({ ...edit, due: v })} /></div>
            <div><label className="label" htmlFor="debt-note">Note</label><input id="debt-note" className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            {edit.d && <p className="text-sm text-ink-muted">Déjà remboursé : <b className="tabular text-ink">{fmt(edit.d.paid, cur)}</b></p>}
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              {edit.d && <button onClick={remove} className={`btn ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>{confirmDel ? 'Confirmer' : 'Supprimer'}</button>}
              <button onClick={save} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!pay} onClose={() => setPay(null)} title={pay ? (pay.d.direction === 'je_dois' ? `Remboursement · ${pay.d.person}` : `Paiement reçu · ${pay.d.person}`) : ''}>
        {pay && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Reste à payer : <b className="tabular text-ink">{fmt(leftOf(pay.d), cur)}</b></p>
            <input className="input tabular text-center text-2xl font-semibold" inputMode="numeric" autoFocus placeholder={`0 ${cur}`} aria-label="Montant" value={pay.amount} onChange={(e) => { const n = parseAmount(e.target.value); setPay({ ...pay, amount: n ? n.toLocaleString('fr-FR') : '' }) }} />
            <button onClick={() => setPay({ ...pay, amount: leftOf(pay.d).toLocaleString('fr-FR') })} className="btn-ghost w-full py-2.5 text-sm">Tout rembourser</button>
            <div><p className="label">Date</p><DateField value={pay.date} onChange={(v) => setPay({ ...pay, date: v })} /></div>
            <div><p className="label">Moyen</p><MethodPicker value={pay.method} onChange={(v) => setPay({ ...pay, method: v })} /></div>
            {isMobileMoney(pay.method) && <RefField value={pay.ref} onChange={(v) => setPay({ ...pay, ref: v })} />}
            <div><label className="label" htmlFor="pay-note">Note</label><input id="pay-note" className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>
            <PhotoPicker files={pay.files} onChange={(f) => setPay({ ...pay, files: f })} />
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <button onClick={repay} disabled={busy} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Valider'}</button>
          </div>
        )}
      </Sheet>

      {(() => {
        const d = detail ? debts.find((x) => x.id === detail.id) ?? detail : null
        return (
          <Sheet open={!!d} onClose={() => setDetail(null)} title={d ? d.person : ''}>
            {d && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-cream-tile p-4">
                  <p className="text-xs text-ink-muted">{d.direction === 'je_dois' ? 'Je dois' : 'On me doit'}{d.due_date ? ` · échéance ${new Date(d.due_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}{d.note ? ` · ${d.note}` : ''}</p>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">Total</p><p className="tabular whitespace-nowrap text-sm font-semibold">{fmt(d.amount, cur)}</p></div>
                    <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">{d.direction === 'je_dois' ? 'Remboursé' : 'Reçu'}</p><p className="tabular text-sm font-semibold text-emerald-600">{fmt(d.paid, cur)}</p></div>
                    <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">Reste</p><p className="tabular text-sm font-semibold text-red-600">{fmt(leftOf(d), cur)}</p></div>
                  </div>
                  <div className="mt-3"><Progress value={d.paid} max={d.amount} color={d.paid >= d.amount ? '#10B981' : undefined} /></div>
                  <div className="mt-3 flex gap-2">
                    {d.paid < d.amount && <button onClick={() => { setErr(''); setPay({ d, amount: '', date: todayISO(), method: 'especes', ref: '', note: '', files: [] }) }} className="btn-primary flex-1 whitespace-nowrap py-2 text-sm">{d.direction === 'je_dois' ? '+ Remboursement' : '+ Paiement reçu'}</button>}
                    <button onClick={() => openEdit(d)} className="btn-ghost flex-1 bg-white py-2 text-sm"><Pencil size={16} /> Modifier</button>
                  </div>
                </div>
                <MoveHistory carnetId={carnet!.id} entity="debt" entityId={d.id} title={d.direction === 'je_dois' ? 'Historique des remboursements' : 'Historique des paiements reçus'}
                  labels={{ plus: d.direction === 'je_dois' ? 'Remboursement' : 'Paiement reçu', minus: 'Correction' }}
                  rows={payments.filter((p) => p.debt_id === d.id).map((p): HRow => ({ id: p.id, amount: p.amount, date: p.paid_on, method: p.method, ref: p.ref, note: p.note }))}
                  onDelete={async (row) => {
                    await supabase.from('debt_payments').delete().eq('id', row.id)
                    await supabase.from('debts').update({ paid: Math.max(0, d.paid - row.amount) }).eq('id', d.id)
                    await reload()
                  }}
                  onUpdate={async (row, p: HPatch) => {
                    const { error } = await supabase.from('debt_payments').update({ amount: p.amount, paid_on: p.date, method: p.method, ref: p.ref, note: p.note }).eq('id', row.id)
                    if (error) return error.message
                    await supabase.from('debts').update({ paid: Math.min(d.amount, Math.max(0, d.paid + p.amount - row.amount)) }).eq('id', d.id)
                    await reload(); return null
                  }} />
              </div>
            )}
          </Sheet>
        )
      })()}
    </div>
  )
}
