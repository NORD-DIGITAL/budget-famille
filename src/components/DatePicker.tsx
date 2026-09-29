import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Sheet } from './ui'
import { useData } from '../lib/data'
import { addMonths, monthLabel } from '../lib/format'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const DAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayParts = () => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() } }

type View = 'days' | 'months' | 'years'

/**
 * Calendrier « à zoom » : touche le titre pour passer des jours aux mois puis aux années,
 * flèches ▲ ▼ pour avancer ou reculer.
 */
export function Calendar({ value, onPick, mode = 'day', min, max, startYear }: {
  value: string | null; onPick: (v: string) => void; mode?: 'day' | 'month'; min?: string; max?: string; startYear?: number
}) {
  const t = todayParts()
  const [y0, m0] = value ? value.split('-').map(Number) : [startYear ?? t.y, t.m + 1]
  const [view, setView] = useState<View>(!value && startYear ? 'years' : mode === 'month' ? 'months' : 'days')
  const [y, setY] = useState(y0)
  const [m, setM] = useState(m0 - 1)
  const decade = Math.floor(y / 10) * 10

  const selY = value ? Number(value.slice(0, 4)) : null
  const selM = value ? Number(value.slice(5, 7)) - 1 : null
  const selD = value && value.length >= 10 ? Number(value.slice(8, 10)) : null
  const out = (v: string) => (min && v < min.slice(0, v.length)) || (max && v > max.slice(0, v.length))

  const title = view === 'days' ? `${MONTHS_LONG[m]} ${y}` : view === 'months' ? String(y) : `${decade} – ${decade + 9}`
  const zoomOut = () => setView(view === 'days' ? 'months' : 'years')
  const step = (dir: 1 | -1) => {
    if (view === 'days') { const d = new Date(y, m + dir, 1); setY(d.getFullYear()); setM(d.getMonth()) }
    else if (view === 'months') setY(y + dir)
    else setY(y + dir * 10)
  }

  const cell = 'flex items-center justify-center rounded-full transition'
  const sel = 'bg-sun-500 font-semibold text-ink'
  const today = 'ring-2 ring-sun-500'

  let grid: React.ReactNode
  if (view === 'days') {
    const first = (new Date(y, m, 1).getDay() + 6) % 7
    const count = new Date(y, m + 1, 0).getDate()
    const prevCount = new Date(y, m, 0).getDate()
    const cells: { d: number; mo: number; cur: boolean }[] = []
    for (let i = first - 1; i >= 0; i--) cells.push({ d: prevCount - i, mo: -1, cur: false })
    for (let d = 1; d <= count; d++) cells.push({ d, mo: 0, cur: true })
    while (cells.length % 7 || cells.length < 42) cells.push({ d: cells.length - count - first + 1, mo: 1, cur: false })
    grid = (
      <>
        <div className="grid grid-cols-7 text-center text-xs text-ink-muted">{DAYS.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((c, i) => {
            const dt = new Date(y, m + c.mo, c.d)
            const v = iso(dt.getFullYear(), dt.getMonth(), dt.getDate())
            const isSel = selY === dt.getFullYear() && selM === dt.getMonth() && selD === dt.getDate()
            const isToday = t.y === dt.getFullYear() && t.m === dt.getMonth() && t.d === dt.getDate()
            return (
              <button key={i} type="button" disabled={!!out(v)} onClick={() => onPick(v)}
                className={`${cell} mx-auto h-10 w-10 text-[15px] ${isSel ? sel : isToday ? today : ''} ${c.cur ? '' : 'text-neutral-300'} disabled:opacity-30`}>{c.d}</button>
            )
          })}
        </div>
      </>
    )
  } else if (view === 'months') {
    grid = (
      <div className="grid grid-cols-4 gap-y-2">
        {Array.from({ length: 16 }, (_, i) => {
          const yy = y + Math.floor(i / 12), mm = i % 12
          const v = `${yy}-${pad(mm + 1)}`
          const isSel = selY === yy && selM === mm
          const isToday = t.y === yy && t.m === mm
          return (
            <button key={i} type="button" disabled={!!out(v)}
              onClick={() => { if (mode === 'month') onPick(v); else { setY(yy); setM(mm); setView('days') } }}
              className={`${cell} mx-auto h-16 w-16 text-[15px] ${isSel ? sel : isToday ? today : ''} ${i >= 12 ? 'text-neutral-300' : ''} disabled:opacity-30`}>{MONTHS[mm]}</button>
          )
        })}
      </div>
    )
  } else {
    grid = (
      <div className="grid grid-cols-4 gap-y-2">
        {Array.from({ length: 16 }, (_, i) => {
          const yy = decade - 2 + i
          const isSel = selY === yy
          return (
            <button key={i} type="button" disabled={!!out(String(yy))} onClick={() => { setY(yy); setView('months') }}
              className={`${cell} mx-auto h-16 w-16 text-[15px] ${isSel ? sel : t.y === yy ? today : ''} ${yy < decade || yy > decade + 9 ? 'text-neutral-300' : ''} disabled:opacity-30`}>{yy}</button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={zoomOut} disabled={view === 'years'} className="rounded-xl px-3 py-2 text-lg font-semibold capitalize hover:bg-cream-tile disabled:hover:bg-transparent">{title}</button>
        <div className="flex gap-1">
          <button type="button" aria-label="Précédent" onClick={() => step(-1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-cream-tile"><ChevronUp size={22} /></button>
          <button type="button" aria-label="Suivant" onClick={() => step(1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-cream-tile"><ChevronDown size={22} /></button>
        </div>
      </div>
      {grid}
      <p className="mt-3 text-center text-xs text-ink-muted">Touche le titre pour choisir {view === 'days' ? 'le mois' : "l'année"}.</p>
    </div>
  )
}

export const fmtDateLong = (v: string) => {
  const d = new Date(v + 'T00:00:00')
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const fmtMonthLong = (v: string) => { const [yy, mm] = v.split('-').map(Number); return `${MONTHS_LONG[mm - 1]} ${yy}` }

/** Champ date (remplace <input type="date">). */
export function DateField({ id, value, onChange, placeholder = 'Choisir une date', mode = 'day', clearable, min, max, className = '', startYear }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; mode?: 'day' | 'month'; clearable?: boolean; min?: string; max?: string; className?: string; startYear?: number
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  useEffect(() => { if (open) setKey((k) => k + 1) }, [open])
  const t = todayParts()
  return (
    <>
      <button id={id} type="button" onClick={() => setOpen(true)} className={`input flex items-center justify-between gap-2 text-left ${value ? '' : 'text-neutral-400'} ${className}`}>
        <span className="truncate first-letter:uppercase">{value ? (mode === 'month' ? fmtMonthLong(value) : fmtDateLong(value)) : placeholder}</span>
        <CalendarDays size={20} strokeWidth={1.7} className="shrink-0 text-ink-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <Calendar key={key} value={value || null} mode={mode} min={min} max={max} startYear={startYear} onPick={(v) => { onChange(v); setOpen(false) }} />
        <div className="mt-4 flex gap-2">
          {clearable && value && <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="btn-ghost flex-1 py-2.5 text-sm">Effacer</button>}
          <button type="button" onClick={() => { onChange(mode === 'month' ? `${t.y}-${pad(t.m + 1)}` : iso(t.y, t.m, t.d)); setOpen(false) }} className="btn-dark flex-1 py-2.5 text-sm">
            {mode === 'month' ? 'Ce mois-ci' : "Aujourd'hui"}
          </button>
        </div>
      </Sheet>
    </>
  )
}

/** Barre de mois : flèches + titre qui ouvre le sélecteur mois / année. */
export function MonthBar() {
  const { month, setMonth } = useData()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between rounded-full border border-cream-line bg-cream-tile p-1">
        <button aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronLeft size={20} /></button>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium hover:bg-white">{monthLabel(month)}<ChevronDown size={16} /></button>
        <button aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"><ChevronRight size={20} /></button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <Calendar value={month} mode="month" onPick={(v) => { setMonth(v); setOpen(false) }} />
      </Sheet>
    </>
  )
}
