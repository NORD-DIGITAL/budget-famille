import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Mail, Ban, Check, Copy, KeyRound, Search, Share2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { Empty } from '../components/ui'
import { daysLeft, fmtDay, planLabel, PLANS } from './GoCode'
import { ComposeMessage } from './Feedback'

type AdminUser = { id: string; email: string; full_name: string | null; phone: string | null; created_at: string; last_sign_in_at: string | null; expires_at: string | null; codes_pending: number }
type GoCodeRow = { id: string; code: string; days: number; created_at: string; used_at: string | null; revoked: boolean }

function status(u: AdminUser): [string, string] {
  if (!u.expires_at) return ['Jamais activé', 'bg-neutral-100 text-ink-muted']
  const d = daysLeft(u.expires_at)
  if (d === 0) return ['Expiré', 'bg-red-100 text-red-700']
  if (d <= 7) return [`${d} j · bientôt`, 'bg-amber-100 text-amber-800']
  return [`${d} jours`, 'bg-emerald-100 text-emerald-800']
}

/** Section admin « Utilisateurs » : login, nom, jours restants, génération des Go Codes. */
export function UsersPage() {
  const { isAdmin } = useData()
  const [rows, setRows] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<AdminUser | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_users')
    if (error) setErr(error.message); else setRows((data as AdminUser[]) ?? [])
  }, [])
  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])
  const list = useMemo(() => rows.filter((u) => !q || `${u.full_name} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase())), [rows, q])

  if (!isAdmin) return <div className="px-5"><Empty icon="🔒" text="Réservé à l'administrateur." /></div>
  if (sel) return <UserDetail user={sel} onBack={() => { setSel(null); load() }} />

  const active = rows.filter((u) => daysLeft(u.expires_at) > 0).length
  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-cream-tile p-3"><p className="tabular text-2xl font-semibold">{rows.length}</p><p className="text-xs text-ink-muted">comptes</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="tabular text-2xl font-semibold">{active}</p><p className="text-xs text-emerald-700">actifs</p></div>
        <div className="rounded-2xl bg-red-50 p-3"><p className="tabular text-2xl font-semibold">{rows.length - active}</p><p className="text-xs text-red-700">sans accès</p></div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-4"><Search size={18} className="text-ink-muted" />
        <input className="w-full bg-transparent py-3 outline-none" placeholder="Nom, email ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un utilisateur" />
      </div>
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      {list.length === 0 && <Empty icon="👥" text="Aucun utilisateur trouvé." />}
      <div className="grid gap-2 lg:grid-cols-2">
        {list.map((u) => {
          const [label, cls] = status(u)
          return (
            <button key={u.id} onClick={() => setSel(u)} className="tile flex items-center gap-3 p-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white">{(u.full_name || u.email).charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.full_name || 'Sans nom'}</p>
                <p className="truncate text-xs text-ink-muted">{u.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UserDetail({ user, onBack }: { user: AdminUser; onBack: () => void }) {
  const [codes, setCodes] = useState<GoCodeRow[]>([])
  const [fresh, setFresh] = useState<{ code: string; days: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('go_codes').select('id,code,days,created_at,used_at,revoked').eq('user_id', user.id).order('created_at', { ascending: false })
    setCodes((data as GoCodeRow[]) ?? [])
  }, [user.id])
  useEffect(() => { load() }, [load])

  const first = (user.full_name || '').split(' ')[0] || 'Bonjour'
  const message = (c: { code: string; days: number }) =>
    `Bonjour ${first} 👋\nVoici ton Go Code Budget.Go.Family (${planLabel(c.days)}) : ${c.code}\nOuvre l'application, connecte-toi avec ${user.email}, puis entre ce code. Il ne fonctionne qu'une fois et uniquement sur ton compte.\n— NORD DIGITAL`

  const generate = async (days: number) => {
    setBusy(true); setErr(''); setCopied(false)
    const { data, error } = await supabase.rpc('admin_create_go_code', { p_user: user.id, p_days: days })
    setBusy(false)
    if (error) return setErr(error.message)
    const c = { code: data as string, days }
    setFresh(c); load()
    try { await navigator.clipboard.writeText(message(c)); setCopied(true) } catch { /* copie manuelle */ }
  }
  const copy = async (c: { code: string; days: number }) => { try { await navigator.clipboard.writeText(message(c)); setCopied(true) } catch { setErr('Copie impossible : sélectionne le code à la main.') } }
  const share = async (c: { code: string; days: number }) => {
    const text = message(c)
    try { if (navigator.share) await navigator.share({ text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank') } catch { /* annulé */ }
  }
  const revoke = async (id: string) => { if (confirm !== id) return setConfirm(id); await supabase.rpc('admin_revoke_go_code', { p_id: id }); setConfirm(null); load() }
  const [label, cls] = status(user)

  return (
    <div className="space-y-5 px-5 pb-8 pt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-muted"><ArrowLeft size={16} /> Tous les utilisateurs</button>
      <div className="tile space-y-1 p-4">
        <p className="text-lg font-semibold">{user.full_name || 'Sans nom'}</p>
        <p className="text-sm">{user.email}</p>
        {user.phone && <p className="tabular text-sm text-ink-soft">{user.phone}</p>}
        <p className="text-xs text-ink-muted">Inscrit le {fmtDay(user.created_at)}{user.last_sign_in_at ? ` · dernière connexion le ${fmtDay(user.last_sign_in_at)}` : ''}</p>
        <div className="flex items-center gap-2 pt-2">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${cls}`}>{label}</span>
          {user.expires_at && <span className="text-xs text-ink-muted">{daysLeft(user.expires_at) > 0 ? "jusqu'au" : 'depuis le'} {fmtDay(user.expires_at)}</span>}
        </div>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><KeyRound size={18} /> Générer un Go Code</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLANS.map((p) => <button key={p.days} disabled={busy} onClick={() => generate(p.days)} className="btn-primary py-3">{p.label}</button>)}
        </div>
        <p className="mt-2 text-xs text-ink-muted">Le code est réservé à ce compte, utilisable une seule fois. Les jours s'ajoutent à ceux qui restent.</p>
      </section>

      {fresh && (
        <div className="space-y-3 rounded-3xl bg-ink p-5 text-center text-white">
          <p className="text-sm text-white/70">Nouveau Go Code · {planLabel(fresh.days)}</p>
          <p className="tabular select-all text-3xl font-bold tracking-[0.2em] text-sun-500">{fresh.code}</p>
          <p className="text-xs text-white/70">{copied ? 'Message copié ✔ — colle-le dans WhatsApp ou SMS.' : 'Copie le message et envoie-le au client.'}</p>
          <div className="flex gap-2">
            <button onClick={() => copy(fresh)} className="btn flex-1 bg-white text-ink"><Copy size={18} /> Copier</button>
            <button onClick={() => share(fresh)} className="btn flex-1 bg-sun-500 text-ink"><Share2 size={18} /> Envoyer</button>
          </div>
        </div>
      )}
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Historique des codes</h2>
        {codes.length === 0 && <p className="text-sm text-ink-muted">Aucun code généré pour ce compte.</p>}
        {codes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-neutral-100 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className={`tabular font-semibold tracking-wider ${c.revoked ? 'line-through opacity-50' : ''}`}>{c.code}</p>
              <p className="text-xs text-ink-muted">{planLabel(c.days)} · créé le {fmtDay(c.created_at)}</p>
            </div>
            {c.used_at ? <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-800"><Check size={12} /> utilisé le {new Date(c.used_at).toLocaleDateString('fr-FR')}</span>
              : c.revoked ? <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-ink-muted">annulé</span>
              : (
                <div className="flex gap-1">
                  <button onClick={() => copy(c)} aria-label="Copier le message" className="rounded-full p-2 text-ink-muted"><Copy size={16} /></button>
                  <button onClick={() => revoke(c.id)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${confirm === c.id ? 'bg-red-500 text-white' : 'text-red-600'}`}><Ban size={14} />{confirm === c.id ? 'Confirmer' : 'Annuler'}</button>
                </div>
              )}
          </div>
        ))}
      </section>
      <section className="rounded-3xl border border-cream-line bg-cream-tile p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Mail size={18} /> Envoyer un message</h2>
        <ComposeMessage to={{ id: user.id, name: user.full_name || user.email }} />
      </section>
      <p className="flex items-center gap-2 text-xs text-ink-muted"><Users size={14} /> Le client voit son compteur de jours dans Compte.</p>
    </div>
  )
}
