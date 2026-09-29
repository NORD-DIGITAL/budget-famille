import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, FileDown, FolderTree, HandCoins, Landmark, LogOut, PieChart, PiggyBank, Share2, Target, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import type { Kind } from '../lib/types'
import { Header, Row, Sheet } from '../components/ui'

export type SubPage = 'budget' | 'objectifs' | 'dettes' | 'categories' | 'comptes' | 'membres' | 'partage' | 'profil'
export const SUB_TITLES: Record<SubPage, string> = {
  budget: 'Budget', objectifs: "Objectifs d'épargne", dettes: 'Dettes', categories: 'Catégories', comptes: 'Comptes', membres: 'Membres', partage: 'Famille & partage', profil: 'Mon profil',
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
  const { session, profile, carnet } = useData()
  const me = userInfo(session, profile)
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
          {me.phone && <p className="tabular text-ink-soft">{me.phone}</p>}
          <p className="truncate text-sm text-ink-muted">{me.email}</p>
          <button onClick={() => open('profil')} className="pill mt-2 bg-sun-300">Voir le profil</button>
        </div>
      </div>
      <p className="border-b border-neutral-100 px-5 py-3 text-sm text-ink-muted">Carnet ouvert : <b className="text-ink">{carnet?.name}</b></p>

      <div>
        <Row icon={ico(Target)} label="Budget du mois" onClick={() => open('budget')} />
        <Row icon={ico(PiggyBank)} label="Objectifs d'épargne" onClick={() => open('objectifs')} />
        <Row icon={ico(HandCoins)} label="Dettes" sub="Ce que je dois, ce qu'on me doit" onClick={() => open('dettes')} />
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
      { label: 'Dettes', Icon: HandCoins, run: go(() => openSub('dettes')) },
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

