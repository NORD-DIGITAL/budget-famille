import { useMemo, useState } from 'react'
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { openCatHistory, openTx } from '../components/TxDetail'
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
  const [fiche, setFiche] = useState<Budget | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

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
    await reload(); setEdit(null); setFiche(null)
  }

  const Row = ({ b }: { b: Budget }) => {
    const c = b.category_id ? catById.get(b.category_id) : undefined
    const s = b.category_id ? spent.m.get(b.category_id) ?? 0 : spent.total
    const left = b.monthly_amount - s
    const pace = s > b.monthly_amount * dayFrac * 1.1 && left > 0
    return (
      <button onClick={() => setFiche(b)} className="w-full px-3 py-3 text-left">
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

      {(() => {
        const b = fiche ? budgets.find((x) => x.id === fiche.id) ?? null : null
        if (!b) return <Sheet open={false} onClose={() => setFiche(null)}>{null}</Sheet>
        const c = b.category_id ? catById.get(b.category_id) : undefined
        const s = b.category_id ? spent.m.get(b.category_id) ?? 0 : spent.total
        const left = b.monthly_amount - s
        const inBranch = (id: string | null) => { let x = id ? catById.get(id) : undefined; for (let i = 0; x && i < 10; i++) { if (x.id === b.category_id) return true; x = x.parent_id ? catById.get(x.parent_id) : undefined } return false }
        const list = txs.filter((t) => t.kind === 'depense' && t.occurred_on.startsWith(month) && (!b.category_id || inBranch(t.category_id))).sort((a, z) => z.occurred_on.localeCompare(a.occurred_on))
        const close = () => { setFiche(null); setConfirmDel(false) }
        return (
          <Sheet open onClose={close} title={c ? catPath(c.id) : 'Budget global du mois'}>
            <div className="space-y-4">
              <div className="rounded-3xl bg-cream-tile p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">Plafond</p><p className="tabular whitespace-nowrap text-sm font-semibold">{fmt(b.monthly_amount, cur)}</p></div>
                  <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">Dépensé</p><p className="tabular whitespace-nowrap text-sm font-semibold">{fmt(s, cur)}</p></div>
                  <div className="rounded-2xl bg-white p-2"><p className="text-[0.6875rem] text-ink-muted">{left < 0 ? 'Dépassé' : 'Reste'}</p><p className={`tabular whitespace-nowrap text-sm font-semibold ${left < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(Math.abs(left), cur)}</p></div>
                </div>
                <div className="mt-3"><Progress value={s} max={b.monthly_amount} color={c?.color} /></div>
                <p className="mt-2 text-xs text-ink-muted">{monthLabel(month)} · {Math.round((s / Math.max(1, b.monthly_amount)) * 100)} % utilisé{isCurrent ? ` · ${Math.round(dayFrac * 100)} % du mois écoulé` : ''}</p>
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between"><p className="font-semibold">Dépenses du mois</p><p className="text-xs text-ink-muted">{list.length} opération{list.length > 1 ? 's' : ''}</p></div>
                {list.length === 0 && <p className="text-sm text-ink-muted">Aucune dépense ce mois-ci.</p>}
                {list.map((t) => {
                  const tc = t.category_id ? catById.get(t.category_id) : undefined
                  return (
                    <button key={t.id} onClick={() => openTx(t)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-2.5 text-left last:border-0">
                      <IconBubble name={tc?.name ?? ''} icon={tc?.icon ?? '❔'} color={tc?.color ?? 'var(--accent)'} size={32} />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tc?.name ?? 'Sans catégorie'}</p><p className="truncate text-xs text-ink-muted">{new Date(t.occurred_on + 'T00:00:00').toLocaleDateString('fr-FR')}{t.note ? ` · ${t.note}` : ''}</p></div>
                      <span className="tabular text-sm font-semibold">{fmt(t.amount, cur)}</span><ChevronRight size={16} className="text-neutral-400" />
                    </button>
                  )
                })}
                {b.category_id && <button onClick={() => openCatHistory(b.category_id!, 'depense')} className="mt-2 w-full py-2 text-sm text-brand-600">Voir tout l'historique de cette catégorie</button>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEdit({ b, catId: b.category_id, amount: b.monthly_amount.toLocaleString('fr-FR'), mode: b.category_id ? 'cat' : 'global' })} className="btn-ghost flex-1 py-2.5 text-sm"><Pencil size={16} /> Modifier</button>
                <button onClick={async () => { if (!confirmDel) return setConfirmDel(true); await supabase.from('budgets').delete().eq('id', b.id); await reload(); close() }} className={`btn flex-1 py-2.5 text-sm ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><Trash2 size={16} />{confirmDel ? 'Confirmer' : 'Supprimer'}</button>
              </div>
            </div>
          </Sheet>
        )
      })()}
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
