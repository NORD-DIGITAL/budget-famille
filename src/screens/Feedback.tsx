import { useCallback, useEffect, useState } from 'react'
import { Inbox, Lightbulb, Lock, Megaphone, Send, Trash2, UserRound } from 'lucide-react'
import { markAllRead, refreshInbox, useInbox } from '../lib/inbox'
import type { AdminMessage } from '../lib/inbox'
import { APP_LABEL } from '../lib/version'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import type { Feedback } from '../lib/types'
import { Empty, Segmented } from '../components/ui'

const KINDS: [Feedback['kind'], string][] = [['amelioration', 'Amélioration'], ['probleme', 'Problème'], ['autre', 'Autre']]
const STATUS: Record<Feedback['status'], [string, string]> = { nouveau: ['Nouveau', 'bg-sun-100'], lu: ['Lu', 'bg-sky-100 text-sky-800'], traite: ['Traité', 'bg-emerald-100 text-emerald-800'] }
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Formulaire « Remarque / suggestion » + mes envois. */
export function FeedbackPage() {
  const { session, profile } = useData()
  const me = userInfo(session, profile)
  const [kind, setKind] = useState<Feedback['kind']>('amelioration')
  const [text, setText] = useState('')
  const [mine, setMine] = useState<Feedback[]>([])
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const { data } = await supabase.from('feedback').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false })
    setMine((data as Feedback[]) ?? [])
  }, [session])
  useEffect(() => { load() }, [load])

  const send = async () => {
    if (text.trim().length < 3) return setMsg({ t: 'err', s: 'Écris ta remarque (quelques mots au moins).' })
    setBusy(true)
    const { error } = await supabase.from('feedback').insert({ kind, message: text.trim(), sender_name: me.name, app_version: APP_LABEL })
    setBusy(false)
    if (error) return setMsg({ t: 'err', s: error.message })
    setText(''); setMsg({ t: 'ok', s: "Merci ! Ta remarque a bien été envoyée à l'équipe NORD DIGITAL." }); load()
  }

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <div className="flex gap-3 rounded-2xl bg-sun-100 p-4 text-sm"><Lightbulb size={20} className="mt-0.5 shrink-0" /><p>Une idée pour améliorer l'application, un problème ? Écris-le ici : il arrive directement à l'équipe.</p></div>
      <Segmented value={kind} onChange={setKind} options={KINDS} />
      <textarea className="input min-h-[8rem] resize-y" placeholder="Ex : ajouter une catégorie « Église », afficher le total par semaine…" aria-label="Ta remarque" value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} />
      {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
      <button onClick={send} disabled={busy} className="btn-primary w-full"><Send size={18} /> {busy ? 'Envoi…' : 'Envoyer'}</button>
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Mes envois</h2>
          {mine.map((f) => (
            <div key={f.id} className="border-b border-neutral-100 py-3 last:border-0">
              <div className="mb-1 flex items-center justify-between text-xs text-ink-muted"><span>{when(f.created_at)} · {KINDS.find(([k]) => k === f.kind)?.[1]}</span><span className={`rounded-full px-2 py-0.5 ${STATUS[f.status][1]}`}>{STATUS[f.status][0]}</span></div>
              <p className="whitespace-pre-wrap text-sm">{f.message}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/** Boîte de réception réservée au compte administrateur. */
export function InboxPage() {
  const { isAdmin } = useData()
  const [tab, setTab] = useState<'recus' | 'envoyer'>('recus')
  if (!isAdmin) return <MessagesPage />
  return (
    <div>
      <div className="px-5 pt-2"><Segmented value={tab} onChange={setTab} options={[['recus', 'Remarques reçues'], ['envoyer', 'Messages aux utilisateurs']]} /></div>
      {tab === 'recus' ? <FeedbackInbox /> : <AdminSend />}
    </div>
  )
}

function FeedbackInbox() {
  const { isAdmin, session } = useData()
  const [filter, setFilter] = useState<'tous' | Feedback['status']>('nouveau')
  const [rows, setRows] = useState<Feedback[]>([])
  const [confirm, setConfirm] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(500)
    setRows((data as Feedback[]) ?? [])
  }, [])
  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])
  if (!isAdmin) return <div className="px-5"><Empty icon="🔒" text="Réservé à l'administrateur." /></div>

  const setStatus = async (id: string, status: Feedback['status']) => { await supabase.from('feedback').update({ status }).eq('id', id); load(); refreshInbox(session!.user.id, true) }
  const remove = async (id: string) => { if (confirm !== id) return setConfirm(id); await supabase.from('feedback').delete().eq('id', id); setConfirm(null); load() }
  const list = rows.filter((r) => filter === 'tous' || r.status === filter)
  const count = (s: Feedback['status']) => rows.filter((r) => r.status === s).length

  return (
    <div className="space-y-4 px-5 pb-8 pt-2">
      <div className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-white"><Inbox size={22} className="text-sun-500" /><p className="text-sm">{count('nouveau')} nouvelle{count('nouveau') > 1 ? 's' : ''} · {rows.length} au total</p></div>
      <Segmented value={filter} onChange={setFilter} options={[['nouveau', `Nouveaux (${count('nouveau')})`], ['lu', 'Lus'], ['traite', 'Traités'], ['tous', 'Tous']]} />
      {list.length === 0 && <Empty icon="📭" text="Rien ici pour le moment." />}
      {list.map((f) => (
        <div key={f.id} className="tile space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{f.sender_name || 'Utilisateur'}</p>
              <p className="truncate text-xs text-ink-muted">{f.sender_email} · {when(f.created_at)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS[f.status][1]}`}>{KINDS.find(([k]) => k === f.kind)?.[1]}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{f.message}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {(['nouveau', 'lu', 'traite'] as Feedback['status'][]).map((s) => (
              <button key={s} onClick={() => setStatus(f.id, s)} className={`rounded-full border px-3 py-1.5 text-xs ${f.status === s ? 'border-ink bg-ink text-white' : 'border-cream-line bg-white'}`}>{STATUS[s][0]}</button>
            ))}
            <button onClick={() => remove(f.id)} className={`ml-auto rounded-full px-3 py-1.5 text-xs ${confirm === f.id ? 'bg-red-500 text-white' : 'text-red-600'}`}><Trash2 size={14} className="mr-1 inline" />{confirm === f.id ? 'Confirmer' : 'Supprimer'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const day = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Boîte de réception de chaque compte : messages de l'administrateur, en lecture seule. */
export function MessagesPage() {
  const { session } = useData()
  const { messages, read, ready } = useInbox()
  const [fresh] = useState(() => new Set(messages.filter((m) => !read.has(m.id)).map((m) => m.id)))
  const [seen, setSeen] = useState(fresh)
  useEffect(() => {
    refreshInbox(session!.user.id, false).then(() => markAllRead(session!.user.id))
  }, [session])
  // Les messages arrivés pendant le chargement gardent aussi l'étiquette « Nouveau »
  useEffect(() => { setSeen((s) => { const n = new Set(s); for (const m of messages) if (!read.has(m.id)) n.add(m.id); return n }) }, [messages, read])
  return (
    <div className="space-y-3 px-5 pb-8 pt-2">
      <div className="flex gap-3 rounded-2xl bg-sun-100 p-4 text-sm"><Lock size={18} className="mt-0.5 shrink-0" /><p>Messages de l'équipe <b>NORD DIGITAL</b>. Cette boîte est en lecture seule : pour nous écrire, utilise « Remarque / suggestion ».</p></div>
      {ready && messages.length === 0 && <Empty icon="📭" text="Aucun message pour le moment." />}
      {messages.map((m) => (
        <article key={m.id} className={`rounded-2xl border p-4 ${seen.has(m.id) ? 'border-sun-500 bg-sun-50' : 'border-cream-line bg-white'}`}>
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-muted">
            {m.to_user ? <UserRound size={14} /> : <Megaphone size={14} />}<span>{m.to_user ? 'Message personnel' : 'Annonce à tous'} · {day(m.created_at)}</span>
            {seen.has(m.id) && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 font-semibold text-white">Nouveau</span>}
          </div>
          <h3 className="font-semibold">{m.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{m.body}</p>
        </article>
      ))}
    </div>
  )
}

type Recipient = { id: string; name: string }

/** Écrire à un utilisateur précis ou à tous (réservé à l'admin). */
/** Messages automatiques prêts à envoyer (un clic, puis Envoyer). */
const TEMPLATES: { k: string; label: string; icon: string; title: string; body: string }[] = [
  { k: 'erreur', label: 'Erreur', icon: '⚠️', title: 'Problème technique en cours',
    body: "Bonjour,\nUn problème technique perturbe actuellement Budget.Go.Family. Notre équipe travaille à le corriger au plus vite. Vos données sont en sécurité.\nMerci de votre patience.\n— NORD DIGITAL" },
  { k: 'excuse', label: 'Excuse', icon: '🙏', title: 'Toutes nos excuses',
    body: "Bonjour,\nNous vous présentons nos excuses pour la gêne occasionnée. Le problème est maintenant résolu et l'application fonctionne normalement.\nMerci pour votre confiance.\n— NORD DIGITAL" },
  { k: 'maintenance', label: 'Maintenance', icon: '🛠️', title: 'Maintenance prévue',
    body: "Bonjour,\nUne maintenance de Budget.Go.Family est prévue prochainement. L'application pourra être indisponible quelques minutes. Vos données ne seront pas touchées.\nMerci de votre compréhension.\n— NORD DIGITAL" },
  { k: 'maj', label: 'Mise à jour', icon: '🚀', title: 'Nouvelle version disponible',
    body: `Bonjour,\nUne nouvelle version de Budget.Go.Family (v${APP_LABEL}) est disponible avec des améliorations.\nSur Android : touchez le bandeau « Nouvelle version disponible » sur l'accueil pour la télécharger et l'installer. Sur le site web, la mise à jour est automatique.\n— NORD DIGITAL` },
]

/** Écrire à un utilisateur précis ou à tous (réservé à l'admin) : messages automatiques ou saisie manuelle. */
export function ComposeMessage({ to, onSent }: { to?: Recipient; onSent?: () => void }) {
  const [users, setUsers] = useState<Recipient[]>([])
  const [dest, setDest] = useState<string>(to?.id ?? 'all')
  const [tpl, setTpl] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (to) return
    supabase.rpc('admin_users').then(({ data }) => setUsers(((data ?? []) as { id: string; full_name: string | null; email: string }[]).map((u) => ({ id: u.id, name: `${u.full_name || 'Sans nom'} · ${u.email}` }))))
  }, [to])
  const post = async (t: string, b: string) => {
    if (!t.trim() || !b.trim()) return setMsg({ t: 'err', s: 'Écris un titre et un message.' })
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('admin_messages').insert({ to_user: dest === 'all' ? null : dest, title: t.trim(), body: b.trim() })
    setBusy(false)
    if (error) return setMsg({ t: 'err', s: error.message })
    setMsg({ t: 'ok', s: dest === 'all' ? 'Message envoyé à tous les utilisateurs.' : 'Message envoyé.' }); onSent?.()
    return true
  }
  const cur = TEMPLATES.find((x) => x.k === tpl)
  return (
    <div className="space-y-4">
      {to ? <p className="text-sm text-ink-muted">À : <b className="text-ink">{to.name}</b></p> : (
        <select aria-label="Destinataire" className="input" value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="all">📣 Tous les utilisateurs</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      <section className="space-y-2">
        <p className="text-sm font-semibold">Messages automatiques</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEMPLATES.map((x) => (
            <button key={x.k} onClick={() => { setTpl(tpl === x.k ? null : x.k); setMsg(null) }} className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium ${tpl === x.k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
              <span>{x.icon}</span>{x.label}
            </button>
          ))}
        </div>
        {cur && (
          <div className="space-y-3 rounded-2xl border border-sun-500 bg-sun-50 p-3">
            <p className="font-semibold">{cur.title}</p>
            <p className="whitespace-pre-wrap text-sm text-ink-soft">{cur.body}</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={async () => { if (await post(cur.title, cur.body)) setTpl(null) }} className="btn-primary flex-1 py-2.5 text-sm"><Send size={16} /> {busy ? 'Envoi…' : 'Envoyer'}</button>
              <button onClick={() => { setTitle(cur.title); setBody(cur.body); setTpl(null) }} className="btn-ghost bg-white py-2.5 text-sm">Modifier</button>
            </div>
          </div>
        )}
      </section>
      <section className="space-y-2">
        <p className="text-sm font-semibold">Saisie manuelle</p>
        <input className="input" placeholder="Titre" aria-label="Titre du message" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input min-h-[7rem] resize-y" placeholder="Ton message…" aria-label="Message" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={async () => { if (await post(title, body)) { setTitle(''); setBody('') } }} disabled={busy} className="btn-primary w-full"><Send size={18} /> {busy ? 'Envoi…' : 'Envoyer'}</button>
      </section>
      {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
      <p className="text-xs text-ink-muted">Les utilisateurs ne peuvent pas répondre à ces messages.</p>
    </div>
  )
}

function AdminSend() {
  const [sent, setSent] = useState<(AdminMessage & { reads: number })[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [confirm, setConfirm] = useState<string | null>(null)
  const load = useCallback(async () => {
    const [{ data }, { data: us }] = await Promise.all([
      supabase.from('admin_messages').select('id,to_user,title,body,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('admin_users'),
    ])
    setSent(((data ?? []) as AdminMessage[]).map((m) => ({ ...m, reads: 0 })))
    setNames(new Map(((us ?? []) as { id: string; full_name: string | null; email: string }[]).map((u) => [u.id, u.full_name || u.email])))
  }, [])
  useEffect(() => { load() }, [load])
  const remove = async (id: string) => { if (confirm !== id) return setConfirm(id); await supabase.from('admin_messages').delete().eq('id', id); setConfirm(null); load() }
  return (
    <div className="space-y-5 px-5 pb-8 pt-4">
      <ComposeMessage onSent={load} />
      <section>
        <h2 className="mb-2 font-semibold">Messages envoyés</h2>
        {sent.length === 0 && <p className="text-sm text-ink-muted">Aucun message envoyé.</p>}
        {sent.map((m) => (
          <div key={m.id} className="border-b border-neutral-100 py-3 last:border-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-ink-muted">
              <span className="min-w-0 flex-1 truncate">{m.to_user ? `À ${names.get(m.to_user) ?? 'un utilisateur'}` : '📣 Tous'} · {when(m.created_at)}</span>
              <button onClick={() => remove(m.id)} className={`shrink-0 rounded-full px-2.5 py-1 ${confirm === m.id ? 'bg-red-500 text-white' : 'text-red-600'}`}><Trash2 size={13} className="mr-1 inline" />{confirm === m.id ? 'Confirmer' : 'Supprimer'}</button>
            </div>
            <p className="font-medium">{m.title}</p>
            <p className="whitespace-pre-wrap text-sm text-ink-soft">{m.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
