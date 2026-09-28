import type { ReactNode } from 'react'
import {
  ArrowLeft, Baby, Banknote, Briefcase, Bus, ChevronLeft, ChevronRight, Clapperboard, Gift, GraduationCap, HeartPulse, Home,
  Landmark, Lightbulb, PartyPopper, PiggyBank, PlusCircle, ShoppingBag, ShoppingBasket, Smartphone, Store, Wallet, Wifi, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { addMonths, monthLabel } from '../lib/format'
import { useData } from '../lib/data'

/* ---------- Icônes au trait pour catégories et comptes ---------- */
const ICONS: [RegExp, LucideIcon][] = [
  [/aliment|nourrit|march/i, ShoppingBasket], [/transport|taxi|carbur/i, Bus], [/logement|loyer|maison/i, Home],
  [/jirama|electri|eau/i, Lightbulb], [/quotidien|course/i, ShoppingBag], [/sant|m[ée]dic|pharma/i, HeartPulse],
  [/[ée]cole|scolar|[ée]tude/i, GraduationCap], [/loisir|sortie|film/i, Clapperboard], [/social|f[êe]te|c[ée]r[ée]monie/i, PartyPopper],
  [/cr[ée]dit|t[ée]l[ée]phone|forfait/i, Wifi], [/famille|enfant|b[ée]b[ée]/i, Baby], [/salaire/i, Briefcase], [/prime|cadeau|don/i, Gift],
  [/business|vente|commerce/i, Store], [/autre revenu/i, PlusCircle], [/esp[èe]ce|cash/i, Banknote], [/mvola|orange|airtel|money/i, Smartphone],
  [/banque/i, Landmark], [/[ée]pargne/i, PiggyBank], [/portefeuille/i, Wallet],
]
export function iconFor(name: string): LucideIcon | null {
  for (const [re, I] of ICONS) if (re.test(name)) return I
  return null
}

/** Icône nue (au trait) d'une catégorie ou d'un compte, avec repli sur l'emoji. */
export function BareIcon({ name, emoji, size = 30 }: { name: string; emoji?: string; size?: number }) {
  const I = iconFor(name)
  return I ? <I size={size} strokeWidth={1.5} className="text-ink" /> : <span style={{ fontSize: size * 0.85, lineHeight: 1 }}>{emoji ?? '📦'}</span>
}

/** Pastille d'icône : icône au trait noire sur fond crème, point de couleur facultatif. */
export function IconTile({ name, emoji, color, size = 44, active }: { name: string; emoji?: string; color?: string; size?: number; active?: boolean }) {
  const I = iconFor(name)
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-2xl border ${active ? 'border-sun-500 bg-sun-100' : 'border-cream-line bg-cream-tile'}`} style={{ width: size, height: size }}>
      {I ? <I size={size * 0.48} strokeWidth={1.7} className="text-ink" /> : <span style={{ fontSize: size * 0.46 }}>{emoji ?? '📦'}</span>}
      {color && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: color }} />}
    </div>
  )
}

/* ---------- En-tête blanc avec retour ---------- */
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-3">
        <div className="w-11">
          {onBack && <button aria-label="Retour" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream-tile"><ArrowLeft size={24} strokeWidth={1.8} /></button>}
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex w-11 justify-end">{right}</div>
      </div>
    </header>
  )
}

export function MonthBar() {
  const { month, setMonth } = useData()
  return (
    <div className="flex items-center justify-between rounded-full border border-cream-line bg-cream-tile p-1">
      <button aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronLeft size={20} /></button>
      <span className="text-sm font-medium">{monthLabel(month)}</span>
      <button aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronRight size={20} /></button>
    </div>
  )
}

/* ---------- Feuille du bas, fermée par la croix ronde ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/45 px-3 pt-10" onClick={onClose}>
      <div className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="px-6 pb-1 pt-6 text-xl font-semibold">{title}</h2>}
        <div className="overflow-y-auto px-6 pb-6 pt-3">{children}</div>
      </div>
      <button aria-label="Fermer" onClick={onClose} className="pb-safe my-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-lg"><X size={28} strokeWidth={2} /></button>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-full bg-neutral-100 p-1">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 rounded-full py-2 text-sm font-medium transition ${value === k ? 'bg-ink text-white' : 'text-ink-muted'}`}>{l}</button>
      ))}
    </div>
  )
}

export function Progress({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = value > max
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#E5484D' : color ?? '#FFCC00' }} />
    </div>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center text-ink-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sun-100 text-3xl">{icon}</div>
      <p className="max-w-[240px] text-sm">{text}</p>
    </div>
  )
}

/** Compatibilité avec les anciens écrans : devient une IconTile. */
export function IconBubble({ icon, color, size = 40, name = '' }: { icon: string; color: string; size?: number; name?: string }) {
  return <IconTile name={name} emoji={icon} color={color} size={size} />
}

export function Row({ icon, label, sub, right, onClick, danger }: { icon?: ReactNode; label: string; sub?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-4 border-b border-neutral-100 px-5 py-4 text-left last:border-0 active:bg-cream-tile ${danger ? 'text-red-500' : ''}`}>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px]">{label}</p>
        {sub && <p className="truncate text-sm text-ink-muted">{sub}</p>}
      </div>
      {right ?? (onClick && !danger ? <ChevronRight size={22} className="text-neutral-400" /> : null)}
    </button>
  )
}
