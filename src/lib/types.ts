export type Kind = 'depense' | 'revenu'
export interface Carnet { id: string; name: string; currency: string; invite_code: string; role?: string; members?: number }
export interface Member { id: string; name: string; color: string; archived: boolean }
export interface Account { id: string; name: string; icon: string; initial_balance: number; archived: boolean }
export interface Category {
  id: string; kind: Kind; name: string; icon: string; color: string; position: number; archived: boolean
  parent_id: string | null; unit: string | null; is_default: boolean
}
export interface Tx {
  id: string; kind: Kind; amount: number; category_id: string | null; account_id: string | null
  member_id: string | null; note: string | null; occurred_on: string; created_at: string
  quantity: number | null; unit: string | null; child_name: string | null; for_month: string | null; ref: string | null; beneficiary: string | null
}
export interface Budget { id: string; category_id: string | null; monthly_amount: number }
export type GoalKind = 'objectif' | 'principal' | 'familiale' | 'materiel' | 'perso' | 'autre'
export interface Goal {
  id: string; name: string; icon: string; target_amount: number | null; saved_amount: number; deadline: string | null
  kind: GoalKind; support: 'banque' | 'mvola' | 'orange' | null; bank: string | null; phone: string | null
  monthly_day: number | null; monthly_amount: number | null
}
export interface SavingsMove { id: string; goal_id: string; amount: number; method: string | null; ref: string | null; note: string | null; moved_on: string }
export interface DebtPayment { id: string; debt_id: string; amount: number; method: string | null; ref: string | null; note: string | null; paid_on: string }
export interface Attachment { id: string; entity: 'goal' | 'debt'; entity_id: string; move_id: string | null; path: string; size: number; owner: string }
export interface Debt { id: string; direction: 'je_dois' | 'on_me_doit'; person: string; amount: number; paid: number; due_date: string | null; note: string | null }
export interface Child { name: string; age: number | null; school?: boolean }
export interface Profile {
  id: string; full_name: string | null; birth_date: string | null; sex: 'homme' | 'femme' | null
  region: string | null; city: string | null; profession: string | null
  marital_status: 'celibataire' | 'conjoint' | 'partenaire' | 'marie' | null; children: Child[]; onboarded: boolean
}
export interface ShoppingList { id: string; name: string; status: 'brouillon' | 'prete' | 'terminee' | 'annulee'; account_id: string | null; member_id: string | null; created_at: string; validated_at: string | null; finished_at: string | null }
export interface ShoppingItem { id: string; list_id: string; category_id: string | null; label: string | null; quantity: number | null; unit: string | null; est_price: number | null; final_price: number | null; taken: boolean; cancelled: boolean; position: number }
export interface Feedback { id: string; user_id: string; sender_name: string | null; sender_email: string | null; kind: 'amelioration' | 'probleme' | 'autre'; message: string; status: 'nouveau' | 'lu' | 'traite'; created_at: string }
