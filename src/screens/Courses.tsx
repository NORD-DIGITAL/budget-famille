import { useMemo, useState } from 'react'
import { Check, ClipboardCheck, Plus, RotateCcw, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import type { ShoppingItem, ShoppingList } from '../lib/types'
import { BareIcon, Empty, Sheet } from '../components/ui'
import { DateField } from '../components/DatePicker'
import { RefField } from '../components/Money'

const STATUS: Record<ShoppingList['status'], [string, string]> = {
  brouillon: ['En préparation', 'bg-sun-100'], prete: ['Liste prête · aux courses', 'bg-sky-100 text-sky-800'],
  terminee: ['Achat effectué', 'bg-emerald-100 text-emerald-800'], annulee: ['Annulée', 'bg-neutral-100 text-ink-muted'],
}
const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`
const listName = (d: string) => `Courses du ${new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
const fmtNum = (v: string) => { const n = parseAmount(v); return n ? n.toLocaleString('fr-FR') : '' }

export function CoursesPage() {
  const { lists, items, cur, carnet, reload } = useData()
  const [openId, setOpenId] = useState<string | null>(null)
  const [showOld, setShowOld] = useState(false)
  const active = lists.filter((l) => l.status === 'brouillon' || l.status === 'prete')
  const old = lists.filter((l) => l.status === 'terminee' || l.status === 'annulee')
  const current = lists.find((l) => l.id === openId)
  const totalOf = (id: string, k: 'est_price' | 'final_price') => items.filter((i) => i.list_id === id && !i.cancelled).reduce((a, i) => a + (i[k] ?? 0), 0)

  const [newDate, setNewDate] = useState<string | null>(null)
  const create = async () => {
    const d = newDate ?? todayISO()
    const { data } = await supabase.from('shopping_lists').insert({ carnet_id: carnet!.id, name: listName(d), planned_on: d }).select('id').single()
    setNewDate(null); await reload(); if (data) setOpenId(data.id)
  }

  if (current) return <ListView list={current} onBack={() => setOpenId(null)} />

  const Card = ({ l }: { l: ShoppingList }) => {
    const n = items.filter((i) => i.list_id === l.id && !i.cancelled).length
    const [label, cls] = STATUS[l.status]
    return (
      <button onClick={() => setOpenId(l.id)} className="tile flex w-full items-center gap-3 p-4 text-left">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white"><ShoppingCart size={24} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{l.name}</p>
          <p className="text-xs text-ink-muted">{l.planned_on ? `${new Date(l.planned_on + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ` : ''}{n} article{n > 1 ? 's' : ''} · <span className={`rounded-full px-2 py-0.5 ${cls}`}>{label}</span></p>
        </div>
        <p className="tabular text-right font-semibold">{fmt(l.status === 'terminee' ? totalOf(l.id, 'final_price') : totalOf(l.id, 'est_price'), cur)}</p>
      </button>
    )
  }

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <p className="text-sm text-ink-muted">Prépare ta liste avec des prix provisoires, valide-la, puis finalise l'achat une fois au marché : chaque article devient une dépense.</p>
      <button onClick={() => setNewDate(todayISO())} className="btn-primary w-full"><Plus size={18} /> Nouvelle liste de courses</button>
      <Sheet open={!!newDate} onClose={() => setNewDate(null)} title="Nouvelle liste de courses">
        {newDate && (
          <div className="space-y-4">
            <div><p className="label">Date des courses</p><DateField value={newDate} onChange={setNewDate} /></div>
            <p className="text-sm text-ink-muted">Cette date sera proposée comme date des dépenses au moment de finaliser (tu pourras la changer).</p>
            <button onClick={create} className="btn-primary w-full">Créer la liste</button>
          </div>
        )}
      </Sheet>
      {active.length === 0 && <Empty icon="🛒" text="Aucune liste en cours." />}
      <div className="grid gap-3 lg:grid-cols-2">{active.map((l) => <Card key={l.id} l={l} />)}</div>
      {old.length > 0 && (
        <>
          <button onClick={() => setShowOld(!showOld)} className="w-full py-2 text-sm text-ink-muted">{showOld ? 'Masquer' : 'Voir'} l'historique ({old.length})</button>
          {showOld && <div className="grid gap-3 lg:grid-cols-2">{old.map((l) => <Card key={l.id} l={l} />)}</div>}
        </>
      )}
    </div>
  )
}

type ItemEdit = { item: ShoppingItem | null; catId: string | null; label: string; qty: string; unit: string; price: string; q: string }

function ListView({ list, onBack }: { list: ShoppingList; onBack: () => void }) {
  const { items: all, categories, catById, catPath, cur, carnet, reload, accounts, members } = useData()
  const items = all.filter((i) => i.list_id === list.id)
  const live = items.filter((i) => !i.cancelled)
  const est = live.reduce((a, i) => a + (i.est_price ?? 0), 0)
  const taken = live.filter((i) => i.taken)
  const real = taken.reduce((a, i) => a + (i.final_price ?? i.est_price ?? 0), 0)
  const [edit, setEdit] = useState<ItemEdit | null>(null)
  const [fin, setFin] = useState<{ prices: Record<string, string>; checked: boolean; acc: string | null; mem: string | null; date: string; ref: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const draft = list.status === 'brouillon', ready = list.status === 'prete', closed = !draft && !ready

  const cats = useMemo(() => categories.filter((c) => c.kind === 'depense' && !c.archived)
    .map((c) => ({ c, path: catPath(c.id) })).sort((a, b) => a.path.localeCompare(b.path, 'fr')), [categories, catPath])

  const upd = async (id: string, patch: Partial<ShoppingItem>) => { await supabase.from('shopping_items').update(patch).eq('id', id); await reload() }
  const setStatus = async (status: ShoppingList['status'], extra: Record<string, unknown> = {}) => { await supabase.from('shopping_lists').update({ status, ...extra }).eq('id', list.id); await reload() }

  const saveItem = async () => {
    if (!edit) return
    if (!edit.catId) return setErr('Choisis ce que tu achètes.')
    const row = { category_id: edit.catId, label: edit.label.trim() || null, quantity: Number(edit.qty.replace(',', '.')) || null, unit: edit.qty ? edit.unit || null : null, est_price: parseAmount(edit.price) || null }
    if (edit.item) await supabase.from('shopping_items').update(row).eq('id', edit.item.id)
    else await supabase.from('shopping_items').insert({ ...row, carnet_id: carnet!.id, list_id: list.id, position: items.length })
    await reload(); setEdit(null)
  }
  const openItem = (i: ShoppingItem | null) => {
    setErr('')
    setEdit(i ? { item: i, catId: i.category_id, label: i.label ?? '', qty: i.quantity ? String(i.quantity).replace('.', ',') : '', unit: i.unit ?? '', price: i.est_price ? i.est_price.toLocaleString('fr-FR') : '', q: '' }
      : { item: null, catId: null, label: '', qty: '', unit: '', price: '', q: '' })
  }

  const finalize = async () => {
    if (!fin) return
    if (!fin.checked) return setErr('Coche la case pour confirmer que tu as vérifié les prix.')
    const lines = taken.map((i) => ({ i, price: parseAmount(fin.prices[i.id] ?? '') })).filter((x) => x.price > 0)
    if (!lines.length) return setErr('Aucun article pris avec un prix.')
    setBusy(true)
    const accName = accounts.find((a) => a.id === fin.acc)?.name ?? ''
    const rows = lines.map(({ i, price }) => ({
      carnet_id: carnet!.id, kind: 'depense', amount: price, category_id: i.category_id, account_id: fin.acc, member_id: fin.mem, occurred_on: fin.date,
      note: [i.label, `Courses : ${list.name}`].filter(Boolean).join(' · '), quantity: i.quantity, unit: i.quantity ? i.unit : null,
      ref: /mvola|orange/i.test(accName) && fin.ref.trim() ? fin.ref.trim().toUpperCase() : null,
    }))
    const { error } = await supabase.from('transactions').insert(rows)
    if (!error) {
      for (const { i, price } of lines) await supabase.from('shopping_items').update({ final_price: price }).eq('id', i.id)
      await setStatus('terminee', { finished_at: new Date().toISOString(), account_id: fin.acc, member_id: fin.mem })
    }
    setBusy(false)
    if (error) return setErr(error.message)
    const roots = [...new Set(lines.map(({ i }) => catPath(i.category_id).split(' › ')[0]).filter(Boolean))]
    setDone(`${lines.length} dépense${lines.length > 1 ? 's' : ''} ajoutée${lines.length > 1 ? 's' : ''} le ${new Date(fin.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${roots.join(', ')}.`)
    setFin(null)
  }

  const [label, cls] = STATUS[list.status]
  const sel = edit?.catId ? catById.get(edit.catId) : undefined
  const unitOpts = sel?.unit ? sel.unit.split('|') : []

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <button onClick={onBack} className="text-sm text-ink-muted">‹ Toutes les listes</button>
      <div className="rounded-3xl bg-sun-500 p-5">
        <p className="text-lg font-semibold">{list.name}</p>
        <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs ${cls}`}>{label}</span>
        {!closed && (
          <div className="mt-3"><p className="mb-1 text-xs">Date des courses</p>
            <DateField className="bg-white/80 py-2.5" value={list.planned_on ?? list.created_at.slice(0, 10)}
              onChange={(d) => setStatus(list.status, { planned_on: d, ...(/^Courses du /.test(list.name) ? { name: listName(d) } : {}) })} /></div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs">Total prévu</p><p className="tabular text-lg font-semibold">{fmt(est, cur)}</p></div>
          <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs">{closed ? 'Total payé' : 'Dans le panier'}</p><p className="tabular text-lg font-semibold">{fmt(closed ? live.reduce((a, i) => a + (i.final_price ?? 0), 0) : real, cur)}</p></div>
        </div>
        {ready && <p className="mt-2 text-xs">{taken.length} / {live.length} articles pris</p>}
      </div>

      {done && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✔ {done} Retrouve-les dans Opérations du mois et dans Graphiques.</p>}
      {items.length === 0 && <Empty icon="📝" text="Ajoute les articles à acheter (Vary, Hena, Menaka…) avec un prix provisoire." />}
      <div>
        {items.map((i) => {
          const c = i.category_id ? catById.get(i.category_id) : undefined
          return (
            <div key={i.id} className={`flex items-center gap-3 border-b border-neutral-100 py-3 last:border-0 ${i.cancelled ? 'opacity-40' : ''}`}>
              {ready && !i.cancelled ? (
                <button onClick={() => upd(i.id, { taken: !i.taken, final_price: i.final_price ?? i.est_price })} aria-label={i.taken ? 'Retirer du panier' : 'Mettre dans le panier'}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${i.taken ? 'border-sun-500 bg-sun-500' : 'border-neutral-300'}`}>{i.taken && <Check size={18} />}</button>
              ) : <BareIcon name={c?.name ?? ''} emoji={c?.icon} size={26} />}
              <button disabled={closed || i.cancelled} onClick={() => openItem(i)} className="min-w-0 flex-1 text-left">
                <p className={`truncate font-medium ${i.cancelled ? 'line-through' : ''}`}>{i.label || c?.name || 'Article'}</p>
                <p className="truncate text-xs text-ink-muted">{[c ? catPath(c.id) : null, i.quantity ? `${String(i.quantity).replace('.', ',')} ${i.unit ?? ''}` : null].filter(Boolean).join(' · ')}</p>
              </button>
              {ready && i.taken && !i.cancelled ? (
                <PriceInput value={i.final_price} onSave={(v) => upd(i.id, { final_price: v })} />
              ) : <span className="tabular text-sm font-semibold">{fmt((closed ? i.final_price : i.est_price) ?? 0, cur)}</span>}
              {!closed && (
                <button onClick={() => upd(i.id, { cancelled: !i.cancelled, taken: false })} aria-label={i.cancelled ? "Remettre l'article" : "Annuler l'article"} className="rounded-full p-2 text-neutral-400">
                  {i.cancelled ? <RotateCcw size={18} /> : <X size={18} />}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!closed && <button onClick={() => openItem(null)} className="btn-ghost w-full"><Plus size={18} /> Ajouter un article</button>}

      {draft && <button disabled={!live.length} onClick={() => setStatus('prete', { validated_at: new Date().toISOString() })} className="btn-primary w-full"><ClipboardCheck size={18} /> Valider : liste prête</button>}
      {ready && (
        <div className="space-y-2">
          <button disabled={!taken.length} onClick={() => { setErr(''); setFin({ prices: Object.fromEntries(taken.map((i) => [i.id, (i.final_price ?? i.est_price ?? 0) ? (i.final_price ?? i.est_price)!.toLocaleString('fr-FR') : ''])), checked: false, acc: accounts.find((a) => !a.archived)?.id ?? null, mem: members.find((m) => !m.archived)?.id ?? null, date: list.planned_on ?? todayISO(), ref: '' }) }}
            className="btn-primary w-full"><Check size={18} /> Finaliser : achat effectué</button>
          <button onClick={() => setStatus('brouillon')} className="w-full py-2 text-sm text-ink-muted">Revenir à la préparation</button>
        </div>
      )}
      {!closed && (
        <button onClick={async () => { if (!confirmCancel) return setConfirmCancel(true); await setStatus('annulee'); onBack() }}
          className={`btn w-full ${confirmCancel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><Trash2 size={18} />{confirmCancel ? 'Confirmer : annuler toute la course' : 'Annuler la course'}</button>
      )}

      {/* Ajout / modification d'un article */}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.item ? "Modifier l'article" : 'Ajouter un article'}>
        {edit && (
          <div className="space-y-4">
            {sel ? (
              <button onClick={() => setEdit({ ...edit, catId: null })} className="flex w-full items-center gap-3 rounded-2xl border border-sun-500 bg-sun-100 p-3 text-left">
                <BareIcon name={sel.name} emoji={sel.icon} size={24} /><span className="flex-1 text-sm font-medium">{catPath(sel.id)}</span><span className="text-xs text-ink-muted">changer</span>
              </button>
            ) : (
              <div>
                <div className="mb-2 flex items-center gap-2 rounded-2xl border border-neutral-200 px-3"><Search size={18} className="text-ink-muted" />
                  <input className="w-full bg-transparent py-3 outline-none" placeholder="Chercher : vary, hena, lait…" value={edit.q} onChange={(e) => setEdit({ ...edit, q: e.target.value })} aria-label="Chercher une catégorie" />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {cats.filter((x) => !edit.q || x.path.toLowerCase().includes(edit.q.toLowerCase())).map(({ c, path }) => (
                    <button key={c.id} onClick={() => setEdit({ ...edit, catId: c.id, unit: c.unit?.split('|')[0] ?? '' })} className="flex w-full items-center gap-3 border-b border-neutral-100 py-2.5 text-left last:border-0">
                      <BareIcon name={c.name} emoji={c.icon} size={20} /><span className="text-sm">{path}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div><label className="label" htmlFor="it-label">Précision (facultatif)</label><input id="it-label" className="input" placeholder="Ex : Makalioka, 1 poulet, marque…" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="it-qty">Quantité</label>
                <input id="it-qty" className="input tabular" inputMode="decimal" placeholder="Ex : 5" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value.replace(/[^\d.,]/g, '') })} />
              </div>
              <div>
                <label className="label" htmlFor="it-unit">Unité</label>
                {unitOpts.length ? (
                  <div className="flex gap-1">{unitOpts.map((u) => <button key={u} type="button" onClick={() => setEdit({ ...edit, unit: u })} className={chip(edit.unit === u)}>{u}</button>)}</div>
                ) : <input id="it-unit" className="input" placeholder="kg, pièce, litre…" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />}
              </div>
            </div>
            <div><label className="label" htmlFor="it-price">Prix provisoire ({cur})</label><input id="it-price" className="input tabular" inputMode="numeric" value={edit.price} onChange={(e) => setEdit({ ...edit, price: fmtNum(e.target.value) })} /></div>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <button onClick={saveItem} className="btn-primary w-full">{edit.item ? 'Enregistrer' : 'Ajouter à la liste'}</button>
          </div>
        )}
      </Sheet>

      {/* Finalisation avec vérification des prix */}
      <Sheet open={!!fin} onClose={() => setFin(null)} title="Vérifier et finaliser">
        {fin && (
          <div className="space-y-4">
            <p className="rounded-2xl bg-sun-100 px-4 py-3 text-sm">Vérifie le <b>prix réel</b> de chaque article. Chaque article devient directement une <b>dépense</b> dans sa catégorie, à la date choisie.</p>
            <div><p className="label">Date de l'achat (date des dépenses)</p><DateField value={fin.date} onChange={(v) => setFin({ ...fin, date: v })} /></div>
            <div>
              {taken.map((i) => {
                const c = i.category_id ? catById.get(i.category_id) : undefined
                return (
                  <div key={i.id} className="flex items-center gap-3 border-b border-neutral-100 py-2.5 last:border-0">
                    <BareIcon name={c?.name ?? ''} emoji={c?.icon} size={22} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.label || c?.name}</p><p className="tabular text-xs text-ink-muted">prévu {fmt(i.est_price ?? 0, cur)}</p></div>
                    <input className="input tabular w-32 py-2 text-right" inputMode="numeric" aria-label={`Prix réel de ${i.label || c?.name}`} value={fin.prices[i.id] ?? ''} onChange={(e) => setFin({ ...fin, prices: { ...fin.prices, [i.id]: fmtNum(e.target.value) } })} />
                  </div>
                )
              })}
            </div>
            <p className="flex justify-between font-semibold"><span>Total</span><span className="tabular">{fmt(Object.values(fin.prices).reduce((a, v) => a + parseAmount(v), 0), cur)}</span></p>
            {live.length > taken.length && <p className="text-xs text-ink-muted">{live.length - taken.length} article(s) non pris ne seront pas comptés.</p>}
            <div><p className="label">Payé avec</p><div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">{accounts.filter((a) => !a.archived).map((a) => <button key={a.id} onClick={() => setFin({ ...fin, acc: a.id })} className={chip(fin.acc === a.id)}>{a.name}</button>)}</div></div>
            {/mvola|orange/i.test(accounts.find((a) => a.id === fin.acc)?.name ?? '') && <RefField value={fin.ref} onChange={(v) => setFin({ ...fin, ref: v })} />}
            <div><p className="label">Payé par</p><div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">{members.filter((m) => !m.archived).map((m) => <button key={m.id} onClick={() => setFin({ ...fin, mem: m.id })} className={chip(fin.mem === m.id)}>{m.name}</button>)}</div></div>
            <label className="flex items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile px-4 py-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-ink" checked={fin.checked} onChange={(e) => setFin({ ...fin, checked: e.target.checked })} /> J'ai vérifié les prix
            </label>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <button onClick={finalize} disabled={busy || !fin.checked} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Finaliser la course'}</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** Prix modifiable, enregistré quand on quitte le champ (pas à chaque chiffre). */
function PriceInput({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value ? value.toLocaleString('fr-FR') : '')
  return (
    <input className="input tabular w-28 py-2 text-right text-sm" inputMode="numeric" aria-label="Prix réel" value={v}
      onChange={(e) => setV(fmtNum(e.target.value))} onBlur={() => { const n = parseAmount(v) || null; if (n !== value) onSave(n) }} />
  )
}
