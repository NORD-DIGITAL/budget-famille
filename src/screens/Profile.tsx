import { useEffect, useState } from 'react'
import { Info, Minus, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { Sheet } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { DateField } from '../components/DatePicker'
import type { Child, Profile } from '../lib/types'
import { Brand } from './Auth'

export const REGIONS = [
  'Alaotra-Mangoro', "Amoron'i Mania", 'Analamanga', 'Analanjirofo', 'Androy', 'Anosy', 'Atsimo-Andrefana', 'Atsimo-Atsinanana',
  'Atsinanana', 'Betsiboka', 'Boeny', 'Bongolava', 'Diana', 'Fitovinany', 'Haute Matsiatra', 'Ihorombe', 'Itasy', 'Melaky', 'Menabe',
  'Sava', 'Sofia', 'Vakinankaratra', 'Vatovavy', 'Hors de Madagascar',
]
const MARITAL: [NonNullable<Profile['marital_status']>, string][] = [['celibataire', 'Célibataire'], ['conjoint', 'Conjoint(e)'], ['partenaire', 'Partenaire'], ['marie', 'Marié(e)']]
const PREFIXES = ['032', '033', '034', '036', '037', '038']

type Form = {
  full_name: string; birth_date: string; sex: Profile['sex']; region: string; city: string; profession: string
  marital_status: Profile['marital_status']; children: { name: string; age: string; school: boolean | null }[]; prefix: string; phone: string
}

function useProfileForm() {
  const { session, profile } = useData()
  const md = (session?.user.user_metadata ?? {}) as { full_name?: string; phone_local?: string }
  const digits = (md.phone_local ?? '').replace(/\D/g, '')
  const init = (): Form => ({
    full_name: profile?.full_name ?? md.full_name ?? '',
    birth_date: profile?.birth_date ?? '', sex: profile?.sex ?? null, region: profile?.region ?? '', city: profile?.city ?? '',
    profession: profile?.profession ?? '', marital_status: profile?.marital_status ?? null,
    children: (profile?.children ?? []).map((c) => ({ name: c.name, age: c.age == null ? '' : String(c.age), school: c.school ?? null })),
    prefix: digits.slice(0, 3) || '034', phone: digits.slice(3),
  })
  const [f, setF] = useState<Form>(init)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setF(init()) }, [profile?.id])
  return [f, setF] as const
}

async function saveProfile(uid: string, f: Form) {
  const children: Child[] = f.children.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), age: c.age === '' ? null : Math.max(0, Math.min(40, Number(c.age))), ...(c.school == null ? {} : { school: c.school }) }))
  const { error } = await supabase.from('profiles').upsert({
    id: uid, full_name: f.full_name.trim() || null, birth_date: f.birth_date || null, sex: f.sex, region: f.region || null,
    city: f.city.trim() || null, profession: f.profession.trim() || null, marital_status: f.marital_status, children, onboarded: true,
    updated_at: new Date().toISOString(),
  })
  if (error) return error.message
  const d = f.phone.replace(/\D/g, '')
  await supabase.auth.updateUser({ data: {
    full_name: f.full_name.trim(),
    ...(d.length === 7 ? { phone: `+261${f.prefix.slice(1)}${d}`, phone_local: `${f.prefix} ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` } : {}),
  } })
  return null
}

function Chips<T extends string>({ value, onChange, options }: { value: T | null; onChange: (v: T | null) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(value === k ? null : k)}
          className={`rounded-full border px-4 py-2 text-sm transition ${value === k ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{l}</button>
      ))}
    </div>
  )
}

function ProfileFields({ f, setF }: { f: Form; setF: (f: Form) => void }) {
  const setKids = (n: number) => {
    const kids = [...f.children]
    while (kids.length < n) kids.push({ name: '', age: '', school: null })
    setF({ ...f, children: kids.slice(0, n) })
  }
  const setKid = (i: number, patch: Partial<{ name: string; age: string; school: boolean | null }>) =>
    setF({ ...f, children: f.children.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  return (
    <div className="space-y-5">
      <div><label className="label" htmlFor="p-name">Nom complet</label><input id="p-name" className="input" autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div>
        <label className="label" htmlFor="p-phone">Téléphone</label>
        <div className="flex gap-2">
          <select aria-label="Préfixe" className="input w-[6.5rem]" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })}>
            {PREFIXES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input id="p-phone" className="input tabular flex-1" inputMode="numeric" placeholder="12 345 67" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 7) })} />
        </div>
      </div>
      <div><label className="label" htmlFor="p-birth">Date de naissance</label><DateField id="p-birth" value={f.birth_date} clearable placeholder="Choisir ta date de naissance" startYear={1990} max={new Date().toISOString().slice(0, 10)} onChange={(v) => setF({ ...f, birth_date: v })} /></div>
      <div><p className="label">Sexe</p><Chips value={f.sex} onChange={(v) => setF({ ...f, sex: v })} options={[['homme', 'Homme'], ['femme', 'Femme']]} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-region">Région</label>
          <select id="p-region" className="input" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
            <option value="">Choisir…</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="p-city">Ville</label><input id="p-city" className="input" placeholder="Ex : Antsirabe" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
      </div>
      <div><label className="label" htmlFor="p-job">Profession</label><input id="p-job" className="input" placeholder="Ex : commerçant, enseignante…" value={f.profession} onChange={(e) => setF({ ...f, profession: e.target.value })} /></div>
      <div><p className="label">Situation matrimoniale</p><Chips value={f.marital_status} onChange={(v) => setF({ ...f, marital_status: v })} options={MARITAL} /></div>
      <div>
        <p className="label">Nombre d'enfants</p>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Un enfant de moins" onClick={() => setKids(Math.max(0, f.children.length - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-cream-line bg-cream-tile"><Minus size={20} /></button>
          <span className="tabular w-8 text-center text-2xl font-semibold">{f.children.length}</span>
          <button type="button" aria-label="Un enfant de plus" onClick={() => setKids(Math.min(15, f.children.length + 1))} className="flex h-11 w-11 items-center justify-center rounded-full bg-sun-500"><Plus size={20} /></button>
        </div>
        {f.children.length > 0 && (
          <div className="mt-3 space-y-2">
            {f.children.map((c, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-cream-line bg-cream-tile p-3">
                <div className="flex gap-2">
                  <input className="input flex-1 bg-white" placeholder={`Prénom de l'enfant ${i + 1}`} value={c.name} onChange={(e) => setKid(i, { name: e.target.value })} aria-label={`Prénom de l'enfant ${i + 1}`} />
                  <input className="input tabular w-20 bg-white text-center" inputMode="numeric" placeholder="Âge" value={c.age} onChange={(e) => setKid(i, { age: e.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label={`Âge de l'enfant ${i + 1}`} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink-muted">Va à l'école ?</span>
                  {([[true, 'Oui'], [false, 'Non']] as [boolean, string][]).map(([v, l]) => (
                    <button key={l} type="button" onClick={() => setKid(i, { school: c.school === v ? null : v })}
                      className={`rounded-full border px-4 py-1.5 transition ${c.school === v ? 'border-ink bg-ink text-white' : 'border-cream-line bg-white'}`}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const WHY = "Ces informations sont facultatives, mais elles sont importantes pour profiter de toutes les fonctionnalités de l'application : par exemple, suivre les dépenses de chaque enfant."

/** Étape affichée une fois, juste après l'ouverture du compte. */
export function ProfileSetup() {
  const { session, reloadProfile } = useData()
  const [f, setF] = useProfileForm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const uid = session!.user.id

  const save = async () => {
    setBusy(true); setErr('')
    const e = await saveProfile(uid, f)
    setBusy(false)
    if (e) setErr(e); else await reloadProfile()
  }
  const later = async () => {
    setBusy(true)
    await supabase.from('profiles').upsert({ id: uid, full_name: f.full_name.trim() || null, onboarded: true })
    setBusy(false); await reloadProfile()
  }

  return (
    <div className="pt-safe pb-safe mx-auto min-h-full max-w-md bg-white px-6 py-8">
      <Brand />
      <h1 className="mt-8 text-2xl font-semibold">Parle-nous de toi</h1>
      <div className="mb-6 mt-3 flex gap-3 rounded-2xl bg-sun-100 p-4 text-sm">
        <Info size={20} className="mt-0.5 shrink-0" />
        <p>{WHY}</p>
      </div>
      <ProfileFields f={f} setF={setF} />
      {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      <div className="mt-8 space-y-2">
        <button disabled={busy} onClick={save} className="btn-primary w-full text-lg">Enregistrer et continuer</button>
        <button disabled={busy} onClick={later} className="w-full py-3 text-[15px] text-ink-muted">Plus tard</button>
      </div>
    </div>
  )
}

/** Page « Mon profil » dans Compte. */
export function ProfilePage() {
  const { session, reloadProfile } = useData()
  const [f, setF] = useProfileForm()
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const e = await saveProfile(session!.user.id, f)
    setBusy(false)
    setMsg(e ? { t: 'err', s: e } : { t: 'ok', s: 'Profil enregistré.' })
    if (!e) await reloadProfile()
  }
  return (
    <div className="space-y-5 px-5 pb-10 pt-2">
      <div className="flex gap-3 rounded-2xl bg-sun-100 p-4 text-sm"><Info size={20} className="mt-0.5 shrink-0" /><p>{WHY}</p></div>
      <ProfileFields f={f} setF={setF} />
      <div><p className="label">Email</p><p className="truncate rounded-2xl bg-neutral-50 px-4 py-3.5 text-ink-soft">{session?.user.email}</p></div>
      {msg && <p className={`rounded-2xl px-4 py-3 text-sm ${msg.t === 'err' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg.s}</p>}
      <button disabled={busy} onClick={save} className="btn-primary w-full">Enregistrer</button>
      <p className="flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck size={16} className="shrink-0" /> Ton profil n'est visible que par toi et les personnes de tes carnets.</p>
      <ResetSection />
    </div>
  )
}

const RESET_WORD = 'SUPPRIMER'
type ResetKey = 'transactions' | 'budgets' | 'savings_goals' | 'debts' | 'balances'
const RESET_LABELS: [ResetKey, string][] = [
  ['transactions', 'Toutes les opérations (dépenses et revenus)'], ['budgets', 'Les budgets'], ['savings_goals', "Les objectifs d'épargne"],
  ['debts', 'Les dettes'], ['balances', 'Les soldes de départ des comptes (remis à 0)'],
]

/** Réinitialisation du carnet, protégée par un avertissement et une saisie de confirmation. */
function ResetSection() {
  const { carnet, reload, txs } = useData()
  const owner = carnet?.role === 'proprietaire'
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Record<ResetKey, boolean>>({ transactions: true, budgets: true, savings_goals: true, debts: true, balances: false })
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const any = Object.values(sel).some(Boolean)

  const run = async () => {
    if (word.trim().toUpperCase() !== RESET_WORD || !carnet) return
    setBusy(true)
    const { error } = await supabase.rpc('reset_carnet', { c: carnet.id, p_tx: sel.transactions, p_budgets: sel.budgets, p_goals: sel.savings_goals, p_debts: sel.debts, p_balances: sel.balances })
    await reload()
    setBusy(false); setOpen(false); setWord('')
    setDone(error ? error.message : 'Données supprimées. Tes catégories, comptes et membres sont conservés.')
  }

  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-red-200 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-red-600"><TriangleAlert size={18} /> Zone sensible</h2>
      <p className="text-sm text-ink-soft">Remettre le carnet « {carnet?.name} » à zéro, par exemple pour repartir sur une nouvelle année.</p>
      {done && <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{done}</p>}
      {owner ? (
        <button onClick={() => { setOpen(true); setDone('') }} className="btn w-full bg-red-50 text-red-600"><Trash2 size={18} /> Réinitialiser les données</button>
      ) : (
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-ink-muted">Ce carnet appartient à une autre personne : seul son créateur peut effacer ses données. Ouvre ton carnet principal pour réinitialiser le tien.</p>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Réinitialiser les données">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" />
            <p><b>Attention : cette action est définitive.</b> Les données cochées seront supprimées du carnet « {carnet?.name} » pour <b>toutes les personnes</b> qui le partagent ({txs.length} opérations actuellement). Pense à exporter une copie (Compte › Exporter) avant.</p>
          </div>
          <div className="space-y-2">
            {RESET_LABELS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile px-4 py-3 text-[15px]">
                <input type="checkbox" className="h-5 w-5 accent-red-500" checked={sel[k]} onChange={(e) => setSel({ ...sel, [k]: e.target.checked })} />{l}
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="reset-word">Pour confirmer, écris <b className="text-ink">{RESET_WORD}</b></label>
            <input id="reset-word" className="input text-center uppercase tracking-widest" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
          </div>
          <button onClick={run} disabled={busy || !any || word.trim().toUpperCase() !== RESET_WORD} className="btn w-full bg-red-500 text-white disabled:bg-neutral-200 disabled:text-neutral-500">
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </Sheet>
    </section>
  )
}
