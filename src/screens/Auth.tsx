import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import logo from '../assets/logo.png'

const PREFIXES = ['032', '033', '034', '036', '037', '038']

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} className="input pr-12" type={show ? 'text' : 'password'} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-600">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [prefix, setPrefix] = useState('034')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setUnconfirmed(false)
    if (mode === 'login') {
      setBusy(true)
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
      if (error) {
        if (error.message === 'Email not confirmed') { setUnconfirmed(true); setMsg({ t: 'err', s: "Ton email n'est pas encore confirmé." }) }
        else setMsg({ t: 'err', s: 'Email ou mot de passe incorrect.' })
      }
      setBusy(false)
      return
    }
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 7) return setMsg({ t: 'err', s: 'Numéro de téléphone : 7 chiffres après le préfixe (ex : 034 12 345 67).' })
    if (pwd.length < 6) return setMsg({ t: 'err', s: 'Mot de passe : 6 caractères minimum.' })
    if (pwd !== pwd2) return setMsg({ t: 'err', s: 'Les deux mots de passe ne sont pas identiques.' })
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: pwd,
      options: { data: { phone: `+261${prefix.slice(1)}${digits}`, phone_local: `${prefix} ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` } },
    })
    setBusy(false)
    if (error) setMsg({ t: 'err', s: error.message.includes('already registered') ? 'Un compte existe déjà avec cet email.' : error.message })
    else if (!data.session) { setMsg({ t: 'ok', s: 'Compte créé ! Ouvre le lien reçu par email (regarde aussi dans Spam), puis reviens te connecter.' }); setMode('login'); setPwd2('') }
  }

  const resend = async () => {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    setBusy(false)
    setMsg(error ? { t: 'err', s: "Envoi impossible pour l'instant, réessaie dans quelques minutes." } : { t: 'ok', s: 'Email renvoyé. Regarde aussi dans le dossier Spam.' })
  }

  return (
    <div className="pt-safe flex min-h-full flex-col bg-gradient-to-br from-brand-600 to-violet-700 px-5">
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-white">
        <img src={logo} alt="" className="mb-4 h-20 w-20 rounded-3xl shadow-lg" />
        <h1 className="text-3xl font-bold">Budget Famille</h1>
        <p className="mt-1 text-white/80">Suivez vos dépenses, ensemble.</p>
      </div>
      <form onSubmit={submit} className="card pb-safe mb-6 space-y-3 p-5">
        <h2 className="text-xl font-semibold">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="phone">Numéro de téléphone</label>
            <div className="flex gap-2">
              <select id="prefix" aria-label="Préfixe" className="input w-24" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input id="phone" className="input flex-1 tracking-wider" inputMode="numeric" autoComplete="tel-local" placeholder="12 345 67" required
                value={phone} onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 7)
                  setPhone([d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join(' '))
                }} />
            </div>
          </div>
        )}
        <div><label className="label" htmlFor="pwd">Mot de passe</label><PasswordInput id="pwd" value={pwd} onChange={setPwd} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="pwd2">Confirmer le mot de passe</label>
            <PasswordInput id="pwd2" value={pwd2} onChange={setPwd2} autoComplete="new-password" />
            {pwd2 && pwd !== pwd2 && <p className="mt-1 text-xs text-red-600">Les mots de passe ne correspondent pas.</p>}
          </div>
        )}
        {msg && <p className={`rounded-lg p-2 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
        {unconfirmed && <button type="button" disabled={busy} onClick={resend} className="btn-ghost w-full text-sm">Renvoyer l'email de confirmation</button>}
        <button disabled={busy} className="btn-primary w-full">{busy ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); setUnconfirmed(false) }} className="w-full py-2 text-sm font-medium text-brand-600">
          {mode === 'login' ? 'Pas encore de compte ? Inscris-toi' : "J'ai déjà un compte"}
        </button>
      </form>
    </div>
  )
}

export function OnboardingScreen() {
  const { loadCarnet } = useData()
  const [name, setName] = useState('Ma famille')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('create_carnet', { p_name: name })
    if (error) setErr(error.message); else await loadCarnet()
    setBusy(false)
  }
  const join = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('join_carnet', { p_code: code })
    if (error) setErr(error.message.includes('invalide') ? 'Code invalide.' : error.message); else await loadCarnet()
    setBusy(false)
  }

  return (
    <div className="pt-safe min-h-full bg-slate-50 px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold">Bienvenue 👋</h1>
      <p className="mb-6 text-slate-500">Crée le carnet de ta famille, ou rejoins celui d'un proche avec son code.</p>
      <div className="card mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Créer un nouveau carnet</h2>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-slate-400">Catégories (Jirama, Transport…), comptes (Espèces, MVola, Orange Money, Banque) créés automatiquement.</p>
        <button disabled={busy} onClick={create} className="btn-primary w-full">Créer</button>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">Rejoindre un carnet existant</h2>
        <input className="input uppercase tracking-widest" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} />
        <button disabled={busy || code.length < 4} onClick={join} className="btn-ghost w-full">Rejoindre</button>
      </div>
      {err && <p className="mt-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}
      <button onClick={() => supabase.auth.signOut()} className="mt-8 w-full text-sm text-slate-400">Se déconnecter</button>
    </div>
  )
}
