import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { monthKey } from './format'
import type { Account, Budget, Carnet, Category, Child, Debt, DebtPayment, Goal, Member, Profile, SavingsMove, ShoppingItem, ShoppingList, Tx } from './types'

const CARNET_KEY = 'bf-carnet'
const readSel = () => { try { return localStorage.getItem(CARNET_KEY) } catch { return null } }
const writeSel = (id: string) => { try { localStorage.setItem(CARNET_KEY, id) } catch { /* ignore */ } }

interface DataCtx {
  session: Session | null
  authReady: boolean
  carnets: Carnet[]
  carnet: Carnet | null
  carnetReady: boolean
  switchCarnet: (id: string) => void
  profile: Profile | null
  profileReady: boolean
  reloadProfile: () => Promise<void>
  familyChildren: Child[]
  members: Member[]
  accounts: Account[]
  categories: Category[]
  txs: Tx[]
  budgets: Budget[]
  goals: Goal[]
  debts: Debt[]
  moves: SavingsMove[]
  lists: ShoppingList[]
  items: ShoppingItem[]
  isAdmin: boolean
  payments: DebtPayment[]
  principalId: string | null
  month: string
  setMonth: (m: string) => void
  reload: () => Promise<void>
  loadCarnet: () => Promise<void>
  cur: string
  catById: Map<string, Category>
  accById: Map<string, Account>
  memById: Map<string, Member>
  childrenOf: Map<string | null, Category[]>
  rootOf: (id: string | null) => Category | undefined
  catPath: (id: string | null) => string
}

const Ctx = createContext<DataCtx>(null as unknown as DataCtx)
export const useData = () => useContext(Ctx)

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [carnets, setCarnets] = useState<Carnet[]>([])
  const [selId, setSelId] = useState<string | null>(readSel())
  const [carnetReady, setCarnetReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [familyChildren, setFamilyChildren] = useState<Child[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [moves, setMoves] = useState<SavingsMove[]>([])
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [month, setMonth] = useState(monthKey(new Date()))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const uid = session?.user.id ?? null

  const loadCarnet = useCallback(async () => {
    if (!uid) { setCarnets([]); setCarnetReady(true); return }
    const { data } = await supabase.rpc('my_carnets')
    setCarnets((data as Carnet[]) ?? [])
    setCarnetReady(true)
  }, [uid])
  useEffect(() => { setCarnetReady(false); loadCarnet() }, [loadCarnet])

  const reloadProfile = useCallback(async () => {
    if (!uid) { setProfile(null); setProfileReady(true); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
    setProfileReady(true)
  }, [uid])
  useEffect(() => { setProfileReady(false); reloadProfile() }, [reloadProfile])
  useEffect(() => { if (uid) supabase.rpc('is_app_admin').then(({ data }) => setIsAdmin(!!data)); else setIsAdmin(false) }, [uid])

  const carnet = useMemo(() => carnets.find((c) => c.id === selId) ?? carnets[0] ?? null, [carnets, selId])
  const principalId = (carnets.find((c) => c.role === 'proprietaire') ?? carnets[0])?.id ?? null
  const switchCarnet = (id: string) => { writeSel(id); setSelId(id) }

  const reload = useCallback(async () => {
    if (!carnet) return
    const c = carnet.id
    const all = async <T,>(table: string, cols: string, order: string, asc = true): Promise<T[]> => {
      const out: T[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(table).select(cols).eq('carnet_id', c)
          .order(order, { ascending: asc }).range(from, from + 999)
        if (error || !data) break
        out.push(...(data as T[]))
        if (data.length < 1000) break
      }
      return out
    }
    const [m, a, cat, t, b, g, d, cu, mv, pay, sl, si] = await Promise.all([
      all<Member>('members', 'id,name,color,archived', 'created_at'),
      all<Account>('accounts', 'id,name,icon,initial_balance,archived', 'created_at'),
      all<Category>('categories', 'id,kind,name,icon,color,position,archived,parent_id,unit,is_default', 'position'),
      all<Tx>('transactions', 'id,kind,amount,category_id,account_id,member_id,note,occurred_on,created_at,quantity,unit,child_name,for_month,ref,beneficiary', 'occurred_on', false),
      all<Budget>('budgets', 'id,category_id,monthly_amount', 'created_at'),
      all<Goal>('savings_goals', 'id,name,icon,target_amount,saved_amount,deadline,kind,support,bank,phone,monthly_day,monthly_amount', 'created_at'),
      all<Debt>('debts', 'id,direction,person,amount,paid,due_date,note', 'created_at'),
      supabase.from('carnet_users').select('user_id').eq('carnet_id', c),
      all<SavingsMove>('savings_moves', 'id,goal_id,amount,method,ref,note,moved_on', 'moved_on', false),
      all<DebtPayment>('debt_payments', 'id,debt_id,amount,method,ref,note,paid_on', 'paid_on', false),
      all<ShoppingList>('shopping_lists', 'id,name,status,account_id,member_id,created_at,validated_at,finished_at', 'created_at', false),
      all<ShoppingItem>('shopping_items', 'id,list_id,category_id,label,quantity,unit,est_price,final_price,taken,cancelled,position', 'position'),
    ])
    setMembers(m); setAccounts(a); setCategories(cat); setTxs(t); setBudgets(b); setGoals(g); setDebts(d); setMoves(mv); setPayments(pay); setLists(sl); setItems(si)
    // Enfants déclarés dans les profils des personnes de ce carnet
    const ids = (cu.data ?? []).map((r: { user_id: string }) => r.user_id)
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('children').in('id', ids)
      const seen = new Set<string>(); const kids: Child[] = []
      for (const p of (ps ?? []) as { children: Child[] }[]) for (const k of p.children ?? []) {
        const key = k.name.trim().toLowerCase()
        if (k.name.trim() && !seen.has(key)) { seen.add(key); kids.push(k) }
      }
      setFamilyChildren(kids)
    } else setFamilyChildren([])
  }, [carnet])

  useEffect(() => { reload() }, [reload, profile])
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [reload])

  const value = useMemo<DataCtx>(() => {
    const catById = new Map(categories.map((x) => [x.id, x]))
    const childrenOf = new Map<string | null, Category[]>()
    for (const c of categories) {
      const k = c.parent_id && catById.has(c.parent_id) ? c.parent_id : null
      if (!childrenOf.has(k)) childrenOf.set(k, [])
      childrenOf.get(k)!.push(c)
    }
    const rootOf = (id: string | null) => {
      let c = id ? catById.get(id) : undefined
      for (let i = 0; c?.parent_id && catById.has(c.parent_id) && i < 10; i++) c = catById.get(c.parent_id)
      return c
    }
    const catPath = (id: string | null) => {
      const parts: string[] = []
      let c = id ? catById.get(id) : undefined
      for (let i = 0; c && i < 10; i++) { parts.unshift(c.name); c = c.parent_id ? catById.get(c.parent_id) : undefined }
      return parts.join(' › ')
    }
    return {
      session, authReady, carnets, carnet, carnetReady, switchCarnet, profile, profileReady, reloadProfile, familyChildren,
      members, accounts, categories, txs, budgets, goals, debts, moves, payments, principalId, lists, items, isAdmin, month, setMonth, reload, loadCarnet, cur: carnet?.currency ?? 'Ar',
      catById, accById: new Map(accounts.map((x) => [x.id, x])), memById: new Map(members.map((x) => [x.id, x])),
      childrenOf, rootOf, catPath,
    }
  }, [session, authReady, carnets, carnet, carnetReady, profile, profileReady, reloadProfile, familyChildren, members, accounts, categories, txs, budgets, goals, debts, moves, payments, principalId, lists, items, isAdmin, month, reload, loadCarnet])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
