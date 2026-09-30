import { useState } from 'react'
import { ChevronRight, Inbox, Lightbulb, ShoppingCart, Fingerprint, ArrowDownLeft, ArrowUpRight, FileDown, FolderTree, HandCoins, Landmark, LogOut, PieChart, PiggyBank, Share2, Target, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { saveTextFile, slug, stamp, toCsv } from '../lib/files'
import { useData } from '../lib/data'
import { userInfo } from '../lib/prefs'
import type { Kind } from '../lib/types'
import { ByNord, Header, Row, Sheet } from '../components/ui'
import { useInboxCount } from './Feedback'
import { CarnetSwitcher } from '../components/Carnets'
import { THEMES, SIZES, applySize, getSize, setUserTheme, useUserTheme, themeForCarnet } from '../lib/theme'
import { useEffect } from 'react'
import { biometricAvailable, biometricEnabled, disableBiometric, enableBiometric } from '../lib/lock'

export type SubPage = 'budget' | 'objectifs' | 'dettes' | 'categories' | 'comptes' | 'membres' | 'partage' | 'profil' | 'courses' | 'remarques' | 'inbox'
export const SUB_TITLES: Record<SubPage, string> = {
  budget: 'Budget', objectifs: "Épargne", dettes: 'Dettes', categories: 'Catégories', comptes: 'Comptes', membres: 'Membres', partage: 'Famille & partage', profil: 'Mon profil', courses: 'Faire les courses', remarques: 'Remarques & suggestions', inbox: 'Boîte de réception',
}

function useExportCsv() {
  const { txs, catPath, accById, memById, carnet } = useData()
  const [status, setStatus] = useState('')
  const run = async () => {
    const rows: unknown[][] = [['Date', 'Type', 'Montant', 'Catégorie', 'Compte', 'Membre', 'Quantité', 'Unité', 'Enfant(s)', 'Pour qui', 'Référence', 'Note']]
    for (const t of txs) rows.push([
      t.occurred_on, t.kind === 'depense' ? 'Dépense' : 'Revenu', t.kind === 'depense' ? -t.amount : t.amount, catPath(t.category_id),
      t.account_id ? accById.get(t.account_id)?.name : '', t.member_id ? memById.get(t.member_id)?.name : '', t.quantity ?? '', t.unit ?? '',
      t.child_name ?? '', t.beneficiary ?? '', t.ref ?? '', t.note ?? '',
    ])
    const e = await saveTextFile(`${slug(carnet?.name ?? 'budget')}_operations_${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
    setStatus(e ?? `${txs.length} opérations exportées.`)
  }
  return { run, status }
}

/** Page « Mon compte » : profil + liste des réglages. */
export default function CompteScreen({ open }: { open: (p: SubPage) => void }) {
  const { session, profile, carnet, isAdmin } = useData()
  const inboxN = useInboxCount()
  const me = userInfo(session, profile)
  const csv = useExportCsv()
  const [confirmOut, setConfirmOut] = useState(false)

  const ico = (I: LucideIcon) => <I size={26} strokeWidth={1.6} />

  return (
    <>
      <Header title="Mon compte" />
      <div className="flex items-center gap-4 border-b border-neutral-100 px-5 pb-6 pt-2">
        <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-semibold text-white">{me.initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{me.name}</p>
          {me.phone && <p className="tabular text-ink-soft">{me.phone}</p>}
          <p className="truncate text-sm text-ink-muted">{me.email}</p>
          <button onClick={() => open('profil')} className="pill mt-2 bg-sun-300">Voir le profil</button>
        </div>
      </div>
      <ThemeRow />
      <SizeRow />

      <div>
        <Row icon={ico(Target)} label="Budget du mois" onClick={() => open('budget')} />
        <Row icon={ico(PiggyBank)} label="Épargne" onClick={() => open('objectifs')} />
        <Row icon={ico(HandCoins)} label="Dettes" sub="Ce que je dois, ce qu'on me doit" onClick={() => open('dettes')} />
        <Row icon={ico(FolderTree)} label="Catégories" onClick={() => open('categories')} />
        <Row icon={ico(Landmark)} label="Comptes" onClick={() => open('comptes')} />
        <Row icon={ico(Users)} label="Membres" onClick={() => open('membres')} />
        <Row icon={ico(Share2)} label="Famille & partage" sub="Inviter un proche avec le code" onClick={() => open('partage')} />
        <BiometricRow />
        <Row icon={ico(Lightbulb)} label="Remarque / suggestion" sub="Proposer une amélioration" onClick={() => open('remarques')} />
        {isAdmin && <Row icon={ico(Inbox)} label="Boîte de réception" sub="Remarques des utilisateurs (admin)" onClick={() => open('inbox')}
          right={<span className="flex items-center gap-2">{inboxN > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{inboxN}</span>}<ChevronRight size={22} className="text-neutral-400" /></span>} />}
        <Row icon={ico(FileDown)} label="Exporter vers Excel (CSV)" sub={csv.status || undefined} onClick={csv.run} right={<span />} />
        <div className="border-b border-neutral-100 px-5 py-3"><CarnetSwitcher /></div>
        <Row icon={<LogOut size={26} strokeWidth={1.6} />} label={confirmOut ? 'Toucher encore pour confirmer' : 'Se déconnecter'} danger
          onClick={() => (confirmOut ? supabase.auth.signOut() : setConfirmOut(true))} />
      </div>
      <ByNord className="pt-6" />
      <p className="pb-8 pt-1 text-center text-xs text-ink-muted">Budget.Go.Family · version 2.0 · carnet « {carnet?.name} »</p>
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
      { label: "Épargne", Icon: PiggyBank, run: go(() => openSub('objectifs')) },
      { label: 'Dettes', Icon: HandCoins, run: go(() => openSub('dettes')) },
      { label: 'Faire les courses', Icon: ShoppingCart, run: go(() => openSub('courses')) },
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
      { label: 'Remarque', Icon: Lightbulb, run: go(() => openSub('remarques')) },
      { label: 'Exporter (CSV)', Icon: FileDown, run: csv.run },
    ] },
  ]
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="-mx-6 divide-y divide-neutral-100">
        {sections.map((s) => (
          <section key={s.title} className="px-6 py-5">
            <h3 className="mb-4 text-[1.375rem] font-semibold">{s.title}</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {s.items.map(({ label, Icon, run }) => (
                <button key={label} onClick={run} className="tile flex h-[6.5rem] flex-col justify-between p-3 text-left active:scale-[.98]">
                  <Icon size={30} strokeWidth={1.5} />
                  <span className="text-[0.8125rem] leading-tight">{label}</span>
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


function BiometricRow() {
  const { session } = useData()
  const uid = session!.user.id
  const [avail, setAvail] = useState<boolean | null>(null)
  const [on, setOn] = useState(biometricEnabled(uid))
  const [msg, setMsg] = useState('')
  useEffect(() => { biometricAvailable().then(setAvail) }, [])
  const toggle = async () => {
    setMsg('')
    if (on) { disableBiometric(uid); setOn(false); return }
    const e = await enableBiometric(uid, session!.user.email ?? '')
    if (e) setMsg(e); else setOn(true)
  }
  return (
    <Row icon={<Fingerprint size={26} strokeWidth={1.6} />} label="Connexion par empreinte / visage"
      sub={msg || (avail === false ? "Non disponible sur cet appareil ou ce navigateur" : on ? 'Activée · demandée à chaque ouverture' : 'Désactivée')}
      onClick={avail ? toggle : undefined}
      right={<span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-sun-500' : 'bg-neutral-300'} ${avail === false ? 'opacity-40' : ''}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>} />
  )
}

function ThemeRow() {
  const { session, carnet, principalId } = useData()
  const uid = session!.user.id
  const t = useUserTheme(uid)
  const other = carnet && carnet.id !== principalId
  return (
    <div className="border-b border-neutral-100 px-5 py-4">
      <p className="mb-2 text-sm text-ink-muted">Thème de couleur</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((x) => (
          <button key={x.id} onClick={() => setUserTheme(uid, x.id)}
            className={`flex items-center justify-center gap-2 rounded-full border py-2 text-sm transition ${t === x.id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: x.id === 'tropique' ? 'linear-gradient(135deg,#FB923C,#F43F5E,#C026D3)' : x.id === 'ocean' ? 'linear-gradient(135deg,#4F46E5,#0EA5E9,#22D3EE)' : x.color }} />{x.label}
          </button>
        ))}
      </div>
      {other && <p className="mt-2 text-xs text-ink-muted">Tu es dans le carnet « {carnet!.name} » : il a sa propre couleur ({THEMES.find((x) => x.id === themeForCarnet(carnet!.id, principalId, t))!.label}) pour le distinguer de ton carnet principal.</p>}
    </div>
  )
}

function SizeRow() {
  const [v, setV] = useState(getSize())
  return (
    <div className="border-b border-neutral-100 px-5 py-4 lg:hidden">
      <p className="mb-2 text-sm text-ink-muted">Taille d'affichage</p>
      <div className="grid grid-cols-3 gap-2">
        {SIZES.map((x) => (
          <button key={x.id} onClick={() => { applySize(x.id); setV(x.id) }}
            className={`rounded-2xl border px-2 py-2 text-center transition ${v === x.id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>
            <span className={`block font-semibold leading-none ${x.id === 'normal' ? 'text-xl' : x.id === 'compact' ? 'text-lg' : 'text-base'}`}>Aa</span>
            <span className="mt-1 block text-sm">{x.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
