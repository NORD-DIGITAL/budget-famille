import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addMonths, monthLabel } from '../lib/format'
import { useData } from '../lib/data'

export function Header({ title, left, right, children }: { title: string; left?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-gradient-to-br from-brand-600 to-violet-700 text-white shadow-md">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="w-10">{left}</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex w-10 justify-end">{right}</div>
      </div>
      {children}
    </header>
  )
}

export function MonthBar() {
  const { month, setMonth } = useData()
  return (
    <div className="flex items-center justify-center gap-4 pb-3">
      <button aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} className="rounded-full p-1.5 hover:bg-white/15"><ChevronLeft size={20} /></button>
      <span className="min-w-[150px] text-center font-medium">{monthLabel(month)}</span>
      <button aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} className="rounded-full p-1.5 hover:bg-white/15"><ChevronRight size={20} /></button>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="pb-safe max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button aria-label="Fermer" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Progress({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = value > max
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#ef4444' : color ?? '#22c55e' }} />
    </div>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-400">
      <div className="text-5xl">{icon}</div>
      <p className="max-w-[240px] text-sm">{text}</p>
    </div>
  )
}

export function IconBubble({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: color + '22', fontSize: size * 0.5 }}>
      {icon}
    </div>
  )
}
