import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { daysInMonth, fmt, monthKey, monthLabel, parseAmount } from '../lib/format'
import type { Budget, Goal } from '../lib/types'
import { Empty, IconBubble, Progress, Sheet } from '../components/ui'

export function BudgetPage() {
  const { budgets, categories, txs, month, catById, cur, carnet, reload } = useData()
  const [edit, setEdit] = useState<{ b: Budget | null; catId: string | null; amount: string; mode: 'global' | 'cat' } | null>(null)
  const [err, setErr] = useState('')

  const spent = useMemo(() => {
    const m = new Map<string | null, number>()
    let total = 0
    for (const t of txs) if (t.kind === 'depense' && t.occurred_on.startsWith(month)) {
      total += t.amount
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + t.amount)
    }
    return { m, total }
  }, [txs, month])

  const global = budgets.find((b) => !b.category_id)
  const perCat = budgets.filter((b) => b.category_id)
  const isCurrent = month === monthKey(new Date())
  const dayFrac = isCurrent ? new Date().getDate() / daysInMonth(month) : 1

  const save = async () => {
    if (!edit) return
    const amt = parseAmount(edit.amount)
    if (!amt) return setErr('Montant requis.')
    if (edit.mode === 'cat' && !edit.catId) return setErr('Choisis une catégorie.')
    setErr('')
    const { error } = edit.b
      ? await supabase.from('budgets').update({ monthly_amount: amt, category_id: edit.catId }).eq('id', edit.b.id)
      : await supabase.from('budgets').insert({ carnet_id: carnet!.id, category_id: edit.catId, monthly_amount: amt })
    if (error) return setErr(error.code === '23505' ? 'Un budget existe déjà pour cette catégorie.' : error.message)
    await reload(); setEdit(null)
  }
  const remove = async () => {
    if (!edit?.b) return
    await supabase.from('budgets').delete().eq('id', edit.b.id)
    await reload(); setEdit(null)
  }

  const Row = ({ b }: { b: Budget }) => {
    const c = b.category_id ? catById.get(b.category_id) : undefined
    const s = b.category_id ? spent.m.get(b.category_id) ?? 0 : spent.total
    const left = b.monthly_amount - s
    const pace = s > b.monthly_amount * dayFrac * 1.1 && left > 0
    return (
      <button onClick={() => setEdit({ b, catId: b.category_id, amount: b.monthly_amount.toLocaleString('fr-FR'), mode: b.category_id ? 'cat' : 'global' })} className="w-full px-3 py-3 text-left">
        <div className="mb-2 flex items-center gap-3">
          <IconBubble name={c?.name ?? ''} icon={c?.icon ?? '💰'} color={c?.color ?? '#FFCC00'} size={36} />
          <div className="flex-1">
            <p className="font-medium">{c?.name ?? 'Budget global du mois'}</p>
            <p className={`text-xs ${left < 0 ? 'text-red-600' : pace ? 'text-amber-600' : 'text-neutral-400'}`}>
              {left < 0 ? `Dépassé de ${fmt(-left, cur)}` : `Reste ${fmt(left, cur)}${pace ? ' · rythme trop rapide' : ''}`}
            </p>
          </div>
          <div className="text-right text-sm"><p className="font-semibold">{fmt(s, cur)}</p><p className="text-xs text-neutral-400">/ {fmt(b.monthly_amount, cur)}</p></div>
        </div>
        <Progress value={s} max={b.monthly_amount} color={pace ? '#f59e0b' : c?.color} />
      </button>
    )
  }

  const usedCats = new Set(perCat.map((b) => b.category_id))
  return (
    <div className="space-y-4 p-4">
      <p className="px-1 text-sm text-neutral-500">{monthLabel(month)} — budgets mensuels, reconduits chaque mois.</p>
      {global ? <div className="card"><Row b={global} /></div> : (
        <button onClick={() => setEdit({ b: null, catId: null, amount: '', mode: 'global' })} className="card flex w-full items-center gap-3 p-4 text-left text-brand-600"><Plus size={20} /> Définir un budget global mensuel</button>
      )}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-semibold">Par catégorie</h2>
        <button onClick={() => setEdit({ b: null, catId: categories.find((c) => c.kind === 'depense' && !usedCats.has(c.id))?.id ?? null, amount: '', mode: 'cat' })} className="flex items-center gap-1 text-sm font-medium text-brand-600"><Plus size={16} /> Ajouter</button>
      </div>
      {perCat.length === 0 ? <Empty icon="🎯" text="Fixe un plafond pour les catégories à surveiller (Alimentation, Transport…)." /> : (
        <div className="card divide-y divide-neutral-100">{perCat.map((b) => <Row key={b.id} b={b} />)}</div>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.b ? 'Modifier le budget' : 'Nouveau budget'}>
        {edit && (
          <div className="space-y-3">
            {edit.mode === 'cat' && (
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={edit.catId ?? ''} onChange={(e) => setEdit({ ...edit, catId: e.target.value || null })}>
                  <option value="">Choisir…</option>
                  {categories.filter((c) => c.kind === 'depense' && !c.archived && (!usedCats.has(c.id) || c.id === edit.b?.category_id)).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Montant mensuel ({cur})</label>
              <input className="input text-lg font-semibold" inputMode="numeric" autoFocus value={edit.amount}
                onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, amount: n ? n.toLocaleString('fr-FR') : '' }) }} />
            </div>
            {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              {edit.b && <button onClick={remove} className="btn bg-red-50 text-red-600">Supprimer</button>}
              <button onClick={save} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export function GoalsPage() {
  const { goals, cur, carnet, reload } = useData()
  const [edit, setEdit] = useState<{ g: Goal | null; name: string; icon: string; target: string; deadline: string } | null>(null)
  const [add, setAdd] = useState<{ g: Goal; amount: string; sign: 1 | -1 } | null>(null)

  const save = async () => {
    if (!edit) return
    const target = parseAmount(edit.target)
    if (!edit.name.trim() || !target) return
    const row = { name: edit.name.trim(), icon: edit.icon || '🎯', target_amount: target, deadline: edit.deadline || null }
    if (edit.g) await supabase.from('savings_goals').update(row).eq('id', edit.g.id)
    else await supabase.from('savings_goals').insert({ ...row, carnet_id: carnet!.id })
    await reload(); setEdit(null)
  }
  const remove = async () => {
    if (!edit?.g || !confirm('Supprimer cet objectif ?')) return
    await supabase.from('savings_goals').delete().eq('id', edit.g.id)
    await reload(); setEdit(null)
  }
  const deposit = async () => {
    if (!add) return
    const n = parseAmount(add.amount)
    if (!n) return
    await supabase.from('savings_goals').update({ saved_amount: Math.max(0, add.g.saved_amount + add.sign * n) }).eq('id', add.g.id)
    await reload(); setAdd(null)
  }

  const monthsLeft = (d: string) => {
    const now = new Date(), end = new Date(d + 'T00:00:00')
    return Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth())
  }

  return (
    <div className="space-y-4 p-4">
      <button onClick={() => setEdit({ g: null, name: '', icon: '🎯', target: '', deadline: '' })} className="card flex w-full items-center gap-3 p-4 text-left font-medium text-brand-600"><Plus size={20} /> Nouvel objectif d'épargne</button>
      {goals.length === 0 && <Empty icon="🐷" text="Ex : Rentrée scolaire, moto, fête de fin d'année…" />}
      {goals.map((g) => {
        const left = g.target_amount - g.saved_amount
        const done = left <= 0
        return (
          <div key={g.id} className="card p-4">
            <button onClick={() => setEdit({ g, name: g.name, icon: g.icon, target: g.target_amount.toLocaleString('fr-FR'), deadline: g.deadline ?? '' })} className="mb-3 flex w-full items-center gap-3 text-left">
              <IconBubble icon={g.icon} color="#FFCC00" size={44} />
              <div className="flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-neutral-400">
                  {done ? 'Objectif atteint 🎉' : g.deadline ? `${fmt(Math.ceil(left / monthsLeft(g.deadline)), cur)} / mois jusqu'au ${new Date(g.deadline + 'T00:00:00').toLocaleDateString('fr-FR')}` : `Reste ${fmt(left, cur)}`}
                </p>
              </div>
              <span className="text-sm font-semibold">{Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100))}%</span>
            </button>
            <Progress value={g.saved_amount} max={g.target_amount} color="#FFCC00" />
            <div className="mt-2 flex justify-between text-sm"><span className="font-semibold">{fmt(g.saved_amount, cur)}</span><span className="text-neutral-400">{fmt(g.target_amount, cur)}</span></div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setAdd({ g, amount: '', sign: 1 })} className="btn-primary flex-1 py-2 text-sm">+ Épargner</button>
              <button onClick={() => setAdd({ g, amount: '', sign: -1 })} className="btn-ghost py-2 text-sm">Retirer</button>
            </div>
          </div>
        )
      })}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.g ? "Modifier l'objectif" : 'Nouvel objectif'}>
        {edit && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input className="input w-16 text-center text-2xl" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: [...e.target.value].slice(-1).join('') })} aria-label="Icône" />
              <input className="input flex-1" placeholder="Nom" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div><label className="label">Montant visé ({cur})</label><input className="input" inputMode="numeric" value={edit.target} onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, target: n ? n.toLocaleString('fr-FR') : '' }) }} /></div>
            <div><label className="label">Échéance (optionnel)</label><input type="date" className="input" value={edit.deadline} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} /></div>
            <div className="flex gap-2">
              {edit.g && <button onClick={remove} className="btn bg-red-50 text-red-600">Supprimer</button>}
              <button onClick={save} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!add} onClose={() => setAdd(null)} title={add?.sign === 1 ? `Épargner · ${add?.g.name}` : `Retirer · ${add?.g.name}`}>
        {add && (
          <div className="space-y-3">
            <input className="input text-center text-2xl font-bold" inputMode="numeric" autoFocus placeholder={`0 ${cur}`} value={add.amount} onChange={(e) => { const n = parseAmount(e.target.value); setAdd({ ...add, amount: n ? n.toLocaleString('fr-FR') : '' }) }} />
            <button onClick={deposit} className="btn-primary w-full">Valider</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
