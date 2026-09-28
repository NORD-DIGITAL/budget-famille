import { useState } from 'react'
import { Plus, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { COLORS, fmt, parseAmount } from '../lib/format'
import type { Kind } from '../lib/types'
import { IconBubble, Sheet } from '../components/ui'

type Item = { id?: string; name: string; icon: string; color: string; balance: string; archived: boolean; kind?: Kind }

function ItemSheet({ item, setItem, onSave, withIcon, withColor, withBalance, cur }: {
  item: Item | null; setItem: (i: Item | null) => void; onSave: () => void
  withIcon?: boolean; withColor?: boolean; withBalance?: boolean; cur: string
}) {
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
          <button onClick={onSave} disabled={!item.name.trim()} className="btn-primary w-full">Enregistrer</button>
        </div>
      )}
    </Sheet>
  )
}

export function CategoriesPage() {
  const { categories, carnet, reload, cur } = useData()
  const [kind, setKind] = useState<Kind>('depense')
  const [item, setItem] = useState<Item | null>(null)
  const list = categories.filter((c) => c.kind === kind)

  const save = async () => {
    if (!item) return
    const row = { name: item.name.trim(), icon: item.icon || '📦', color: item.color, archived: item.archived }
    if (item.id) await supabase.from('categories').update(row).eq('id', item.id)
    else await supabase.from('categories').insert({ ...row, kind, carnet_id: carnet!.id, position: list.length + 1 })
    await reload(); setItem(null)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/60 p-1">
        {(['depense', 'revenu'] as Kind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-lg py-1.5 text-sm font-semibold ${kind === k ? 'bg-white shadow' : 'text-neutral-500'}`}>{k === 'depense' ? 'Dépenses' : 'Revenus'}</button>
        ))}
      </div>
      <div className="card divide-y divide-neutral-100">
        {list.map((c) => (
          <button key={c.id} onClick={() => setItem({ id: c.id, name: c.name, icon: c.icon, color: c.color, balance: '', archived: c.archived })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${c.archived ? 'opacity-40' : ''}`}>
            <IconBubble name={c.name} icon={c.icon} color={c.color} size={36} /><span className="flex-1 font-medium">{c.name}</span>
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
          </button>
        ))}
      </div>
      <button onClick={() => setItem({ name: '', icon: '📦', color: COLORS[list.length % COLORS.length], balance: '', archived: false })} className="btn-ghost w-full"><Plus size={18} /> Ajouter une catégorie</button>
      <ItemSheet item={item} setItem={setItem} onSave={save} withIcon withColor cur={cur} />
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
  return (
    <div className="space-y-4 p-4">
      <p className="px-1 text-sm text-neutral-500">Les membres servent à noter qui a payé ou reçu. Ils n'ont pas besoin d'avoir l'application.</p>
      <div className="card divide-y divide-neutral-100">
        {members.map((m) => (
          <button key={m.id} onClick={() => setItem({ id: m.id, name: m.name, icon: '', color: m.color, balance: '', archived: m.archived })} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${m.archived ? 'opacity-40' : ''}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white" style={{ background: m.color }}>{m.name.charAt(0).toUpperCase()}</div>
            <span className="flex-1 font-medium">{m.name}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setItem({ name: '', icon: '', color: COLORS[(members.length + 5) % COLORS.length], balance: '', archived: false })} className="btn-ghost w-full"><Plus size={18} /> Ajouter un membre</button>
      <ItemSheet item={item} setItem={setItem} onSave={save} withColor cur={cur} />
    </div>
  )
}

export function SharePage() {
  const { carnet, session, loadCarnet } = useData()
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(carnet?.name ?? '')
  const copy = async () => {
    try { await navigator.clipboard.writeText(carnet!.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  const rename = async () => {
    if (!name.trim()) return
    await supabase.from('carnets').update({ name: name.trim() }).eq('id', carnet!.id)
    await loadCarnet()
  }
  return (
    <div className="space-y-4 p-4">
      <div className="card space-y-3 p-5 text-center">
        <p className="text-sm text-neutral-500">Code d'invitation du carnet</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-brand-600">{carnet?.invite_code}</p>
        <button onClick={copy} className="btn-ghost mx-auto">{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copié' : 'Copier'}</button>
        <p className="text-xs text-neutral-400">Ton conjoint ou un proche installe l'app, crée son compte, puis choisit « Rejoindre un carnet » avec ce code. Vous verrez les mêmes données en temps réel.</p>
      </div>
      <div className="card space-y-3 p-5">
        <label className="label">Nom du carnet</label>
        <div className="flex gap-2"><input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} /><button onClick={rename} className="btn-primary">OK</button></div>
      </div>
      <div className="card space-y-2 p-5">
        <p className="text-sm text-neutral-500">Connecté en tant que</p>
        <p className="font-medium">{session?.user.email}</p>
        {session?.user.user_metadata?.phone_local && <p className="text-sm text-neutral-500">📱 {session.user.user_metadata.phone_local}</p>}
        <button onClick={() => supabase.auth.signOut()} className="btn w-full bg-red-50 text-red-600">Se déconnecter</button>
      </div>
    </div>
  )
}
