import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import logo from '../assets/logo.png'
import { markAuth } from '../lib/lock'
import { ByNord, Wordmark } from '../components/ui'

const PREFIXES = ['032', '033', '034', '036', '037', '038']

export function Brand() {
  return (
    <div className="flex flex-col items-center gap-3">
      <img src={logo} alt="" className="h-20 w-20 rounded-[22px]" />
      <Wordmark className="text-[28px]" />
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} className="input pr-12" type={show ? 'text' : 'password'} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted">
        {show ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
      </button>
    </div>
  )
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [prefix, setPrefix] = useState('034')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [autoOut] = useState(() => { try { const v = sessionStorage.getItem('bf-auto-logout') === '1'; sessionStorage.removeItem('bf-auto-logout'); return v } catch { return false } })

  const ready = mode === 'login' ? !!(email && pwd) : !!(name.trim() && email && phone.replace(/\D/g, '').length === 7 && pwd && pwd2)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setUnconfirmed(false)
    if (mode === 'login') {
      setBusy(true)
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
      if (data.user) markAuth(data.user.id)
      if (error) {
        if (error.message === 'Email not confirmed') { setUnconfirmed(true); setMsg({ t: 'err', s: "Ton email n'est pas encore confirmé." }) }
        else setMsg({ t: 'err', s: 'Email ou mot de passe incorrect.' })
      }
      setBusy(false)
      return
    }
    const digits = phone.replace(/\D/g, '')
    if (!name.trim()) return setMsg({ t: 'err', s: 'Indique ton nom.' })
    if (digits.length !== 7) return setMsg({ t: 'err', s: 'Numéro : 7 chiffres après le préfixe (ex : 034 12 345 67).' })
    if (pwd.length < 6) return setMsg({ t: 'err', s: 'Mot de passe : 6 caractères minimum.' })
    if (pwd !== pwd2) return setMsg({ t: 'err', s: 'Les deux mots de passe ne sont pas identiques.' })
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: pwd,
      options: { data: { full_name: name.trim(), phone: `+261${prefix.slice(1)}${digits}`, phone_local: `${prefix} ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` } },
    })
    setBusy(false)
    if (data.user && data.session) markAuth(data.user.id)
    if (error) setMsg({ t: 'err', s: error.message.includes('already registered') ? 'Un compte existe déjà avec cet email.' : error.message })
    else if (!data.session) { setMsg({ t: 'ok', s: 'Compte créé ! Ouvre le lien reçu par email (regarde aussi dans Spam), puis connecte-toi.' }); setMode('login'); setPwd2('') }
  }

  const resend = async () => {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    setBusy(false)
    setMsg(error ? { t: 'err', s: "Envoi impossible pour l'instant, réessaie dans quelques minutes." } : { t: 'ok', s: 'Email renvoyé. Regarde aussi dans le dossier Spam.' })
  }

  const switchMode = () => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); setUnconfirmed(false) }

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col bg-white px-6">
      <div className={`flex flex-col items-center text-center ${mode === 'login' ? 'pb-10 pt-16' : 'pb-6 pt-10'}`}>
        <Brand />
        <p className="mt-6 text-xl text-ink-soft">{mode === 'login' ? 'Bienvenue' : 'Créer un compte'}</p>
        <p className="text-sm text-ink-muted">{mode === 'login' ? 'Connecte-toi pour retrouver le carnet de ta famille.' : 'Quelques infos pour commencer.'}</p>
      </div>

      {autoOut && mode === 'login' && <p className="mb-4 rounded-2xl bg-sun-100 px-4 py-3 text-sm">Déconnexion automatique (8 h / 18 h) pour protéger tes données. Reconnecte-toi.</p>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div><label className="label" htmlFor="name">Nom et prénom</label><input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="phone">Numéro de téléphone</label>
            <div className="flex gap-2">
              <select id="prefix" aria-label="Préfixe" className="input w-[6.5rem]" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input id="phone" className="input tabular flex-1 tracking-wider" inputMode="numeric" autoComplete="tel-local" placeholder="12 345 67" required
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
            {pwd2 && pwd !== pwd2 && <p className="mt-1.5 text-xs text-red-500">Les mots de passe ne correspondent pas.</p>}
          </div>
        )}
        {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
        {unconfirmed && <button type="button" disabled={busy} onClick={resend} className="btn-ghost w-full text-sm">Renvoyer l'email de confirmation</button>}
        <button disabled={busy || !ready} className="btn-primary mt-2 w-full text-lg">{busy ? '…' : mode === 'login' ? 'Connexion' : "S'inscrire"}</button>
      </form>

      <button type="button" onClick={switchMode} className="mb-8 mt-6 py-2 text-center text-[15px] text-[#4A56E2]">
        {mode === 'login' ? 'Pas encore de compte ? Inscris-toi' : "J'ai déjà un compte · Connexion"}
      </button>
      <ByNord className="mb-6 mt-auto" />
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
    <div className="pt-safe mx-auto min-h-full max-w-md bg-white px-6 py-10">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">Bienvenue 👋</h1>
      <p className="mb-6 mt-1 text-ink-muted">Crée le carnet de ta famille, ou rejoins celui d'un proche avec son code.</p>
      <div className="tile mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Créer un nouveau carnet</h2>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du carnet" />
        <p className="text-xs text-ink-muted">Catégories (Jirama, Transport…) et comptes (Espèces, MVola, Orange Money, Banque) créés automatiquement.</p>
        <button disabled={busy} onClick={create} className="btn-primary w-full">Créer mon carnet</button>
      </div>
      <div className="tile space-y-3 p-5">
        <h2 className="font-semibold">Rejoindre un carnet existant</h2>
        <input className="input text-center uppercase tracking-[0.3em]" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code d'invitation" />
        <button disabled={busy || code.length < 4} onClick={join} className="btn-dark w-full">Rejoindre</button>
      </div>
      {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      <button onClick={() => supabase.auth.signOut()} className="mt-8 w-full text-sm text-ink-muted">Se déconnecter</button>
      <ByNord className="mt-2" />
    </div>
  )
}
