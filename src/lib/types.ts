export type Kind = 'depense' | 'revenu'
export interface Carnet { id: string; name: string; currency: string; invite_code: string; role?: string; members?: number }
export interface Member { id: string; name: string; color: string; archived: boolean }
export interface Account { id: string; name: string; icon: string; initial_balance: number; archived: boolean }
export interface Category {
  id: string; kind: Kind; name: string; icon: string; color: string; position: number; archived: boolean
  parent_id: string | null; unit: string | null
}
export interface Tx {
  id: string; kind: Kind; amount: number; category_id: string | null; account_id: string | null
  member_id: string | null; note: string | null; occurred_on: string; created_at: string
  quantity: number | null; unit: string | null; child_name: string | null
}
export interface Budget { id: string; category_id: string | null; monthly_amount: number }
export interface Goal { id: string; name: string; icon: string; target_amount: number; saved_amount: number; deadline: string | null }
export interface Debt { id: string; direction: 'je_dois' | 'on_me_doit'; person: string; amount: number; paid: number; due_date: string | null; note: string | null }
export interface Child { name: string; age: number | null }
export interface Profile {
  id: string; full_name: string | null; birth_date: string | null; sex: 'homme' | 'femme' | null
  region: string | null; city: string | null; profession: string | null
  marital_status: 'celibataire' | 'conjoint' | 'partenaire' | 'marie' | null; children: Child[]; onboarded: boolean
}
