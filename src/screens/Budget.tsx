import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { daysInMonth, fmt, monthKey, monthLabel, parseAmount } from '../lib/format'
import type { Budget } from '../lib/types'
import { Empty, IconBubble, Progress, Sheet } from '../components/ui'
import { RecurringSection } from '../components/Recurring'

export function BudgetPage() {
  const { budgets, categories, txs, month, catById, cur, carnet, reload, catPath } = useData()
  const [edit, setEdit] = useState<{ b: Budget | null; catId: string | null; amount: string; mode: 'global' | 'cat' } | null>(null)
  const [err, setErr] = useState('')

  const spent = useMemo(() => {
    const m = new Map<string | null, number>()
    let total = 0
    for (const t of txs) if (t.kind === 'depense' && t.occurred_on.startsWith(month)) {
      total += t.amount
      // cumul sur la catégorie et toutes ses catégories parentes
      let c = t.category_id ? catById.get(t.category_id) : undefined
      for (let i = 0; c && i < 10; i++) { m.set(c.id, (m.get(c.id) ?? 0) + t.amount); c = c.parent_id ? catById.get(c.parent_id) : undefined }
    }
    return { m, total }
  }, [txs, month, catById])

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
          <IconBubble name={c?.name ?? ''} icon={c?.icon ?? '💰'} color={c?.color ?? 'var(--accent)'} size={36} />
          <div className="flex-1">
            <p className="font-medium">{c ? catPath(c.id) : 'Budget global du mois'}</p>
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
      <p className="px-1 text-sm text-neutral-500">{monthLabel(month)} — plafonds de dépenses, reconduits chaque mois. Les dépenses fixes sont plus bas.</p>
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

      <RecurringSection />

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.b ? 'Modifier le budget' : 'Nouveau budget'}>
        {edit && (
          <div className="space-y-3">
            {edit.mode === 'cat' && (
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={edit.catId ?? ''} onChange={(e) => setEdit({ ...edit, catId: e.target.value || null })}>
                  <option value="">Choisir…</option>
                  {categories.filter((c) => c.kind === 'depense' && !c.archived && (!usedCats.has(c.id) || c.id === edit.b?.category_id)).sort((a, b) => catPath(a.id).localeCompare(catPath(b.id), 'fr')).map((c) => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}
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
