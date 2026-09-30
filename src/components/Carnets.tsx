import { useState } from 'react'
import { BookOpen, Check, ChevronDown } from 'lucide-react'
import { useData } from '../lib/data'
import { useUserTheme, themeForCarnet, THEMES } from '../lib/theme'
import { Sheet } from './ui'

/** Pastille de couleur d'un carnet (même règle de couleur que l'application). */
function useCarnetColor() {
  const { session, principalId } = useData()
  const userTheme = useUserTheme(session?.user.id ?? null)
  return (id: string) => THEMES.find((t) => t.id === themeForCarnet(id, principalId, userTheme))!.color
}

/** Liste des carnets pour passer de l'un à l'autre. */
export function CarnetSwitchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { carnets, carnet, switchCarnet, principalId } = useData()
  const color = useCarnetColor()
  return (
    <Sheet open={open} onClose={onClose} title="Changer de carnet">
      <div className="space-y-2">
        {carnets.map((c) => (
          <button key={c.id} onClick={() => { switchCarnet(c.id); onClose() }}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${c.id === carnet?.id ? 'border-ink' : 'border-cream-line bg-cream-tile'}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-ink" style={{ background: color(c.id) }}>{c.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block text-xs text-ink-muted">{c.id === principalId ? 'Mon carnet principal' : c.role === 'proprietaire' ? 'Créé par toi' : 'Carnet partagé avec moi'} · {c.members} pers.</span>
            </span>
            {c.id === carnet?.id && <Check size={20} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Bouton compact « carnet ouvert » : visible seulement s'il y a plusieurs carnets. */
export function CarnetSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' | 'chip' }) {
  const { carnets, carnet, principalId } = useData()
  const [open, setOpen] = useState(false)
  const color = useCarnetColor()
  if (carnets.length < 2 || !carnet) return null
  const other = carnet.id !== principalId
  return (
    <>
      {variant === 'chip' ? (
        <button onClick={() => setOpen(true)} className="flex max-w-full items-center gap-1.5 rounded-full border border-cream-line bg-white/80 py-1 pl-1 pr-3 text-xs">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color(carnet.id) }} />
          <span className="truncate">{other ? `Carnet : ${carnet.name}` : carnet.name}</span>
          <ChevronDown size={14} className="shrink-0" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${variant === 'dark' ? 'bg-white/5 text-white hover:bg-white/10' : 'border border-cream-line bg-cream-tile'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink" style={{ background: color(carnet.id) }}><BookOpen size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className={`block text-xs ${variant === 'dark' ? 'text-neutral-400' : 'text-ink-muted'}`}>Carnet ouvert</span>
            <span className="block truncate text-sm font-medium">{carnet.name}</span>
          </span>
          <ChevronDown size={18} className="shrink-0 opacity-60" />
        </button>
      )}
      <CarnetSwitchSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
