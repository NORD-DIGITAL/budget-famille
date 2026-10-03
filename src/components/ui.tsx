import type { ReactNode } from 'react'
import { ArrowLeft, Baby, Banknote, Briefcase, Bus, ChevronRight, Clapperboard, Gift, GraduationCap, HeartPulse, Home, Landmark, Lightbulb, PartyPopper, PiggyBank, PlusCircle, ShoppingBag, ShoppingBasket, Smartphone, Store, Wallet, Wifi, X, Cog, Sofa, PaintRoller, Lamp, SprayCan, WashingMachine, Plug, Armchair, Bed, UsersRound, HouseHeart } from 'lucide-react'
import { Hand, Palette, Signal, Apple, Bean, Beef, Bike, BookOpen, CakeSlice, Car, Carrot, Church, ClipboardPen, Coffee, Cookie, Croissant, CupSoda, Droplet, Drumstick, Dumbbell, Egg, Ellipsis, Film, Fish, Flame, Fuel, Gamepad2, HandCoins, Hammer, Heart, HeartHandshake, Laptop, Leaf, Milk, Music, Package, PawPrint, PencilRuler, Pill, Plane, Salad, School, Scissors, Shirt, ShoppingCart, Soup, Sparkles, Ticket, Tractor, Users, UtensilsCrossed, Wheat, Wine, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBackHandler } from '../lib/back'
import type { LucideIcon } from 'lucide-react'

/* ---------- Icônes au trait pour catégories et comptes ---------- */
const ICONS: [RegExp, LucideIcon][] = [
  [/v[ée]hicule|voiture|moto\b/i, Car], [/carburant|essence|gasoil/i, Fuel], [/pi[èe]ce/i, Cog], [/r[ée]paration/i, Wrench],
  [/^maison|meuble|canap|fauteuil/i, Sofa], [/\blit\b|matelas/i, Bed], [/r[ée]novation/i, Hammer], [/peinture/i, PaintRoller], [/d[ée]coration/i, Lamp], [/entretien/i, SprayCan],
  [/[ée]lectrom[ée]nager/i, WashingMachine], [/[ée]lectronique/i, Plug], [/^t[ée]l[ée]phone$/i, Smartphone], [/^achat$/i, ShoppingBag],
  [/beaut/i, Sparkles], [/coiffure|^taly|brushing/i, Scissors], [/maquillage/i, Palette], [/manucure|manicure/i, Hand],
  [/connectivit/i, Wifi], [/data mobile/i, Signal], [/wi-?fi/i, Wifi], [/cr[ée]dit t[ée]l/i, Smartphone], [/petit d[ée]j/i, Coffee],
  [/^lait|yaourt/i, Milk], [/couche/i, Baby], [/m[ée]dicament/i, Pill], [/v[êe]tement|lingerie/i, Shirt],
  [/vihindr|haricot|tsaramaso/i, Bean], [/v[ôo]rogno|akoho|poulet|volaille/i, Drumstick], [/p[âa]te|soupe/i, Soup], [/^mofo|\bpain\b/i, Croissant],
  [/grand go[ûu]ter/i, CakeSlice], [/inscription/i, ClipboardPen], [/[ée]colage/i, School], [/activit[ée]|\bsport|karat/i, Dumbbell], [/fourniture/i, PencilRuler],
  [/^vary|\briz\b/i, Wheat], [/l[ée]gume/i, Carrot], [/anana|br[èe]de/i, Leaf], [/^hena|viande/i, Beef], [/l[ôo]k[ao]|poisson|trondro/i, Fish],
  [/menaka|huile/i, Droplet], [/sakay|tongolo|voatabia|tomate|oignon/i, Salad], [/bazary|courses?\b/i, ShoppingCart], [/go[ûu]ter/i, Cookie],
  [/resto/i, UtensilsCrossed], [/^jus/i, CupSoda], [/revy|boisson|bi[èe]re/i, Wine], [/cin[ée]ma|netflix/i, Film], [/sortie/i, Ticket],
  [/informatique|ordinateur/i, Laptop], [/^ai$|^ia$|intelligence|chatgpt/i, Sparkles], [/jeux|jeu vid/i, Gamepad2], [/enfant/i, Baby],
  [/familles? autres?/i, HeartHandshake], [/dette|pr[êe]t/i, HandCoins],
  [/aliment|nourrit|march/i, ShoppingBasket], [/transport|taxi|carbur/i, Bus], [/logement|loyer|maison/i, Home],
  [/jirama|electri|eau/i, Lightbulb], [/quotidien|course/i, ShoppingBag], [/sant|m[ée]dic|pharma/i, HeartPulse],
  [/[ée]cole|scolar|[ée]tude/i, GraduationCap], [/loisir|sortie|film/i, Clapperboard], [/social|f[êe]te|c[ée]r[ée]monie/i, PartyPopper],
  [/cr[ée]dit|t[ée]l[ée]phone|forfait/i, Wifi], [/^famille$/i, UsersRound], [/famille|enfant|b[ée]b[ée]/i, Baby], [/salaire/i, Briefcase], [/prime|cadeau|don/i, Gift],
  [/business|vente|commerce/i, Store], [/autre revenu/i, PlusCircle], [/esp[èe]ce|cash/i, Banknote], [/mvola|orange|airtel|money/i, Smartphone],
  [/banque/i, Landmark], [/[ée]pargne/i, PiggyBank], [/portefeuille/i, Wallet], [/^autres?\b/i, Ellipsis],
]
export function iconFor(name: string, emoji?: string): LucideIcon | null {
  if (emoji?.startsWith('i:') && ICON_SET[emoji.slice(2)]) return ICON_SET[emoji.slice(2)]
  for (const [re, I] of ICONS) if (re.test(name)) return I
  return null
}

/** Icônes proposées quand on crée une catégorie (enregistrées sous la forme « i:Nom »). */
export const ICON_SET: Record<string, LucideIcon> = {
  ShoppingBasket, ShoppingCart, UtensilsCrossed, Coffee, Cookie, Croissant, Soup, Wheat, Carrot, Beef, Fish, Drumstick, Bean, Egg, Milk, Apple,
  CupSoda, Wine, CakeSlice, Bus, Car, Bike, Fuel, Home, Lightbulb, Droplet, Flame, Wifi, Smartphone, HeartPulse, Pill, Baby, GraduationCap,
  School, BookOpen, PencilRuler, Dumbbell, Shirt, Scissors, Gift, PartyPopper, Church, Film, Gamepad2, Music, Laptop, Sparkles, Plane, Wrench,
  Hammer, PawPrint, Tractor, Store, Briefcase, Banknote, PiggyBank, HandCoins, Landmark, Users, Heart, Ticket, Package, Ellipsis,
  Sofa, Armchair, Bed, Lamp, UsersRound, HouseHeart, Plug, WashingMachine, PaintRoller, SprayCan, Cog,
}

/** Vrai quand le clavier du téléphone est ouvert (la zone visible rétrécit). */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    const base = { h: window.innerHeight }
    const check = () => {
      const h = vv ? vv.height : window.innerHeight
      base.h = Math.max(base.h, window.innerHeight, h)
      const focused = document.activeElement?.tagName
      setOpen(base.h - h > 150 && (focused === 'INPUT' || focused === 'TEXTAREA'))
    }
    vv?.addEventListener('resize', check); window.addEventListener('resize', check)
    document.addEventListener('focusin', check); document.addEventListener('focusout', () => setTimeout(check, 50))
    return () => { vv?.removeEventListener('resize', check); window.removeEventListener('resize', check); document.removeEventListener('focusin', check) }
  }, [])
  return open
}

/** Icône nue (au trait) d'une catégorie ou d'un compte, avec repli sur l'emoji. */
export function BareIcon({ name, emoji, size = 30 }: { name: string; emoji?: string; size?: number }) {
  const I = iconFor(name, emoji)
  return I ? <I size={size} strokeWidth={1.5} className="text-ink" /> : <span style={{ fontSize: size * 0.85, lineHeight: 1 }}>{emoji && !emoji.startsWith('i:') ? emoji : '📦'}</span>
}

/** Pastille d'icône : icône au trait noire sur fond crème, point de couleur facultatif. */
export function IconTile({ name, emoji, color, size = 44, active }: { name: string; emoji?: string; color?: string; size?: number; active?: boolean }) {
  const I = iconFor(name, emoji)
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-2xl border ${active ? 'border-sun-500 bg-sun-100' : 'border-cream-line bg-cream-tile'}`} style={{ width: size, height: size }}>
      {I ? <I size={size * 0.48} strokeWidth={1.7} className="text-ink" /> : <span style={{ fontSize: size * 0.46 }}>{emoji && !emoji.startsWith('i:') ? emoji : '📦'}</span>}
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

/* ---------- Feuille du bas, fermée par la croix ronde ---------- */
let sheetSeq = 0
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useBackHandler(open, onClose)
  // La dernière fenêtre ouverte passe toujours au-dessus des autres
  const [z, setZ] = useState(50)
  useEffect(() => { if (open) setZ(50 + ++sheetSeq) }, [open])
  if (!open) return null
  return (
    <div data-sheet style={{ zIndex: z }} className="fixed inset-0 flex flex-col items-center justify-end bg-black/45 px-3 pt-4 lg:justify-center" onClick={onClose}>
      <div className="flex max-h-[calc(100dvh-6.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white text-ink" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="px-6 pb-1 pt-6 text-xl font-semibold">{title}</h2>}
        <div className="overflow-y-auto px-6 pb-6 pt-3">{children}</div>
      </div>
      <button aria-label="Fermer" onClick={onClose} className="pb-safe my-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lg"><X size={28} strokeWidth={2} /></button>
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
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#E5484D' : color ?? 'var(--accent)' }} />
    </div>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center text-ink-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sun-100 text-3xl">{icon}</div>
      <p className="max-w-[15rem] text-sm">{text}</p>
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
        <p className="truncate text-[1.0625rem]">{label}</p>
        {sub && <p className="truncate text-sm text-ink-muted">{sub}</p>}
      </div>
      {right ?? (onClick && !danger ? <ChevronRight size={22} className="text-neutral-400" /> : null)}
    </button>
  )
}

/** Nom de l'application. */
export function Wordmark({ className = '', dark }: { className?: string; dark?: boolean }) {
  return <span className={`font-bold tracking-tight ${className}`}>Budget<span className="text-sun-500">.Go.</span><span className={dark ? 'text-white' : ''}>Family</span></span>
}

/** Signature obligatoire des projets NORD DIGITAL. */
export function ByNord({ className = '', light, onHero }: { className?: string; light?: boolean; onHero?: boolean }) {
  return (
    <p className={`text-center text-[0.6875rem] uppercase tracking-[0.18em] ${onHero ? 'hero-muted' : light ? 'text-neutral-500' : 'text-ink-muted'} ${className}`}>
      by <span className={`font-semibold ${onHero ? '' : light ? 'text-neutral-300' : 'text-ink'}`}>NORD DIGITAL</span>
    </p>
  )
}
