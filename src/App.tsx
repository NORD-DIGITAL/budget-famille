import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, MoreHorizontal, PieChart, Plus, Wallet } from 'lucide-react'
import { DataProvider, useData } from './lib/data'
import type { Tx } from './lib/types'
import { Header } from './components/ui'
import TxForm from './components/TxForm'
import { AuthScreen, OnboardingScreen } from './screens/Auth'
import CarnetScreen from './screens/Carnet'
import PortefeuilleScreen from './screens/Portefeuille'
import GraphiquesScreen from './screens/Graphiques'
import PlusScreen, { SUB_TITLES } from './screens/Plus'
import type { SubPage } from './screens/Plus'
import { BudgetPage, GoalsPage } from './screens/Budget'
import { AccountsPage, CategoriesPage, MembersPage, SharePage } from './screens/Manage'

type Tab = 'carnet' | 'portefeuille' | 'graphiques' | 'plus'

function Shell() {
  const { session, authReady, carnet, carnetReady } = useData()
  const [tab, setTab] = useState<Tab>('carnet')
  const [sub, setSub] = useState<SubPage | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tx | null>(null)

  // Android back button / browser back closes sub-pages
  useEffect(() => {
    const onPop = () => { setSub(null); setFormOpen(false) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const openSub = (p: SubPage) => { history.pushState({ p }, ''); setSub(p) }
  const closeSub = () => { if (history.state?.p) history.back(); else setSub(null) }

  if (!authReady || (session && !carnetReady)) {
    return <div className="flex h-full items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /></div>
  }
  if (!session) return <AuthScreen />
  if (!carnet) return <OnboardingScreen />

  const openForm = (t: Tx | null) => { setEditing(t); setFormOpen(true) }

  if (sub) {
    return (
      <div className="min-h-full pb-10">
        <Header title={SUB_TITLES[sub]} left={<button aria-label="Retour" onClick={closeSub} className="rounded-full p-1.5 hover:bg-white/15"><ArrowLeft size={22} /></button>} />
        {sub === 'budget' && <BudgetPage />}
        {sub === 'objectifs' && <GoalsPage />}
        {sub === 'categories' && <CategoriesPage />}
        {sub === 'comptes' && <AccountsPage />}
        {sub === 'membres' && <MembersPage />}
        {sub === 'partage' && <SharePage />}
      </div>
    )
  }

  const tabs: { k: Tab; label: string; Icon: typeof BookOpen }[] = [
    { k: 'carnet', label: 'Carnet', Icon: BookOpen },
    { k: 'portefeuille', label: 'Portefeuille', Icon: Wallet },
    { k: 'graphiques', label: 'Graphiques', Icon: PieChart },
    { k: 'plus', label: 'Plus', Icon: MoreHorizontal },
  ]

  return (
    <div className="mx-auto min-h-full max-w-lg pb-28">
      {tab === 'carnet' && <CarnetScreen onEdit={(t) => openForm(t)} />}
      {tab === 'portefeuille' && <PortefeuilleScreen onManage={openSub} />}
      {tab === 'graphiques' && <GraphiquesScreen />}
      {tab === 'plus' && <PlusScreen open={openSub} />}

      {tab !== 'plus' && (
        <button aria-label="Ajouter une opération" onClick={() => openForm(null)}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/30 active:scale-95"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <Plus size={28} />
        </button>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${tab === k ? 'text-brand-600' : 'text-slate-400'}`}>
              <Icon size={22} strokeWidth={tab === k ? 2.4 : 1.8} />{label}
            </button>
          ))}
        </div>
      </nav>

      <TxForm open={formOpen} onClose={() => setFormOpen(false)} tx={editing} />
    </div>
  )
}

export default function App() {
  return <DataProvider><Shell /></DataProvider>
}
