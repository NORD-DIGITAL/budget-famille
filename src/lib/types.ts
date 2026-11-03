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
export interface Recurring { id: string; label: string; amount: number; category_id: string | null; account_id: string | null; member_id: string | null; day_of_month: number; mode: 'auto' | 'valider'; active: boolean; last_month: string | null; start_month: string; start_on: string | null }
export interface RecurringDue { id: string; label: string; amount: number; category_id: string | null; account_id: string | null; member_id: string | null; day_of_month: number; mode: 'auto' | 'valider'; due_month: string; due_date: string }
export interface Budget { id: string; category_id: string | null; monthly_amount: number }
export type GoalKind = 'objectif' | 'principal' | 'familiale' | 'materiel' | 'perso' | 'autre'
export interface Goal {
  id: string; name: string; icon: string; target_amount: number | null; saved_amount: number; deadline: string | null
  kind: GoalKind; support: 'banque' | 'mvola' | 'orange' | null; bank: string | null; phone: string | null
  monthly_day: number | null; monthly_amount: number | null
}
export interface SavingsMove { id: string; goal_id: string; amount: number; method: string | null; ref: string | null; note: string | null; moved_on: string; account_id?: string | null }
export interface DebtPayment { id: string; debt_id: string; amount: number; method: string | null; ref: string | null; note: string | null; paid_on: string; account_id?: string | null }
export interface Attachment { id: string; entity: 'goal' | 'debt'; entity_id: string; move_id: string | null; path: string; size: number; owner: string }
export interface Debt { id: string; direction: 'je_dois' | 'on_me_doit'; person: string; amount: number; paid: number; due_date: string | null; note: string | null; account_id?: string | null; lent_on?: string | null }
/** Transfert entre deux comptes du portefeuille (v3.11). */
export interface Transfer { id: string; from_account: string; to_account: string; amount: number; moved_on: string; ref: string | null; note: string | null; created_at: string }
/** Projet d'investissement de Business Pro (v3.11). */
export type InvType = 'vente' | 'partenariat' | 'autre'
export interface InvProject { id: string; name: string; activite: string; type: InvType; type_autre: string; archived: boolean; created_at: string }
export type InvKind = 'capital' | 'depense' | 'revenu' | 'versement'
export interface InvMove { id: string; project_id: string; kind: InvKind; amount: number; account_id: string | null; moved_on: string; note: string | null; created_at: string }
export interface Child { name: string; age: number | null; school?: boolean }
export interface Profile {
  id: string; full_name: string | null; birth_date: string | null; sex: 'homme' | 'femme' | null
  region: string | null; city: string | null; profession: string | null
  marital_status: 'celibataire' | 'conjoint' | 'partenaire' | 'marie' | null; children: Child[]; onboarded: boolean
}
export interface ShoppingList { id: string; name: string; status: 'brouillon' | 'prete' | 'terminee' | 'annulee'; account_id: string | null; member_id: string | null; created_at: string; validated_at: string | null; finished_at: string | null; planned_on: string | null }
export interface ShoppingItem { id: string; list_id: string; category_id: string | null; label: string | null; quantity: number | null; unit: string | null; est_price: number | null; final_price: number | null; taken: boolean; cancelled: boolean; position: number }
export interface Feedback { id: string; user_id: string; sender_name: string | null; sender_email: string | null; kind: 'amelioration' | 'probleme' | 'autre'; message: string; status: 'nouveau' | 'lu' | 'traite'; created_at: string }
