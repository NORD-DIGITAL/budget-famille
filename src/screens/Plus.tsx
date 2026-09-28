import { useData } from '../lib/data'
import { Header } from '../components/ui'

export type SubPage = 'budget' | 'objectifs' | 'categories' | 'comptes' | 'membres' | 'partage'
export const SUB_TITLES: Record<SubPage, string> = {
  budget: 'Budget', objectifs: "Objectifs d'épargne", categories: 'Catégories', comptes: 'Comptes', membres: 'Membres', partage: 'Famille & partage',
}

const items: { k: SubPage; icon: string; label: string }[] = [
  { k: 'budget', icon: '💰', label: 'Budget' },
  { k: 'objectifs', icon: '🐷', label: "Objectifs d'épargne" },
  { k: 'categories', icon: '🗂️', label: 'Catégories' },
  { k: 'comptes', icon: '💳', label: 'Comptes' },
  { k: 'membres', icon: '👨‍👩‍👧', label: 'Membres' },
  { k: 'partage', icon: '🔗', label: 'Famille & partage' },
]

export default function PlusScreen({ open }: { open: (p: SubPage) => void }) {
  const { txs, catById, accById, memById, carnet } = useData()

  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = ['Date;Type;Montant;Catégorie;Compte;Membre;Note']
    for (const t of txs) lines.push([
      t.occurred_on, t.kind === 'depense' ? 'Dépense' : 'Revenu', String(t.kind === 'depense' ? -t.amount : t.amount),
      esc(t.category_id ? catById.get(t.category_id)?.name ?? '' : ''), esc(t.account_id ? accById.get(t.account_id)?.name ?? '' : ''),
      esc(t.member_id ? memById.get(t.member_id)?.name ?? '' : ''), esc(t.note ?? ''),
    ].join(';'))
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(carnet?.name ?? 'budget').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <Header title="Plus" />
      <div className="grid grid-cols-3 gap-3 p-4">
        {items.map((i) => (
          <button key={i.k} onClick={() => open(i.k)} className="card flex aspect-square flex-col items-center justify-center gap-2 p-2 text-center active:scale-95">
            <span className="text-4xl">{i.icon}</span>
            <span className="text-xs font-medium leading-tight text-slate-600">{i.label}</span>
          </button>
        ))}
        <button onClick={exportCsv} className="card flex aspect-square flex-col items-center justify-center gap-2 p-2 text-center active:scale-95">
          <span className="text-4xl">📤</span>
          <span className="text-xs font-medium leading-tight text-slate-600">Exporter vers Excel (CSV)</span>
        </button>
      </div>
    </>
  )
}
