import { useCallback, useEffect, useRef, useState } from 'react'
import { Ban, Download, UsersRound, Inbox, Lightbulb, ShoppingCart, Fingerprint, HandCoins, Home, LogOut, PieChart, PiggyBank, Plus, RefreshCw, Target, UserRound, Wallet } from 'lucide-react'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './lib/data'
import { userInfo } from './lib/prefs'
import { biometricAvailable, biometricEnabled, enableBiometric, markAuth, sessionExpired, verifyBiometric } from './lib/lock'
import type { Kind, Tx } from './lib/types'
import { ByNord, Header, Sheet, Wordmark } from './components/ui'
import { CarnetSwitcher } from './components/Carnets'
import { applyTheme, themeForCarnet, useUserTheme } from './lib/theme'
import TxForm from './components/TxForm'
import { AuthScreen, Brand, OnboardingScreen } from './screens/Auth'
import AccueilScreen from './screens/Carnet'
import PortefeuilleScreen from './screens/Portefeuille'
import GraphiquesScreen from './screens/Graphiques'
import CompteScreen, { AllSheet, SUB_TITLES } from './screens/Plus'
import { ProfilePage, ProfileSetup } from './screens/Profile'
import type { SubPage } from './screens/Plus'
import { BudgetPage } from './screens/Budget'
import { DebtsPage, GoalsPage } from './screens/Savings'
import { syncReminders } from './lib/reminders'
import { CoursesPage } from './screens/Courses'
import { FeedbackPage, InboxPage } from './screens/Feedback'
import { PrivacyPage } from './screens/Privacy'
import { useBadge, useInboxSync } from './lib/inbox'
import { APP_VERSION, OLD_VERSION_MSG, isNative, openApk, reloadLatestWeb, useAppConfig } from './lib/version'
import type { AppConfig } from './lib/version'
import { GoCodeScreen, hasAccess } from './screens/GoCode'
import { UsersPage } from './screens/Admin'
import { AccountsPage, CategoriesPage, MembersPage, SharePage } from './screens/Manage'

type Tab = 'accueil' | 'portefeuille' | 'graphiques' | 'compte'
const AUTO_OUT_KEY = 'bf-auto-logout'

/* ---------- Écran verrouillé (empreinte / visage) ---------- */
function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { session, profile } = useData()
  const me = userInfo(session, profile)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const tryUnlock = useCallback(async () => {
    setBusy(true); setErr('')
    const ok = await verifyBiometric(session!.user.id)
    setBusy(false)
    if (ok) { markAuth(session!.user.id); onUnlock() } else setErr("Non reconnu. Réessaie ou utilise ton mot de passe.")
  }, [session, onUnlock])
  useEffect(() => { tryUnlock() }, [tryUnlock])
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col items-center bg-white px-6 pt-16 text-center">
      <Brand />
      <p className="mt-8 text-xl text-ink-soft">Bienvenue</p>
      <p className="text-2xl font-medium">{me.name}</p>
      <button onClick={tryUnlock} disabled={busy} aria-label="Déverrouiller avec l'empreinte ou le visage"
        className="mt-12 flex h-28 w-28 items-center justify-center rounded-full border-4 border-sun-500 bg-sun-50 active:scale-95">
        <Fingerprint size={56} strokeWidth={1.4} />
      </button>
      <p className="mt-4 text-ink-muted">{busy ? 'Vérification…' : 'Touche pour déverrouiller'}</p>
      {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      <button onClick={() => supabase.auth.signOut()} className="mt-auto py-3 text-[0.9375rem] text-[#4A56E2]">Utiliser mon mot de passe</button>
      <ByNord className="mb-6 mt-2" />
    </div>
  )
}

/* ---------- Tirer vers le bas pour actualiser (mobile) ---------- */
function usePullToRefresh(onRefresh: () => Promise<void>, enabled: boolean) {
  const [pull, setPull] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    const sheetOpen = () => !!document.querySelector('[data-sheet]')
    const ts = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !sheetOpen() ? e.touches[0].clientY : null }
    const tm = (e: TouchEvent) => {
      if (start.current == null) return
      const dy = e.touches[0].clientY - start.current
      setPull(dy > 0 ? Math.min(dy * 0.45, 90) : 0)
    }
    const te = async () => {
      if (start.current == null) return
      start.current = null
      setPull((p) => {
        if (p > 60) {
          setSpinning(true)
          onRefresh().finally(() => { setSpinning(false); setPull(0) })
          return 60
        }
        return 0
      })
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchmove', tm, { passive: true })
    window.addEventListener('touchend', te)
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te) }
  }, [onRefresh, enabled])
  return { pull, spinning }
}

function Shell() {
  const { session, authReady, carnet, carnetReady, profile, profileReady, reload, loadCarnet, reloadProfile, principalId, goals, isAdmin, expiresAt, accessReady } = useData()
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60_000); return () => clearInterval(t) }, [])
  const inboxN = useBadge()
  const cfg = useAppConfig()
  const [tab, setTab] = useState<Tab>('accueil')
  const [sub, setSub] = useState<SubPage | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formKind, setFormKind] = useState<Kind>('depense')
  const [editing, setEditing] = useState<Tx | null>(null)
  const [allOpen, setAllOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [askBio, setAskBio] = useState(false)
  const [bioMsg, setBioMsg] = useState('')
  const uid = session?.user.id ?? null
  const checkedFor = useRef<string | null>(null)
  const userTheme = useUserTheme(uid)
  useInboxSync(uid, isAdmin)
  useEffect(() => { if (carnet) syncReminders(goals, carnet.name) }, [goals, carnet])
  useEffect(() => { applyTheme(themeForCarnet(carnet?.id ?? null, principalId, userTheme)) }, [carnet?.id, principalId, userTheme])

  // Le bouton retour d'Android ferme la sous-page ouverte
  useEffect(() => {
    const onPop = () => { setSub(null); setFormOpen(false); setAllOpen(false) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [tab, sub])
  const openSub = (p: SubPage) => { history.pushState({ p }, ''); setSub(p) }
  const closeSub = () => { if (history.state?.p) history.back(); else setSub(null) }

  // À l'ouverture : verrou empreinte, et proposition de l'activer après une connexion par mot de passe
  useEffect(() => {
    if (!uid || checkedFor.current === uid) return
    checkedFor.current = uid
    if (biometricEnabled(uid)) setLocked(true)
    else {
      let asked = false
      try { asked = localStorage.getItem(`bf-bio-ask-${uid}`) === '1' } catch { /* ignore */ }
      if (!asked) biometricAvailable().then((ok) => { if (ok) setAskBio(true) })
    }
  }, [uid])

  // Déconnexion automatique à 8 h et 18 h
  useEffect(() => {
    if (!uid) return
    const check = () => {
      if (!sessionExpired(uid)) return
      if (biometricEnabled(uid)) setLocked(true)
      else {
        try { sessionStorage.setItem(AUTO_OUT_KEY, '1') } catch { /* ignore */ }
        supabase.auth.signOut()
      }
    }
    check()
    const t = setInterval(check, 60_000)
    const v = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [uid])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCarnet(), reloadProfile()])
    await reload()
  }, [loadCarnet, reloadProfile, reload])
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const { pull, spinning } = usePullToRefresh(refreshAll, !!session && !locked && isTouch)

  if (!authReady || (session && (!carnetReady || !profileReady || !accessReady))) {
    return <div className="flex h-full items-center justify-center bg-white"><div className="h-10 w-10 animate-spin rounded-full border-4 border-sun-100 border-t-sun-500" /></div>
  }
  if (cfg && APP_VERSION < cfg.min) return <OldVersionScreen cfg={cfg} />
  if (!session) return <AuthScreen />
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />
  if (!profile?.onboarded || !profile.full_name?.trim()) return <ProfileSetup />
  if (!hasAccess(isAdmin, expiresAt)) return <GoCodeScreen />
  if (!carnet) return <OnboardingScreen />

  const openForm = (t: Tx | null, k: Kind = 'depense') => { setEditing(t); setFormKind(k); setFormOpen(true) }
  const goTab = (k: Tab) => { if (sub) closeSub(); setTab(k) }
  const me = userInfo(session, profile)

  const tabs: { k: Tab; label: string; Icon: typeof Home }[] = [
    { k: 'accueil', label: 'Accueil', Icon: Home },
    { k: 'portefeuille', label: 'Portefeuille', Icon: Wallet },
    { k: 'graphiques', label: 'Graphiques', Icon: PieChart },
    { k: 'compte', label: 'Compte', Icon: UserRound },
  ]
  const NavBtn = ({ k, label, Icon }: (typeof tabs)[number]) => (
    <button onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 text-[0.75rem] ${tab === k ? 'text-white' : 'text-neutral-400'}`}>
      <span className="relative"><Icon size={24} strokeWidth={tab === k ? 2.2 : 1.7} className={tab === k ? 'text-sun-500' : ''} />
        {k === 'compte' && inboxN > 0 && <span className="absolute -right-2.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.625rem] font-bold text-white ring-2 ring-ink">{inboxN > 99 ? '99+' : inboxN}</span>}
      </span>{label}
    </button>
  )
  const SideLink = ({ active, onClick, Icon, label, badge }: { active?: boolean; onClick: () => void; Icon: typeof Home; label: string; badge?: number }) => (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${active ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}>
      <span className="relative"><Icon size={22} strokeWidth={active ? 2.2 : 1.7} className={active ? 'text-sun-500' : ''} />{!!badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-ink" />}</span>
      <span className="flex-1">{label}</span>{!!badge && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>}
    </button>
  )

  return (
    <div className="min-h-full bg-white lg:bg-cream lg:pl-72">
      {/* Indicateur « tirer pour actualiser » */}
      {(pull > 0 || spinning) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center" style={{ transform: `translateY(${Math.max(pull, spinning ? 60 : 0) - 20}px)` }}>
          <div className="pt-safe"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg">
            <RefreshCw size={22} className={spinning ? 'animate-spin text-sun-600' : 'text-ink'} style={{ transform: spinning ? undefined : `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 60) + (spinning ? 1 : 0) }} />
          </div></div>
        </div>
      )}

      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-ink p-5 text-white lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-500 text-ink"><Wallet size={24} /></div>
          <Wordmark className="text-xl" dark />
        </div>
        <button onClick={() => openForm(null)} className="btn-primary mb-6 w-full"><Plus size={20} /> Nouvelle opération</button>
        <nav className="space-y-1">
          {tabs.map((t) => <SideLink key={t.k} active={!sub && tab === t.k} onClick={() => goTab(t.k)} Icon={t.Icon} label={t.label} />)}
        </nav>
        <p className="mb-2 mt-8 px-4 text-xs uppercase tracking-wider text-neutral-500">Suivi</p>
        <nav className="space-y-1">
          <SideLink active={sub === 'budget'} onClick={() => openSub('budget')} Icon={Target} label="Budget du mois" />
          <SideLink active={sub === 'objectifs'} onClick={() => openSub('objectifs')} Icon={PiggyBank} label="Épargne" />
          <SideLink active={sub === 'dettes'} onClick={() => openSub('dettes')} Icon={HandCoins} label="Dettes" />
          <SideLink active={sub === 'courses'} onClick={() => openSub('courses')} Icon={ShoppingCart} label="Faire les courses" />
        </nav>
        <div className="mt-auto space-y-2">
          <SideLink active={sub === 'remarques'} onClick={() => openSub('remarques')} Icon={Lightbulb} label="Remarque / suggestion" />
          {isAdmin && <SideLink active={sub === 'users'} onClick={() => openSub('users')} Icon={UsersRound} label="Utilisateurs" />}
          <SideLink active={sub === 'inbox'} onClick={() => openSub('inbox')} Icon={Inbox} label="Boîte de réception" badge={inboxN} />
          <SideLink onClick={refreshAll} Icon={RefreshCw} label="Actualiser" />
          <CarnetSwitcher variant="dark" />
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun-500 font-semibold text-ink">{me.initials}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{me.name}</p><p className="truncate text-xs text-neutral-400">{carnet.name}</p></div>
            <button onClick={() => supabase.auth.signOut()} aria-label="Se déconnecter" className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white"><LogOut size={18} /></button>
          </div>
          <ByNord light className="pt-1" />
        </div>
      </aside>

      <main className="mx-auto min-h-full max-w-lg bg-white pb-28 lg:mx-6 lg:my-6 lg:max-w-none lg:overflow-hidden lg:rounded-[32px] lg:pb-10 lg:shadow-sm 2xl:mx-10">
        {sub ? (
          <div className="lg:mx-auto lg:max-w-3xl">
            <Header title={SUB_TITLES[sub]} onBack={closeSub} />
            {sub === 'budget' && <BudgetPage />}
            {sub === 'objectifs' && <GoalsPage />}
            {sub === 'dettes' && <DebtsPage />}
            {sub === 'categories' && <CategoriesPage />}
            {sub === 'comptes' && <AccountsPage />}
            {sub === 'membres' && <MembersPage />}
            {sub === 'partage' && <SharePage />}
            {sub === 'profil' && <ProfilePage />}
            {sub === 'courses' && <CoursesPage />}
            {sub === 'remarques' && <FeedbackPage />}
            {sub === 'inbox' && <InboxPage />}
            {sub === 'users' && <UsersPage />}
            {sub === 'confidentialite' && <PrivacyPage />}
          </div>
        ) : (
          <>
            {tab === 'accueil' && isNative && cfg && cfg.latest > APP_VERSION && cfg.apkUrl && (
              <button onClick={() => openApk(cfg.apkUrl)} className="pt-safe flex w-full items-center gap-3 bg-ink px-5 py-3 text-left text-sm text-white">
                <Download size={20} className="shrink-0 text-sun-500" /><span className="flex-1"><b>Nouvelle version disponible.</b> Touche ici pour la télécharger puis l'installer.</span>
              </button>
            )}
            {tab === 'accueil' && (
              <AccueilScreen onEdit={(t) => openForm(t)} onAdd={(k) => openForm(null, k)} openSub={openSub} onRefresh={refreshAll}
                goCharts={() => setTab('graphiques')} openAll={() => setAllOpen(true)} />
            )}
            {tab === 'portefeuille' && <PortefeuilleScreen onManage={openSub} />}
            {tab === 'graphiques' && <GraphiquesScreen />}
            {tab === 'compte' && <div className="lg:mx-auto lg:max-w-3xl"><CompteScreen open={openSub} /></div>}
          </>
        )}
      </main>

      {!sub && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-ink lg:hidden">
          <div className="relative mx-auto flex max-w-lg items-end px-1">
            <NavBtn {...tabs[0]} />
            <NavBtn {...tabs[1]} />
            <div className="flex flex-1 justify-center">
              <button aria-label="Ajouter une opération" onClick={() => openForm(null)}
                className="-mt-7 mb-2 flex h-[3.875rem] w-[3.875rem] items-center justify-center rounded-[22px] border-4 border-ink bg-sun-500 text-ink shadow-lg active:scale-95">
                <Plus size={32} strokeWidth={2.4} />
              </button>
            </div>
            <NavBtn {...tabs[2]} />
            <NavBtn {...tabs[3]} />
          </div>
        </nav>
      )}

      <TxForm open={formOpen} onClose={() => setFormOpen(false)} tx={editing} initialKind={formKind} />
      <AllSheet open={allOpen} onClose={() => setAllOpen(false)} onAdd={(k) => openForm(null, k)} openSub={openSub} goCharts={() => setTab('graphiques')} />

      <Sheet open={askBio} onClose={() => { setAskBio(false); try { localStorage.setItem(`bf-bio-ask-${uid}`, '1') } catch { /* ignore */ } }} title="Connexion rapide">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sun-100"><Fingerprint size={44} strokeWidth={1.4} /></div>
          <p className="text-ink-soft">Ouvre l'application avec ton <b>empreinte</b> ou ton <b>visage</b>, sans retaper ton mot de passe.</p>
          {bioMsg && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{bioMsg}</p>}
          <button className="btn-primary w-full" onClick={async () => {
            const e = await enableBiometric(uid!, session.user.email ?? '')
            if (e) setBioMsg(e)
            else { try { localStorage.setItem(`bf-bio-ask-${uid}`, '1') } catch { /* ignore */ } setAskBio(false) }
          }}>Activer</button>
          <button className="w-full py-2 text-ink-muted" onClick={() => { setAskBio(false); try { localStorage.setItem(`bf-bio-ask-${uid}`, '1') } catch { /* ignore */ } }}>Plus tard</button>
        </div>
      </Sheet>
    </div>
  )
}

/* ---------- Ancienne version bloquée (règle NORD DIGITAL) ---------- */
function OldVersionScreen({ cfg }: { cfg: AppConfig }) {
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col items-center bg-white px-6 pt-16 text-center">
      <Brand />
      <div className="mt-10 flex h-20 w-20 items-center justify-center rounded-full bg-red-50"><Ban size={40} className="text-red-500" /></div>
      <p className="mt-6 text-lg font-semibold">{OLD_VERSION_MSG}</p>
      <p className="mt-2 text-sm text-ink-muted">Pour continuer, installe la nouvelle version de l'application.</p>
      {isNative
        ? cfg.apkUrl && <button onClick={() => openApk(cfg.apkUrl)} className="btn-primary mt-8 w-full"><Download size={20} /> Télécharger la nouvelle version</button>
        : <button onClick={reloadLatestWeb} className="btn-primary mt-8 w-full"><RefreshCw size={20} /> Charger la nouvelle version</button>}
      <a href="mailto:gosamsan1122@gmail.com" className="mt-4 py-2 text-sm text-[#4A56E2]">Contacter NORD DIGITAL</a>
      <ByNord className="mb-6 mt-auto" />
    </div>
  )
}

export default function App() {
  return <DataProvider><Shell /></DataProvider>
}
