export type Kind = 'depense' | 'revenu'
export interface Carnet { id: string; name: string; currency: string; invite_code: string }
export interface Member { id: string; name: string; color: string; archived: boolean }
export interface Account { id: string; name: string; icon: string; initial_balance: number; archived: boolean }
export interface Category { id: string; kind: Kind; name: string; icon: string; color: string; position: number; archived: boolean }
export interface Tx {
  id: string; kind: Kind; amount: number; category_id: string | null; account_id: string | null
  member_id: string | null; note: string | null; occurred_on: string; created_at: string
}
export interface Budget { id: string; category_id: string | null; monthly_amount: number }
export interface Goal { id: string; name: string; icon: string; target_amount: number; saved_amount: number; deadline: string | null }
