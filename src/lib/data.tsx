import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { monthKey } from './format'
import type { Account, Budget, Carnet, Category, Goal, Member, Tx } from './types'

interface DataCtx {
  session: Session | null
  authReady: boolean
  carnet: Carnet | null
  carnetReady: boolean
  members: Member[]
  accounts: Account[]
  categories: Category[]
  txs: Tx[]
  budgets: Budget[]
  goals: Goal[]
  month: string
  setMonth: (m: string) => void
  reload: () => Promise<void>
  loadCarnet: () => Promise<void>
  cur: string
  catById: Map<string, Category>
  accById: Map<string, Account>
  memById: Map<string, Member>
}

const Ctx = createContext<DataCtx>(null as unknown as DataCtx)
export const useData = () => useContext(Ctx)

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [carnet, setCarnet] = useState<Carnet | null>(null)
  const [carnetReady, setCarnetReady] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [month, setMonth] = useState(monthKey(new Date()))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadCarnet = useCallback(async () => {
    if (!session) { setCarnet(null); setCarnetReady(true); return }
    const { data } = await supabase.from('carnets').select('id,name,currency,invite_code').order('created_at').limit(1)
    setCarnet((data?.[0] as Carnet) ?? null)
    setCarnetReady(true)
  }, [session])

  useEffect(() => { setCarnetReady(false); loadCarnet() }, [loadCarnet])

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
    const [m, a, cat, t, b, g] = await Promise.all([
      all<Member>('members', 'id,name,color,archived', 'created_at'),
      all<Account>('accounts', 'id,name,icon,initial_balance,archived', 'created_at'),
      all<Category>('categories', 'id,kind,name,icon,color,position,archived', 'position'),
      all<Tx>('transactions', 'id,kind,amount,category_id,account_id,member_id,note,occurred_on,created_at', 'occurred_on', false),
      all<Budget>('budgets', 'id,category_id,monthly_amount', 'created_at'),
      all<Goal>('savings_goals', 'id,name,icon,target_amount,saved_amount,deadline', 'created_at'),
    ])
    setMembers(m); setAccounts(a); setCategories(cat); setTxs(t); setBudgets(b); setGoals(g)
  }, [carnet])

  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [reload])

  const value = useMemo<DataCtx>(() => ({
    session, authReady, carnet, carnetReady, members, accounts, categories, txs, budgets, goals,
    month, setMonth, reload, loadCarnet, cur: carnet?.currency ?? 'Ar',
    catById: new Map(categories.map((x) => [x.id, x])),
    accById: new Map(accounts.map((x) => [x.id, x])),
    memById: new Map(members.map((x) => [x.id, x])),
  }), [session, authReady, carnet, carnetReady, members, accounts, categories, txs, budgets, goals, month, reload, loadCarnet])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
