import { useState } from 'react'
import { Plus, Copy, Check, Lock, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { COLORS, fmt, parseAmount } from '../lib/format'
import type { Kind } from '../lib/types'
import { BareIcon, ICON_SET, IconBubble, Segmented, Sheet } from '../components/ui'

type Item = { id?: string; name: string; icon: string; color: string; balance: string; archived: boolean; kind?: Kind }

function ItemSheet({ item, setItem, onSave, withIcon, withColor, withBalance, cur, onDelete, deleteWarning }: {
  item: Item | null; setItem: (i: Item | null) => void; onSave: () => void
  withIcon?: boolean; withColor?: boolean; withBalance?: boolean; cur: string; onDelete?: () => void; deleteWarning?: string
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <Sheet open={!!item} onClose={() => setItem(null)} title={item?.id ? 'Modifier' : 'Ajouter'}>
      {item && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {withIcon && <input aria-label="Icône (emoji)" className="input w-16 text-center text-2xl" value={item.icon} onChange={(e) => setItem({ ...item, icon: [...e.target.value].slice(-1).join('') })} />}
            <input className="input flex-1" placeholder="Nom" autoFocus={!item.id} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
          </div>
          {withIcon && <p className="-mt-1 text-xs text-neutral-400">Touche la case de gauche et choisis un emoji au clavier.</p>}
          {withColor && (
            <div>
              <p className="label">Couleur</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => <button key={c} aria-label={c} onClick={() => setItem({ ...item, color: c })} className={`h-8 w-8 rounded-full ring-offset-2 ${item.color === c ? 'ring-2 ring-neutral-800' : ''}`} style={{ background: c }} />)}
              </div>
            </div>
          )}
          {withBalance && (
            <div>
              <label className="label">Solde de départ ({cur})</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setItem({ ...item, balance: item.balance.startsWith('-') ? item.balance.slice(1) : '-' + item.balance })} className="btn-ghost w-12 px-0">±</button>
                <input className="input flex-1" inputMode="numeric" value={item.balance}
                  onChange={(e) => { const neg = e.target.value.trim().startsWith('-'); const n = parseAmount(e.target.value); setItem({ ...item, balance: (neg ? '-' : '') + (n ? n.toLocaleString('fr-FR') : '') }) }} />
              </div>
            </div>
          )}
          {item.id && (
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" checked={item.archived} onChange={(e) => setItem({ ...item, archived: e.target.checked })} className="h-4 w-4" />
              Masquer (archivé — l'historique est conservé)
            </label>
          )}
          {onDelete && confirmDel && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{deleteWarning}</p>}
          <div className="flex gap-2">
            {onDelete && (
              <button type="button" onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))} className={`btn ${confirmDel ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
                <Trash2 size={18} />{confirmDel ? 'Confirmer' : ''}
              </button>
            )}
            <button onClick={onSave} disabled={!item.name.trim()} className="btn-primary flex-1">Enregistrer</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

type CatEdit = { id?: string; name: string; icon: string; color: string; archived: boolean; parent_id: string | null; unit: string }

export function CategoriesPage() {
  const { categories, carnet, reload, childrenOf, catById } = useData()
  const [kind, setKind] = useState<Kind>('depense')
  const [item, setItem] = useState<CatEdit | null>(null)
  const [lockedMsg, setLockedMsg] = useState('')
  const roots = (childrenOf.get(null) ?? []).filter((c) => c.kind === kind)

  const depth = (id: string | null) => { let d = 0; let c = id ? catById.get(id) : undefined; while (c?.parent_id) { d++; c = catById.get(c.parent_id) } return d }
  const isDesc = (id: string, of: string): boolean => { let c = catById.get(id); while (c?.parent_id) { if (c.parent_id === of) return true; c = catById.get(c.parent_id) } return false }
  const parentOptions = categories.filter((c) => c.kind === kind && depth(c.id) < 2 && c.id !== item?.id && !(item?.id && isDesc(c.id, item.id)))

  const save = async () => {
    if (!item || !item.name.trim()) return
    const parent = item.parent_id ? catById.get(item.parent_id) : undefined
    const row = { name: item.name.trim(), icon: item.icon || '📦', color: parent ? parent.color : item.color, archived: item.archived, parent_id: item.parent_id, unit: item.unit.trim() || null }
    if (item.id) await supabase.from('categories').update(row).eq('id', item.id)
    else await supabase.from('categories').insert({ ...row, kind, carnet_id: carnet!.id, position: (childrenOf.get(item.parent_id)?.length ?? 0) + 1 })
    await reload(); setItem(null)
  }
  const edit = (c: (typeof categories)[number]) => c.is_default ? setLockedMsg(`« ${c.name} » est une catégorie de base : elle ne peut pas être modifiée. Tu peux lui ajouter des sous-catégories.`) : setItem({ id: c.id, name: c.name, icon: c.icon, color: c.color, archived: c.archived, parent_id: c.parent_id, unit: c.unit ?? '' })

  const renderRow = (c: (typeof categories)[number], lvl: number): React.ReactNode => (
    <div key={c.id}>
      <button onClick={() => edit(c)} className={`flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left ${c.archived ? 'opacity-40' : ''}`} style={{ paddingLeft: lvl * 28 }}>
        {lvl === 0 ? <IconBubble name={c.name} icon={c.icon} color={c.color} size={40} /> : <BareIcon name={c.name} emoji={c.icon} size={22} />}
        <span className={`flex-1 ${lvl === 0 ? 'font-medium' : 'text-[15px]'}`}>{c.name}</span>
        {c.unit && <span className="pill py-0.5 text-xs">{c.unit.replace('|', ' / ')}</span>}
        {c.is_default ? <Lock size={14} className="text-neutral-300" /> : <span className="pill py-0.5 text-xs">Perso</span>}
      </button>
      {(childrenOf.get(c.id) ?? []).map((k) => renderRow(k, lvl + 1))}
    </div>
  )

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <Segmented value={kind} onChange={setKind} options={[['depense', 'Dépenses'], ['revenu', 'Revenus']]} />
      <p className="text-xs text-ink-muted"><Lock size={12} className="mr-1 inline" />Catégories de base (non modifiables) · <b>Perso</b> : créées par toi, modifiables.</p>
      {lockedMsg && <p className="rounded-2xl bg-sun-100 px-4 py-3 text-sm" onClick={() => setLockedMsg('')}>{lockedMsg}</p>}
      <div>{roots.map((c) => renderRow(c, 0))}</div>
      <button onClick={() => setItem({ name: '', icon: 'i:Package', color: COLORS[roots.length % COLORS.length], archived: false, parent_id: null, unit: '' })} className="btn-ghost w-full"><Plus size={18} /> Ajouter une catégorie</button>

      <Sheet open={!!item} onClose={() => setItem(null)} title={item?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        {item && (
          <div className="space-y-4">
            <input className="input" placeholder="Nom de la catégorie" aria-label="Nom" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
            <div>
              <p className="label">Icône</p>
              <div className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-2xl border border-cream-line bg-cream-tile p-2">
                {Object.entries(ICON_SET).map(([n, I]) => (
                  <button key={n} type="button" aria-label={n} onClick={() => setItem({ ...item, icon: 'i:' + n })}
                    className={`flex aspect-square items-center justify-center rounded-xl transition ${item.icon === 'i:' + n ? 'bg-sun-500' : 'bg-white'}`}>
                    <I size={22} strokeWidth={1.6} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="cat-parent">Ranger dans</label>
              <select id="cat-parent" className="input" value={item.parent_id ?? ''} onChange={(e) => setItem({ ...item, parent_id: e.target.value || null })}>
                <option value="">— Catégorie principale —</option>
                {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `   ${catById.get(c.parent_id)?.name} › ` : ''}{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cat-unit">Unité de quantité (facultatif)</label>
              <input id="cat-unit" className="input" placeholder="Ex : kg, litre, kapoaka (plusieurs : kg|kapoaka)" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} />
              <p className="mt-1 text-xs text-ink-muted">Avec une unité, la saisie demande la quantité et calcule le prix unitaire (comme pour le Vary).</p>
            </div>
            {!item.parent_id && (
              <div>
                <p className="label">Couleur</p>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => <button key={c} aria-label={c} onClick={() => setItem({ ...item, color: c })} className={`h-8 w-8 rounded-full ring-offset-2 ${item.color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} />)}
                </div>
              </div>
            )}
            {item.id && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={item.archived} onChange={(e) => setItem({ ...item, archived: e.target.checked })} className="h-4 w-4" />
                Masquer (l'historique est conservé)
              </label>
            )}
            <button onClick={save} disabled={!item.name.trim()} className="btn-primary w-full">Enregistrer</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export function AccountsPage() {
  const { accounts, carnet, reload, cur } = useData()
  const [item, setItem] = useState<Item | null>(null)
  const save = async () => {
    if (!item) return
    const bal = (item.balance.startsWith('-') ? -1 : 1) * parseAmount(item.balance)
    const row = { name: item.name.trim(), icon: item.icon || '💵', initial_balance: bal, archived: item.archived }
    if (item.id) await supabase.from('accounts').update(row).eq('id', item.id)
    else await supabase.from('accounts').insert({ ...row, carnet_id: carnet!.id })
    await reload(); setItem(null)
  }
  const fmtBal = (n: number) => (n < 0 ? '-' : '') + (n ? Math.abs(n).toLocaleString('fr-FR') : '')
  return (
    <div className="space-y-4 p-4">
      <div className="card divide-y divide-neutral-100">
        {accounts.map((a) => (
          <button key={a.id} onClick={() => setItem({ id: a.id, name: a.name, icon: a.icon, color: '', balance: fmtBal(a.initial_balance), archived: a.archived })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${a.archived ? 'opacity-40' : ''}`}>
            <IconBubble name={a.name} icon={a.icon} color="#8b5cf6" size={36} /><span className="flex-1 font-medium">{a.name}</span>
            <span className="text-xs text-neutral-400">départ {fmt(a.initial_balance, cur)}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setItem({ name: '', icon: '💳', color: '', balance: '', archived: false })} className="btn-ghost w-full"><Plus size={18} /> Ajouter un compte</button>
      <ItemSheet item={item} setItem={setItem} onSave={save} withIcon withBalance cur={cur} />
    </div>
  )
}

export function MembersPage() {
  const { members, carnet, reload, cur } = useData()
  const [item, setItem] = useState<Item | null>(null)
  const save = async () => {
    if (!item) return
    const row = { name: item.name.trim(), color: item.color, archived: item.archived }
    if (item.id) await supabase.from('members').update(row).eq('id', item.id)
    else await supabase.from('members').insert({ ...row, carnet_id: carnet!.id })
    await reload(); setItem(null)
  }
  const moiId = (members.find((m) => m.name.trim().toLowerCase() === 'moi') ?? members[0])?.id
  const remove = async () => {
    if (!item?.id || item.id === moiId) return
    await supabase.from('members').delete().eq('id', item.id)
    await reload(); setItem(null)
  }
  return (
    <div className="space-y-4 p-4">
      <p className="px-1 text-sm text-neutral-500">Les membres servent à noter qui a payé ou reçu. Ils n'ont pas besoin d'avoir l'application.</p>
      <div className="card divide-y divide-neutral-100">
        {members.map((m) => (
          <button key={m.id} onClick={() => setItem({ id: m.id, name: m.name, icon: '', color: m.color, balance: '', archived: m.archived })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${m.archived ? 'opacity-40' : ''}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</div>
            <span className="flex-1 font-medium">{m.name}</span>
            {m.id === moiId && <span className="text-xs text-ink-muted">toi · non supprimable</span>}
          </button>
        ))}
      </div>
      <button onClick={() => setItem({ name: '', icon: '', color: COLORS[(members.length + 5) % COLORS.length], balance: '', archived: false })} className="btn-ghost w-full"><Plus size={18} /> Ajouter un membre</button>
      <ItemSheet key={item?.id ?? 'new'} item={item} setItem={setItem} onSave={save} withColor cur={cur}
        onDelete={item?.id && item.id !== moiId ? remove : undefined}
        deleteWarning={`Supprimer « ${item?.name ?? ''} » ? Ses opérations sont conservées mais n'auront plus de membre.`} />
    </div>
  )
}

export function SharePage() {
  const { carnet, carnets, loadCarnet, switchCarnet } = useData()
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(carnet?.name ?? '')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(carnet!.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  const rename = async () => {
    if (!name.trim()) return
    await supabase.from('carnets').update({ name: name.trim() }).eq('id', carnet!.id)
    await loadCarnet(); setMsg({ t: 'ok', s: 'Nom du carnet enregistré.' })
  }
  const join = async () => {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('join_carnet', { p_code: code })
    setBusy(false)
    if (error) return setMsg({ t: 'err', s: error.message.includes('invalide') ? 'Code invalide. Vérifie les 8 caractères.' : error.message })
    await loadCarnet(); switchCarnet(data as string); setCode('')
    setMsg({ t: 'ok', s: 'Carnet rejoint ! Tu vois maintenant ses opérations.' })
  }

  return (
    <div className="space-y-6 px-5 pb-8 pt-2">
      <section className="tile space-y-3 p-5 text-center">
        <p className="text-sm text-ink-muted">Code du carnet « {carnet?.name} »</p>
        <p className="tabular text-3xl font-bold tracking-[0.3em]">{carnet?.invite_code}</p>
        <button onClick={copy} className="btn-primary mx-auto py-2.5">{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copié' : 'Copier le code'}</button>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Comment ça marche</h2>
        <ol className="space-y-2 text-[15px] text-ink-soft">
          <li><b>1.</b> Envoie ce code à ton conjoint ou à un proche (WhatsApp, SMS…).</li>
          <li><b>2.</b> Il installe l'app et crée son propre compte (son email, son mot de passe).</li>
          <li><b>3.</b> Il ouvre <b>Compte › Famille & partage</b> et tape le code dans « Rejoindre le carnet d'un proche ».</li>
          <li><b>4.</b> Vous voyez et remplissez le même carnet, chacun depuis son téléphone.</li>
        </ol>
        <p className="text-xs text-ink-muted">Garde ce code pour ta famille : toute personne qui l'a peut voir et modifier le carnet.</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Rejoindre le carnet d'un proche</h2>
        <div className="flex gap-2">
          <input className="input tabular flex-1 text-center uppercase tracking-[0.25em]" placeholder="CODE" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Code du carnet à rejoindre" />
          <button disabled={busy || code.trim().length < 8} onClick={join} className="btn-dark">Rejoindre</button>
        </div>
      </section>

      {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}

      {carnets.length > 1 && (
        <section>
          <h2 className="section-title mb-2">Mes carnets</h2>
          {carnets.map((c) => (
            <button key={c.id} onClick={() => { switchCarnet(c.id); setName(c.name); setMsg(null) }}
              className="flex w-full items-center gap-3 border-b border-neutral-100 py-3.5 text-left last:border-0">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full font-semibold ${c.id === carnet?.id ? 'bg-sun-500' : 'bg-cream-tile border border-cream-line'}`}>{c.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-ink-muted">{c.role === 'proprietaire' ? 'Créé par toi' : 'Rejoint'} · {c.members} personne{(c.members ?? 0) > 1 ? 's' : ''}</p>
              </div>
              {c.id === carnet?.id ? <span className="pill">Ouvert</span> : <span className="text-sm text-ink-muted">Ouvrir</span>}
            </button>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <label className="label" htmlFor="carnet-name">Nom du carnet</label>
        <div className="flex gap-2"><input id="carnet-name" className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} /><button onClick={rename} className="btn-ghost">OK</button></div>
      </section>
    </div>
  )
}
