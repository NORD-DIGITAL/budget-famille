import { useEffect, useState } from 'react'
import { Home, PieChart, Plus, UserRound, Wallet } from 'lucide-react'
import { DataProvider, useData } from './lib/data'
import type { Kind, Tx } from './lib/types'
import { Header } from './components/ui'
import TxForm from './components/TxForm'
import { AuthScreen, OnboardingScreen } from './screens/Auth'
import AccueilScreen from './screens/Carnet'
import PortefeuilleScreen from './screens/Portefeuille'
import GraphiquesScreen from './screens/Graphiques'
import CompteScreen, { AllSheet, SUB_TITLES } from './screens/Plus'
import { ProfilePage, ProfileSetup } from './screens/Profile'
import type { SubPage } from './screens/Plus'
import { BudgetPage, DebtsPage, GoalsPage } from './screens/Budget'
import { AccountsPage, CategoriesPage, MembersPage, SharePage } from './screens/Manage'

type Tab = 'accueil' | 'portefeuille' | 'graphiques' | 'compte'

function Shell() {
  const { session, authReady, carnet, carnetReady, profile, profileReady } = useData()
  const [tab, setTab] = useState<Tab>('accueil')
  const [sub, setSub] = useState<SubPage | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formKind, setFormKind] = useState<Kind>('depense')
  const [editing, setEditing] = useState<Tx | null>(null)
  const [allOpen, setAllOpen] = useState(false)

  // Le bouton retour d'Android ferme la sous-page ouverte
  useEffect(() => {
    const onPop = () => { setSub(null); setFormOpen(false); setAllOpen(false) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [tab, sub])
  const openSub = (p: SubPage) => { history.pushState({ p }, ''); setSub(p) }
  const closeSub = () => { if (history.state?.p) history.back(); else setSub(null) }

  if (!authReady || (session && (!carnetReady || !profileReady))) {
    return <div className="flex h-full items-center justify-center bg-white"><div className="h-10 w-10 animate-spin rounded-full border-4 border-sun-100 border-t-sun-500" /></div>
  }
  if (!session) return <AuthScreen />
  if (!profile?.onboarded) return <ProfileSetup />
  if (!carnet) return <OnboardingScreen />

  const openForm = (t: Tx | null, k: Kind = 'depense') => { setEditing(t); setFormKind(k); setFormOpen(true) }

  if (sub) {
    return (
      <div className="mx-auto min-h-full max-w-lg bg-white pb-10">
        <Header title={SUB_TITLES[sub]} onBack={closeSub} />
        {sub === 'budget' && <BudgetPage />}
        {sub === 'objectifs' && <GoalsPage />}
        {sub === 'dettes' && <DebtsPage />}
        {sub === 'categories' && <CategoriesPage />}
        {sub === 'comptes' && <AccountsPage />}
        {sub === 'membres' && <MembersPage />}
        {sub === 'partage' && <SharePage />}
        {sub === 'profil' && <ProfilePage />}
      </div>
    )
  }

  const tabs: { k: Tab; label: string; Icon: typeof Home }[] = [
    { k: 'accueil', label: 'Accueil', Icon: Home },
    { k: 'portefeuille', label: 'Portefeuille', Icon: Wallet },
    { k: 'graphiques', label: 'Graphiques', Icon: PieChart },
    { k: 'compte', label: 'Compte', Icon: UserRound },
  ]
  const NavBtn = ({ k, label, Icon }: (typeof tabs)[number]) => (
    <button onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 text-[12px] ${tab === k ? 'text-white' : 'text-neutral-400'}`}>
      <Icon size={24} strokeWidth={tab === k ? 2.2 : 1.7} className={tab === k ? 'text-sun-500' : ''} />{label}
    </button>
  )

  return (
    <div className={`mx-auto min-h-full max-w-lg pb-28 ${tab === 'accueil' ? 'bg-white' : 'bg-white'}`}>
      {tab === 'accueil' && (
        <AccueilScreen onEdit={(t) => openForm(t)} onAdd={(k) => openForm(null, k)} openSub={openSub}
          goCharts={() => setTab('graphiques')} openAll={() => setAllOpen(true)} goAccount={() => setTab('compte')} />
      )}
      {tab === 'portefeuille' && <PortefeuilleScreen onManage={openSub} />}
      {tab === 'graphiques' && <GraphiquesScreen />}
      {tab === 'compte' && <CompteScreen open={openSub} />}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-ink">
        <div className="relative mx-auto flex max-w-lg items-end px-1">
          <NavBtn {...tabs[0]} />
          <NavBtn {...tabs[1]} />
          <div className="flex flex-1 justify-center">
            <button aria-label="Ajouter une opération" onClick={() => openForm(null)}
              className="-mt-7 mb-2 flex h-[62px] w-[62px] items-center justify-center rounded-[22px] border-4 border-ink bg-sun-500 text-ink shadow-lg active:scale-95">
              <Plus size={32} strokeWidth={2.4} />
            </button>
          </div>
          <NavBtn {...tabs[2]} />
          <NavBtn {...tabs[3]} />
        </div>
      </nav>

      <TxForm open={formOpen} onClose={() => setFormOpen(false)} tx={editing} initialKind={formKind} />
      <AllSheet open={allOpen} onClose={() => setAllOpen(false)} onAdd={(k) => openForm(null, k)} openSub={openSub} goCharts={() => setTab('graphiques')} />
    </div>
  )
}

export default function App() {
  return <DataProvider><Shell /></DataProvider>
}
