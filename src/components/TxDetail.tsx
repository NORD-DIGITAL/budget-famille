import { useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt } from '../lib/format'
import type { Kind, Tx } from '../lib/types'
import { IconTile, Sheet } from './ui'
import { fmtDateLong, fmtMonthLong } from './DatePicker'

/* ---------- Petite mémoire partagée : fiche d'opération et historique de catégorie ---------- */
type Sel = { type: 'cat'; id: string; kind: Kind } | { type: 'acc' | 'mem'; id: string }
type State = { tx: Tx | null; cat: Sel | null }
let state: State = { tx: null, cat: null }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()) }
const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)

/** Ouvre la fiche détaillée d'une opération (lecture, avec Modifier / Supprimer). */
export const openTx = (t: Tx) => set({ tx: t })
/** Ouvre l'historique d'une catégorie (et de ses sous-catégories). */
export const openCatHistory = (id: string, kind: Kind) => set({ cat: { type: 'cat', id, kind } })
/** Historique d'un compte ou d'un membre. */
export const openAccHistory = (id: string) => set({ cat: { type: 'acc', id } })
export const openMemHistory = (id: string) => set({ cat: { type: 'mem', id } })

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-ink-muted">{label}</span><span className="text-right font-medium">{value}</span>
    </div>
  )
}

/** Fenêtres globales : à placer une seule fois dans l'application. */
export function TxDetailHost({ onEdit }: { onEdit: (t: Tx) => void }) {
  const { tx, cat } = useStore()
  return (
    <>
      <CatHistorySheet sel={cat} onClose={() => set({ cat: null })} />
      <TxDetailSheet tx={tx} onClose={() => set({ tx: null })} onEdit={(t) => { set({ tx: null }); onEdit(t) }} />
    </>
  )
}

function TxDetailSheet({ tx, onClose, onEdit }: { tx: Tx | null; onClose: () => void; onEdit: (t: Tx) => void }) {
  const { catById, catPath, accById, memById, cur, reload, txs } = useData()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  // Toujours la version la plus récente (après une modification)
  const t = tx ? txs.find((x) => x.id === tx.id) ?? tx : null
  const close = () => { setConfirm(false); onClose() }
  const remove = async () => {
    if (!t) return
    if (!confirm) return setConfirm(true)
    setBusy(true)
    await supabase.from('transactions').delete().eq('id', t.id)
    await reload(); setBusy(false); close()
  }
  const c = t?.category_id ? catById.get(t.category_id) : undefined
  const rev = t?.kind === 'revenu'
  return (
    <Sheet open={!!t} onClose={close} title="Détail de l'opération">
      {t && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-cream-tile p-5 text-center">
            <IconTile name={c?.name ?? ''} emoji={c?.icon} color={c?.color} size={56} />
            <p className="text-sm text-ink-muted">{catPath(t.category_id) || 'Sans catégorie'}</p>
            <p className={`tabular text-3xl font-bold ${rev ? 'text-emerald-600' : ''}`}>{rev ? '+' : '−'}{fmt(t.amount, cur)}</p>
            <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${rev ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
              {rev ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{rev ? 'Revenu' : 'Dépense'}
            </span>
          </div>
          <div>
            <Line label="Date" value={fmtDateLong(t.occurred_on)} />
            <Line label="Compte" value={t.account_id ? accById.get(t.account_id)?.name : null} />
            <Line label="Par" value={t.member_id ? memById.get(t.member_id)?.name : null} />
            <Line label="Quantité" value={t.quantity ? `${String(t.quantity).replace('.', ',')} ${t.unit ?? ''}` : null} />
            <Line label="Mois concerné" value={t.for_month ? fmtMonthLong(t.for_month) : null} />
            <Line label="Enfant(s)" value={t.child_name} />
            <Line label="Pour qui" value={t.beneficiary} />
            <Line label="Référence" value={t.ref} />
            <Line label="Note" value={t.note} />
            <Line label="Enregistrée le" value={new Date(t.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(t)} className="btn-ghost flex-1 py-2.5 text-sm"><Pencil size={16} /> Modifier</button>
            <button onClick={remove} disabled={busy} className={`btn flex-1 py-2.5 text-sm ${confirm ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
              <Trash2 size={16} />{busy ? '…' : confirm ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function CatHistorySheet({ sel, onClose }: { sel: Sel | null; onClose: () => void }) {
  const { txs, catById, childrenOf, month, cur, accById, memById, catPath } = useData()
  const [allMonths, setAllMonths] = useState(false)
  const [sub, setSub] = useState<string | null>(null)
  const isCat = sel?.type === 'cat'
  const root = isCat && sel ? catById.get(sel.id) : undefined
  const title = !sel ? '' : sel.type === 'cat' ? root?.name ?? 'Historique' : sel.type === 'acc' ? `Compte ${accById.get(sel.id)?.name ?? ''}` : `Opérations de ${memById.get(sel.id)?.name ?? ''}`
  const close = () => { setAllMonths(false); setSub(null); onClose() }

  // Toutes les catégories de la branche
  const branch = useMemo(() => {
    const out = new Set<string>()
    const walk = (id: string) => { out.add(id); for (const ch of childrenOf.get(id) ?? []) walk(ch.id) }
    if (sel && sel.type === 'cat') walk(sel.id)
    return out
  }, [sel, childrenOf])
  const subOf = (catId: string | null) => {
    let c = catId ? catById.get(catId) : undefined
    while (c?.parent_id && c.parent_id !== sel?.id) c = catById.get(c.parent_id)
    return c && c.id !== sel?.id ? c.id : sel?.id ?? ''
  }
  const base = useMemo(() => txs.filter((t) => sel && (allMonths || t.occurred_on.startsWith(month)) && (
    sel.type === 'cat' ? t.kind === sel.kind && !!t.category_id && branch.has(t.category_id) : sel.type === 'acc' ? t.account_id === sel.id : t.member_id === sel.id)),
    [txs, sel, branch, allMonths, month])
  const subsTotals = useMemo(() => {
    const m = new Map<string, number>()
    if (isCat) for (const t of base) { const k = subOf(t.category_id); m.set(k, (m.get(k) ?? 0) + t.amount) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])
  const list = base.filter((t) => !sub || subOf(t.category_id) === sub)
  const signedAmt = (t: Tx) => (isCat ? t.amount : t.kind === 'revenu' ? t.amount : -t.amount)
  const total = list.reduce((a, t) => a + signedAmt(t), 0)
  const inc = list.filter((t) => t.kind === 'revenu').reduce((a, t) => a + t.amount, 0)
  const exp = list.filter((t) => t.kind === 'depense').reduce((a, t) => a + t.amount, 0)
  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>()
    for (const t of list) { const k = allMonths ? t.occurred_on.slice(0, 7) : t.occurred_on; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t) }
    return [...m.entries()]
  }, [list, allMonths])

  return (
    <Sheet open={!!sel} onClose={close} title={title}>
      {sel && (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
            <button onClick={() => setAllMonths(false)} className={`flex-1 rounded-full py-2 text-sm ${!allMonths ? 'bg-ink text-white' : 'text-ink-muted'}`}>{fmtMonthLong(month)}</button>
            <button onClick={() => setAllMonths(true)} className={`flex-1 rounded-full py-2 text-sm ${allMonths ? 'bg-ink text-white' : 'text-ink-muted'}`}>Tout l'historique</button>
          </div>
          <div className="rounded-2xl bg-ink p-4 text-white">
            <p className="text-sm text-white/70">{sub ? catById.get(sub)?.name ?? '' : sel.type === 'cat' ? `Total ${sel.kind === 'depense' ? 'des dépenses' : 'des revenus'}` : 'Solde des opérations'} · {list.length} opération{list.length > 1 ? 's' : ''}</p>
            <p className="tabular text-2xl font-bold">{isCat ? fmt(total, cur) : `${total > 0 ? '+' : total < 0 ? '−' : ''}${fmt(Math.abs(total), cur)}`}</p>
            {!isCat && <p className="tabular mt-1 text-xs text-white/70">Revenus {fmt(inc, cur)} · Dépenses {fmt(exp, cur)}</p>}
          </div>
          {subsTotals.length > 1 && (
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
              <button onClick={() => setSub(null)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${!sub ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>Tout</button>
              {subsTotals.map(([id, v]) => (
                <button key={id} onClick={() => setSub(sub === id ? null : id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${sub === id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
                  {id === sel.id ? 'Général' : catById.get(id)?.name} · <span className="tabular">{fmt(v, cur)}</span>
                </button>
              ))}
            </div>
          )}
          {list.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Aucune opération{allMonths ? '' : ' ce mois-ci'}.</p>}
          {groups.map(([k, items]) => (
            <div key={k}>
              <p className="mb-1 flex items-center justify-between text-xs text-ink-muted">
                <span className="flex items-center gap-1"><CalendarDays size={12} />{allMonths ? fmtMonthLong(k) : fmtDateLong(k)}</span>
                <span className="tabular">{fmt(Math.abs(items.reduce((a, t) => a + signedAmt(t), 0)), cur)}</span>
              </p>
              {items.map((t) => {
                const c = t.category_id ? catById.get(t.category_id) : undefined
                return (
                  <button key={t.id} onClick={() => openTx(t)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-2.5 text-left last:border-0">
                    <IconTile name={c?.name ?? ''} emoji={c?.icon} color={c?.color} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c?.name}</p>
                      <p className="truncate text-xs text-ink-muted">{[allMonths ? t.occurred_on.split('-').reverse().slice(0, 2).join('/') : null, isCat ? catPath(t.category_id).split(' › ').slice(1, -1).join(' › ') || null : catPath(t.category_id).split(' › ')[0] || null, t.quantity ? `${String(t.quantity).replace('.', ',')} ${t.unit ?? ''}` : null, sel.type !== 'acc' && t.account_id ? accById.get(t.account_id)?.name : null, sel.type !== 'mem' && t.member_id ? memById.get(t.member_id)?.name : null, t.note].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`tabular shrink-0 text-sm font-semibold ${!isCat && t.kind === 'revenu' ? 'text-emerald-600' : ''}`}>{!isCat ? (t.kind === 'revenu' ? '+' : '−') : ''}{fmt(t.amount, cur)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
