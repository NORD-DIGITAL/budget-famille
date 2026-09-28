import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, FileDown, FolderTree, Landmark, LogOut, PieChart, PiggyBank, Share2, ShieldCheck, Target, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import type { Kind } from '../lib/types'
import { Header, Row, Sheet } from '../components/ui'

export type SubPage = 'budget' | 'objectifs' | 'categories' | 'comptes' | 'membres' | 'partage' | 'profil'
export const SUB_TITLES: Record<SubPage, string> = {
  budget: 'Budget', objectifs: "Objectifs d'épargne", categories: 'Catégories', comptes: 'Comptes', membres: 'Membres', partage: 'Famille & partage', profil: 'Mon profil',
}

function useExportCsv() {
  const { txs, catById, accById, memById, carnet } = useData()
  const [status, setStatus] = useState('')
  const run = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = ['Date;Type;Montant;Catégorie;Compte;Membre;Note']
    for (const t of txs) lines.push([
      t.occurred_on, t.kind === 'depense' ? 'Dépense' : 'Revenu', String(t.kind === 'depense' ? -t.amount : t.amount),
      esc(t.category_id ? catById.get(t.category_id)?.name ?? '' : ''), esc(t.account_id ? accById.get(t.account_id)?.name ?? '' : ''),
      esc(t.member_id ? memById.get(t.member_id)?.name ?? '' : ''), esc(t.note ?? ''),
    ].join(';'))
    try {
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(carnet?.name ?? 'budget').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus(`${txs.length} opérations exportées.`)
    } catch { setStatus("L'export n'est pas disponible ici. Utilise la version web.") }
  }
  return { run, status }
}

/** Page « Mon compte » : profil + liste des réglages. */
export default function CompteScreen({ open }: { open: (p: SubPage) => void }) {
  const { session, carnet } = useData()
  const me = userInfo(session)
  const csv = useExportCsv()
  const [confirmOut, setConfirmOut] = useState(false)

  const ico = (I: LucideIcon) => <I size={26} strokeWidth={1.6} />

  return (
    <>
      <Header title="Mon compte" />
      <div className="flex items-center gap-4 border-b border-neutral-100 px-5 pb-6 pt-2">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-semibold text-white">{me.initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{me.name}</p>
          <p className="tabular text-ink-soft">{me.phone || me.email}</p>
          <button onClick={() => open('profil')} className="pill mt-2 bg-sun-300">Voir le profil</button>
        </div>
        <button onClick={() => open('partage')} className="flex flex-col items-center rounded-2xl border border-cream-line bg-cream-tile px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-ink-muted">Code famille</span>
          <span className="tabular text-sm font-semibold tracking-widest">{carnet?.invite_code}</span>
        </button>
      </div>

      <div>
        <Row icon={ico(Target)} label="Budget du mois" onClick={() => open('budget')} />
        <Row icon={ico(PiggyBank)} label="Objectifs d'épargne" onClick={() => open('objectifs')} />
        <Row icon={ico(FolderTree)} label="Catégories" onClick={() => open('categories')} />
        <Row icon={ico(Landmark)} label="Comptes" onClick={() => open('comptes')} />
        <Row icon={ico(Users)} label="Membres" onClick={() => open('membres')} />
        <Row icon={ico(Share2)} label="Famille & partage" sub="Inviter un proche avec le code" onClick={() => open('partage')} />
        <Row icon={ico(FileDown)} label="Exporter vers Excel (CSV)" sub={csv.status || undefined} onClick={csv.run} right={<span />} />
        <Row icon={<LogOut size={26} strokeWidth={1.6} />} label={confirmOut ? 'Toucher encore pour confirmer' : 'Se déconnecter'} danger
          onClick={() => (confirmOut ? supabase.auth.signOut() : setConfirmOut(true))} />
      </div>
      <p className="py-8 text-center text-sm text-ink-muted">Budget Famille · version 1.1</p>
    </>
  )
}

/** Feuille « Voir tout » : tous les services groupés par section. */
export function AllSheet({ open, onClose, onAdd, openSub, goCharts }: {
  open: boolean; onClose: () => void; onAdd: (k: Kind) => void; openSub: (p: SubPage) => void; goCharts: () => void
}) {
  const csv = useExportCsv()
  const go = (f: () => void) => () => { onClose(); f() }
  const sections: { title: string; items: { label: string; Icon: LucideIcon; run: () => void }[] }[] = [
    { title: 'Saisir', items: [
      { label: 'Nouvelle dépense', Icon: ArrowUpRight, run: go(() => onAdd('depense')) },
      { label: 'Nouveau revenu', Icon: ArrowDownLeft, run: go(() => onAdd('revenu')) },
    ] },
    { title: 'Suivre', items: [
      { label: 'Budget du mois', Icon: Target, run: go(() => openSub('budget')) },
      { label: "Objectifs d'épargne", Icon: PiggyBank, run: go(() => openSub('objectifs')) },
      { label: 'Graphiques', Icon: PieChart, run: go(goCharts) },
    ] },
    { title: 'Organiser', items: [
      { label: 'Catégories', Icon: FolderTree, run: go(() => openSub('categories')) },
      { label: 'Comptes', Icon: Landmark, run: go(() => openSub('comptes')) },
      { label: 'Membres', Icon: Users, run: go(() => openSub('membres')) },
    ] },
    { title: 'Autres', items: [
      { label: 'Famille & partage', Icon: Share2, run: go(() => openSub('partage')) },
      { label: 'Mon profil', Icon: UserRound, run: go(() => openSub('profil')) },
      { label: 'Exporter (CSV)', Icon: FileDown, run: csv.run },
    ] },
  ]
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="-mx-6 divide-y divide-neutral-100">
        {sections.map((s) => (
          <section key={s.title} className="px-6 py-5">
            <h3 className="mb-4 text-[22px] font-semibold">{s.title}</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {s.items.map(({ label, Icon, run }) => (
                <button key={label} onClick={run} className="tile flex h-[104px] flex-col justify-between p-3 text-left active:scale-[.98]">
                  <Icon size={30} strokeWidth={1.5} />
                  <span className="text-[13px] leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {csv.status && <p className="px-6 py-3 text-sm text-ink-muted">{csv.status}</p>}
      </div>
    </Sheet>
  )
}

export function ProfilePage() {
  const { session } = useData()
  const md = (session?.user.user_metadata ?? {}) as { full_name?: string; phone_local?: string }
  const [name, setName] = useState(md.full_name ?? '')
  const initialDigits = (md.phone_local ?? '').replace(/\D/g, '')
  const [prefix, setPrefix] = useState(initialDigits.slice(0, 3) || '034')
  const [phone, setPhone] = useState(initialDigits.slice(3))
  const [msg, setMsg] = useState('')
  const save = async () => {
    const d = phone.replace(/\D/g, '')
    if (d && d.length !== 7) return setMsg('Numéro : 7 chiffres après le préfixe.')
    const { error } = await supabase.auth.updateUser({ data: {
      full_name: name.trim(),
      ...(d ? { phone: `+261${prefix.slice(1)}${d}`, phone_local: `${prefix} ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` } : {}),
    } })
    setMsg(error ? error.message : 'Profil enregistré.')
  }
  return (
    <div className="space-y-4 px-5 py-2">
      <div><label className="label" htmlFor="pf-name">Nom et prénom</label><input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div>
        <label className="label" htmlFor="pf-phone">Téléphone</label>
        <div className="flex gap-2">
          <select aria-label="Préfixe" className="input w-[6.5rem]" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
            {['032', '033', '034', '036', '037', '038'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input id="pf-phone" className="input tabular flex-1" inputMode="numeric" placeholder="12 345 67" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 7))} />
        </div>
      </div>
      <div><p className="label">Email</p><p className="rounded-2xl bg-neutral-50 px-4 py-3.5 text-ink-soft">{session?.user.email}</p></div>
      {msg && <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm">{msg}</p>}
      <button onClick={save} className="btn-primary w-full">Enregistrer</button>
      <p className="flex items-center gap-2 pt-4 text-xs text-ink-muted"><ShieldCheck size={16} /> Tes données sont visibles uniquement par les membres de ton carnet.</p>
    </div>
  )
}
