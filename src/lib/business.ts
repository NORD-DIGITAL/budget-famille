import { supabase } from './supabase'
import { isMissingTable } from './travail'

/* ---------- Business Pro : fournisseurs et clients en légumes (partagé entre partenaires) ---------- */

export const PRODUITS = ['Pomme de terre', 'Oignon', 'Carotte', 'Courgette', 'Sakaitany', 'Ail']
export const AUTRES = 'Autres'
export const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
export const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export const PAIEMENTS = ['Espèces', 'MVola', 'Orange Money', 'Airtel Money', 'Chèque', 'TPE']
export const UNITES = ['kg', 'sac', 'daba', 'garaba', 'kapoaka', 'pièce']
export const REGIONS = ['Analamanga', 'Vakinankaratra', 'Itasy', 'Bongolava', 'Haute Matsiatra', "Amoron'i Mania", 'Vatovavy', 'Fitovinany', 'Ihorombe', 'Atsimo-Atsinanana', 'Atsinanana', 'Analanjirofo', 'Alaotra-Mangoro', 'Boeny', 'Sofia', 'Betsiboka', 'Melaky', 'Atsimo-Andrefana', 'Androy', 'Anosy', 'Menabe', 'Diana', 'Sava']

export type Kind = 'fournisseur' | 'client'
export type TxType = 'achat' | 'vente'

export interface Contact {
  id: string; nom: string; tel: string; produits: string[]; autres: string; notes: string
  quartier?: string; region?: string; mois?: number[]
  created_at: string; updated_at: string
}
export interface BpTx {
  id: string; type: TxType; contact_id: string | null; contact_nom: string; produit: string
  qte: number; unite: string; prix_u: number; montant: number; jour: string; paiement: string; note: string
  created_at: string; updated_at: string
}

export const TABLE: Record<Kind, string> = { fournisseur: 'bp_fournisseurs', client: 'bp_clients' }
export const kindOf = (t: TxType): Kind => (t === 'achat' ? 'fournisseur' : 'client')
export const txOf = (k: Kind): TxType => (k === 'fournisseur' ? 'achat' : 'vente')

export async function loadBusiness() {
  const [f, c, t] = await Promise.all([
    supabase.from('bp_fournisseurs').select('*').order('nom'),
    supabase.from('bp_clients').select('*').order('nom'),
    supabase.from('bp_transactions').select('*').order('jour', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
  ])
  const err = f.error ?? c.error ?? t.error
  const num = (x: BpTx) => ({ ...x, qte: Number(x.qte) || 0, prix_u: Number(x.prix_u) || 0, montant: Number(x.montant) || 0 })
  return {
    fournisseurs: (f.data ?? []) as Contact[], clients: (c.data ?? []) as Contact[], txs: ((t.data ?? []) as BpTx[]).map(num),
    missing: isMissingTable(err), error: err && !isMissingTable(err) ? err.message : '',
  }
}

/* ---------- Produits ---------- */
export const splitAutres = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1))
export const contactProduits = (c?: Contact | null) =>
  !c ? [] : [...c.produits.filter((p) => p !== AUTRES), ...(c.produits.includes(AUTRES) ? splitAutres(c.autres) : [])]
export function allProduits(contacts: Contact[], txs: BpTx[]) {
  const set = new Set(PRODUITS)
  contacts.forEach((c) => contactProduits(c).forEach((p) => set.add(p)))
  txs.forEach((t) => t.produit && set.add(t.produit))
  return [...set]
}

/* ---------- Téléphone malgache ---------- */
export function telIntl(tel: string) {
  const d = tel.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('261')) return d
  if (d.startsWith('0')) return '261' + d.slice(1)
  if (d.length === 9) return '261' + d
  return d
}
export function telLocal(tel: string) {
  const i = telIntl(tel)
  if (i.startsWith('261') && i.length === 12) { const l = '0' + i.slice(3); return `${l.slice(0, 3)} ${l.slice(3, 5)} ${l.slice(5, 8)} ${l.slice(8)}` }
  return tel.trim()
}

/* ---------- Formats ---------- */
export const fmtAr = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ')} Ar`
export const fmtQ = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString('fr-FR')
export const fmtJour = (d: string) => { const [y, m, j] = d.split('-'); return `${+j} ${MOIS[+m - 1].toLowerCase()} ${y}` }
export const toNum = (v: string) => parseFloat(v.replace(/\s/g, '').replace(',', '.')) || 0
