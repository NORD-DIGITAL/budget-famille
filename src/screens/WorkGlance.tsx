import { useEffect, useState } from 'react'
import { ChevronRight, NotebookPen } from 'lucide-react'
import { addDays, hm, loadWork, occurrences, ymd } from '../lib/travail'
import type { WorkEvent, WorkTask } from '../lib/travail'

/** Aperçu discret du Carnet de travail sur l'accueil (compte propriétaire) : une seule ligne, masquée s'il n'y a rien. */
export function WorkGlance({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<{ events: WorkEvent[]; tasks: WorkTask[] } | null>(null)
  useEffect(() => {
    let alive = true
    loadWork().then((r) => { if (alive && !r.missing && !r.error) setData({ events: r.events, tasks: r.tasks }) })
    return () => { alive = false }
  }, [])
  if (!data) return null

  const now = new Date()
  const today = ymd(now)
  const next = occurrences(data.events, today, 7)
    .filter((o) => o.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  const todo = data.tasks.filter((t) => !t.done && t.due && t.due <= today).length
  if (!next && !todo) return null

  const when = next
    ? next.dayKey === today ? (next.ev.at_time ? hm(next.start) : "Aujourd'hui")
      : next.dayKey === addDays(today, 1) ? `Demain${next.ev.at_time ? ` ${hm(next.start)}` : ''}`
      : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(next.start)
    : ''

  return (
    <button onClick={onOpen} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-cream-line bg-cream-tile px-4 py-2.5 text-left">
      <NotebookPen size={20} strokeWidth={1.8} className="shrink-0 text-ink-soft" />
      <span className="min-w-0 flex-1 truncate text-sm">
        {next && <><b className="tabular font-semibold">{when}</b> · {next.ev.title}</>}
        {!next && <>{todo} tâche{todo > 1 ? 's' : ''} à faire aujourd'hui</>}
      </span>
      {next && todo > 0 && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs text-ink-muted">{todo} tâche{todo > 1 ? 's' : ''}</span>}
      <ChevronRight size={18} className="shrink-0 text-neutral-400" />
    </button>
  )
}
