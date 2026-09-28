import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import logo from '../assets/logo.png'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
      if (error) setMsg({ t: 'err', s: error.message === 'Email not confirmed' ? "Confirme d'abord ton email (lien reçu par mail)." : 'Email ou mot de passe incorrect.' })
    } else {
      if (pwd.length < 6) { setBusy(false); return setMsg({ t: 'err', s: 'Mot de passe : 6 caractères minimum.' }) }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pwd })
      if (error) setMsg({ t: 'err', s: error.message })
      else if (!data.session) { setMsg({ t: 'ok', s: 'Compte créé ! Ouvre le lien reçu par email, puis reviens te connecter.' }); setMode('login') }
    }
    setBusy(false)
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
        <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label">Mot de passe</label><input className="input" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        {msg && <p className={`rounded-lg p-2 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null) }} className="w-full py-2 text-sm font-medium text-brand-600">
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
