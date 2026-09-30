import { useState } from 'react'
import { KeyRound, LogOut, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import { ByNord, Sheet } from '../components/ui'
import { Brand } from './Auth'

export const PLANS: { days: number; label: string }[] = [
  { days: 30, label: '30 jours' }, { days: 90, label: '3 mois' }, { days: 180, label: '6 mois' }, { days: 365, label: '12 mois' },
]
export const planLabel = (d: number) => PLANS.find((p) => p.days === d)?.label ?? `${d} jours`
export const daysLeft = (exp: string | null) => (exp ? Math.max(0, Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)) : 0)
export const hasAccess = (isAdmin: boolean, exp: string | null) => isAdmin || (!!exp && new Date(exp).getTime() > Date.now())
export const fmtDay = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Nettoie la saisie : majuscules, sans espaces ni tirets, 10 caractères max. */
const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

function useRedeem() {
  const { reloadAccess } = useData()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const redeem = async () => {
    if (!/^BF[A-Z0-9]{8}$/.test(code)) return setMsg({ t: 'err', s: 'Le Go Code a 10 caractères et commence par BF.' })
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('redeem_go_code', { p_code: code })
    setBusy(false)
    if (error) return setMsg({ t: 'err', s: error.message.replace(/^.*?: /, '') })
    setMsg({ t: 'ok', s: `Go Code activé ! Accès jusqu'au ${fmtDay(data as string)}.` }); setCode('')
    await reloadAccess()
  }
  return { code, setCode, busy, msg, redeem }
}

function CodeInput({ r }: { r: ReturnType<typeof useRedeem> }) {
  return (
    <div className="space-y-3">
      <input className="input tabular text-center text-2xl font-semibold uppercase tracking-[0.25em]" placeholder="BF••••••••" autoComplete="off" autoCapitalize="characters"
        aria-label="Go Code" value={r.code} onChange={(e) => r.setCode(clean(e.target.value))} />
      <p className="text-center text-xs text-ink-muted">{r.code.length}/10 caractères</p>
      {r.msg && <p className={`rounded-2xl px-4 py-3 text-sm ${r.msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{r.msg.s}</p>}
      <button onClick={r.redeem} disabled={r.busy || r.code.length !== 10} className="btn-primary w-full text-lg"><KeyRound size={20} /> {r.busy ? 'Vérification…' : 'Activer mon accès'}</button>
    </div>
  )
}

/** Écran bloquant : demandé tant que le client n'a pas d'accès actif. */
export function GoCodeScreen() {
  const { session, profile, expiresAt } = useData()
  const me = userInfo(session, profile)
  const r = useRedeem()
  const [sent, setSent] = useState(false)
  const ask = async () => {
    await supabase.from('feedback').insert({ kind: 'autre', message: `Demande de Go Code — ${me.name} (${me.email}${me.phone ? ', ' + me.phone : ''}).`, sender_name: me.name, app_version: '2.2' })
    setSent(true)
  }
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col bg-white px-6 py-10">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">Entre ton Go Code</h1>
      <p className="mb-6 mt-1 text-ink-muted">
        {expiresAt ? <>Ton accès a expiré le <b className="text-ink">{fmtDay(expiresAt)}</b>. Entre un nouveau Go Code pour continuer.</> : <>Bonjour {me.name.split(' ')[0]} ! Pour utiliser Budget.Go.Family, entre le <b className="text-ink">Go Code</b> reçu après ton paiement.</>}
      </p>
      <CodeInput r={r} />
      <div className="mt-8 rounded-2xl border border-cream-line bg-cream-tile p-4 text-sm">
        <p className="mb-2 font-semibold">Formules disponibles</p>
        <div className="grid grid-cols-2 gap-2">{PLANS.map((p) => <span key={p.days} className="rounded-xl bg-white px-3 py-2 text-center">{p.label}</span>)}</div>
        <p className="mt-3 text-ink-muted">Pas encore de Go Code ? Envoie une demande : l'équipe te contacte pour le paiement.</p>
        <button onClick={ask} disabled={sent} className="btn-dark mt-3 w-full py-2.5 text-sm"><Send size={16} /> {sent ? 'Demande envoyée ✔' : 'Demander un Go Code'}</button>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck size={14} /> Chaque Go Code est personnel et ne peut servir qu'une fois.</p>
      <button onClick={() => supabase.auth.signOut()} className="mt-auto flex items-center justify-center gap-2 pt-8 text-sm text-ink-muted"><LogOut size={16} /> Se déconnecter</button>
      <ByNord className="mt-3" />
    </div>
  )
}

/** Carte « Abonnement » dans Compte : compteur de jours + saisie d'un nouveau code. */
export function SubscriptionCard({ onAdmin }: { onAdmin: () => void }) {
  const { isAdmin, expiresAt } = useData()
  const [open, setOpen] = useState(false)
  const r = useRedeem()
  const left = daysLeft(expiresAt)
  const tone = left <= 7 ? 'bg-red-50 text-red-700' : left <= 30 ? 'bg-amber-50 text-amber-800' : 'bg-sun-100'
  if (isAdmin) return (
    <button onClick={onAdmin} className="mx-5 my-3 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl bg-ink p-4 text-left text-white">
      <ShieldCheck size={24} className="text-sun-500" />
      <span className="flex-1"><b className="block">Administrateur · accès illimité</b><span className="text-sm text-white/70">Utilisateurs et Go Codes</span></span>
    </button>
  )
  return (
    <div className={`mx-5 my-3 rounded-2xl p-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-ink">
          <span className="tabular text-xl font-bold leading-none">{left}</span><span className="text-[0.625rem]">jours</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Abonnement {left > 0 ? 'actif' : 'expiré'}</p>
          <p className="text-sm opacity-80">{expiresAt ? `${left > 0 ? "Jusqu'au" : 'Depuis le'} ${fmtDay(expiresAt)}` : 'Aucun accès'}</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-dark px-4 py-2 text-sm">Go Code</button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Prolonger avec un Go Code">
        <p className="mb-4 text-sm text-ink-muted">Les jours du nouveau code s'ajoutent à ceux qu'il te reste ({left} j).</p>
        <CodeInput r={r} />
      </Sheet>
    </div>
  )
}
