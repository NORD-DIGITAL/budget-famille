import type { Debt, DebtPayment, Goal, InvMove, InvProject, SavingsMove, Transfer, Tx } from './types'

/**
 * Grand livre (v3.11) : tous les mouvements d'argent du carnet au même format.
 * Chaque entrée a des « jambes » (compte, montant signé) : c'est ce qui fait bouger les soldes.
 * Une entrée sans jambe (dépense ou revenu interne d'un projet) est seulement affichée.
 */
export type EntrySource = 'operation' | 'epargne' | 'dette' | 'transfert' | 'investissement' | 'projet'
export interface Leg { account_id: string | null; amount: number }
export interface Entry {
  key: string
  date: string
  created: string
  source: EntrySource
  title: string
  detail: string
  legs: Leg[]
  /** Montant affiché (signé) : effet sur le solde, ou montant du mouvement pour un transfert / un mouvement de projet. */
  shown: number
  /** Vrai si le mouvement change le solde total du carnet. */
  affects: boolean
  tx?: Tx
  goalId?: string
  debtId?: string
  projectId?: string
}

export const SOURCE_LABEL: Record<EntrySource, string> = {
  operation: 'Opération', epargne: 'Épargne', dette: 'Dette', transfert: 'Transfert', investissement: 'Investissement', projet: 'Projet',
}

export function buildLedger(p: {
  txs: Tx[]; moves: SavingsMove[]; goals: Goal[]; payments: DebtPayment[]; debts: Debt[]
  transfers: Transfer[]; invProjects: InvProject[]; invMoves: InvMove[]
  accName: (id: string | null) => string
}): Entry[] {
  const out: Entry[] = []
  const goal = new Map(p.goals.map((g) => [g.id, g]))
  const debt = new Map(p.debts.map((d) => [d.id, d]))
  const proj = new Map(p.invProjects.map((x) => [x.id, x]))

  for (const t of p.txs) {
    const a = t.kind === 'revenu' ? t.amount : -t.amount
    out.push({ key: 't' + t.id, date: t.occurred_on, created: t.created_at, source: 'operation', title: '', detail: '', legs: [{ account_id: t.account_id, amount: a }], shown: a, affects: true, tx: t })
  }
  for (const m of p.moves) {
    const g = goal.get(m.goal_id)
    const a = -m.amount // versement = l'argent quitte le compte ; retrait (montant négatif) = il revient
    out.push({
      key: 's' + m.id, date: m.moved_on, created: m.moved_on, source: 'epargne', goalId: m.goal_id,
      title: `${m.amount >= 0 ? 'Versement épargne' : 'Retrait épargne'} · ${g?.name ?? 'Épargne'}`,
      detail: [p.accName(m.account_id ?? null), m.ref ? `Réf. ${m.ref}` : null, m.note].filter(Boolean).join(' · '),
      legs: [{ account_id: m.account_id ?? null, amount: a }], shown: a, affects: true,
    })
  }
  for (const d of p.debts) {
    if (!d.lent_on) continue // anciennes dettes : la création ne bouge pas le solde
    const a = d.direction === 'je_dois' ? d.amount : -d.amount
    out.push({
      key: 'd' + d.id, date: d.lent_on, created: d.lent_on, source: 'dette', debtId: d.id,
      title: d.direction === 'je_dois' ? `Emprunt · ${d.person}` : `Prêt · ${d.person}`,
      detail: [p.accName(d.account_id ?? null), d.note].filter(Boolean).join(' · '),
      legs: [{ account_id: d.account_id ?? null, amount: a }], shown: a, affects: true,
    })
  }
  for (const r of p.payments) {
    const d = debt.get(r.debt_id)
    const a = d?.direction === 'on_me_doit' ? r.amount : -r.amount
    out.push({
      key: 'p' + r.id, date: r.paid_on, created: r.paid_on, source: 'dette', debtId: r.debt_id,
      title: d?.direction === 'on_me_doit' ? `Remboursement reçu · ${d?.person ?? ''}` : `Remboursement · ${d?.person ?? ''}`,
      detail: [p.accName(r.account_id ?? null), r.ref ? `Réf. ${r.ref}` : null, r.note].filter(Boolean).join(' · '),
      legs: [{ account_id: r.account_id ?? null, amount: a }], shown: a, affects: true,
    })
  }
  for (const t of p.transfers) {
    out.push({
      key: 'x' + t.id, date: t.moved_on, created: t.created_at, source: 'transfert',
      title: `${p.accName(t.from_account)} → ${p.accName(t.to_account)}`,
      detail: [t.ref ? `Réf. ${t.ref}` : null, t.note].filter(Boolean).join(' · '),
      legs: [{ account_id: t.from_account, amount: -t.amount }, { account_id: t.to_account, amount: t.amount }], shown: t.amount, affects: false,
    })
  }
  for (const m of p.invMoves) {
    const pr = proj.get(m.project_id)
    const name = pr?.name ?? 'Projet'
    if (m.kind === 'capital' || m.kind === 'versement') {
      const a = m.kind === 'capital' ? -m.amount : m.amount
      out.push({
        key: 'i' + m.id, date: m.moved_on, created: m.created_at, source: 'investissement', projectId: m.project_id,
        title: m.kind === 'capital' ? `Investi · ${name}` : `Versé depuis ${name}`,
        detail: [p.accName(m.account_id), m.note].filter(Boolean).join(' · '),
        legs: [{ account_id: m.account_id, amount: a }], shown: a, affects: true,
      })
    } else {
      const a = m.kind === 'revenu' ? m.amount : -m.amount
      out.push({
        key: 'i' + m.id, date: m.moved_on, created: m.created_at, source: 'projet', projectId: m.project_id,
        title: `${m.kind === 'revenu' ? 'Revenu' : 'Dépense'} du projet · ${name}`,
        detail: [m.note, 'dans le projet'].filter(Boolean).join(' · '),
        legs: [], shown: a, affects: false,
      })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.created < b.created ? 1 : -1))
}

/** Effet total d'une entrée sur le solde (somme de ses jambes). */
export const effect = (e: Entry) => e.legs.reduce((s, l) => s + l.amount, 0)
/** Effet d'une entrée sur un compte donné. */
export const effectOn = (e: Entry, acc: string | null) => e.legs.filter((l) => l.account_id === acc).reduce((s, l) => s + l.amount, 0)
