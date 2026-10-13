/**
 * Règle NORD DIGITAL des moyens de paiement (à appliquer dans toutes les apps) :
 *  - Mobile Money (MVola, Orange Money, Airtel Money) : numéro à 10 chiffres commençant par 032, 033, 034, 036, 037 ou 038 + référence
 *  - Chèque : nom + numéro du chèque
 *  - Virement : nom + numéro du virement
 *  - Espèces, TPE : rien de plus
 * Le serveur applique la même règle (fonction paiement_valide dans supabase/paiements.sql).
 */
export const MOYENS = ['Espèces', 'MVola', 'Orange Money', 'Airtel Money', 'Chèque', 'Virement', 'TPE'] as const
export type Moyen = (typeof MOYENS)[number]
export const MOBILE_MONEY: string[] = ['MVola', 'Orange Money', 'Airtel Money']
export const PREFIXES_MG = ['032', '033', '034', '036', '037', '038']

export interface PayDetails { moyen: string; mm_numero: string; reference: string; payeur_nom: string; num_doc: string }
export const emptyPay = (moyen = 'Espèces'): PayDetails => ({ moyen, mm_numero: '', reference: '', payeur_nom: '', num_doc: '' })

export const isMobile = (m: string) => MOBILE_MONEY.includes(m)
export const needsDoc = (m: string) => m === 'Chèque' || m === 'Virement'
export const mmValid = (n: string) => /^03[234678]\d{7}$/.test(n)

/** Message d'erreur si les détails ne respectent pas la règle, sinon chaîne vide. */
export function payError(p: PayDetails): string {
  if (isMobile(p.moyen)) {
    if (!mmValid(p.mm_numero)) return `${p.moyen} : numéro à 10 chiffres commençant par ${PREFIXES_MG.join(', ')}.`
    if (!p.reference.trim()) return `${p.moyen} : indique la référence de la transaction.`
  }
  if (needsDoc(p.moyen)) {
    if (!p.payeur_nom.trim()) return `${p.moyen} : indique le nom.`
    if (!p.num_doc.trim()) return p.moyen === 'Chèque' ? 'Chèque : indique le numéro du chèque.' : 'Virement : indique le numéro du virement.'
  }
  return ''
}

/** Ne garde que les détails utiles au moyen choisi (le reste est vidé). */
export function cleanPay(p: PayDetails): PayDetails {
  return {
    moyen: p.moyen,
    mm_numero: isMobile(p.moyen) ? p.mm_numero : '',
    reference: isMobile(p.moyen) ? p.reference.trim() : '',
    payeur_nom: needsDoc(p.moyen) ? p.payeur_nom.trim() : '',
    num_doc: needsDoc(p.moyen) ? p.num_doc.trim() : '',
  }
}

export const fmtMm = (n: string) => (n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : n)

/** Résumé lisible : « MVola · 034 12 345 67 · réf. ABC123 », « Chèque n° 1234 · Rakoto »… */
export function payLabel(p: Partial<PayDetails> & { moyen: string }) {
  if (isMobile(p.moyen) && p.mm_numero) return `${p.moyen} · ${fmtMm(p.mm_numero)}${p.reference ? ` · réf. ${p.reference}` : ''}`
  if (needsDoc(p.moyen) && (p.num_doc || p.payeur_nom)) return `${p.moyen}${p.num_doc ? ` n° ${p.num_doc}` : ''}${p.payeur_nom ? ` · ${p.payeur_nom}` : ''}`
  return p.moyen
}
