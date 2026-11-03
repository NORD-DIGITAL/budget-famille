import { useSyncExternalStore } from 'react'
import type { InvMove, InvType } from './types'

/** Projet d'investissement ouvert (page « projet »). */
let current: string | null = null
const subs = new Set<() => void>()
export const openProject = (id: string | null) => { current = id; subs.forEach((f) => f()) }
export const useOpenProject = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => current)

export const INV_TYPES: { k: InvType; label: string }[] = [
  { k: 'vente', label: 'Vente' }, { k: 'partenariat', label: 'Partenariat' }, { k: 'autre', label: 'Autre' },
]
export const invTypeLabel = (t: InvType, autre: string) => (t === 'autre' ? autre || 'Autre' : INV_TYPES.find((x) => x.k === t)?.label ?? t)

/** Chiffres d'un projet : capital investi, dépenses, revenus, déjà versé sur les comptes, argent disponible dans le projet. */
export function projectStats(moves: InvMove[], projectId: string) {
  let capital = 0, depenses = 0, revenus = 0, verse = 0
  for (const m of moves) {
    if (m.project_id !== projectId) continue
    if (m.kind === 'capital') capital += m.amount
    else if (m.kind === 'depense') depenses += m.amount
    else if (m.kind === 'revenu') revenus += m.amount
    else verse += m.amount
  }
  return { capital, depenses, revenus, verse, dispo: capital + revenus - depenses - verse, resultat: revenus - depenses }
}
