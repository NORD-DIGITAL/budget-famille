import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import './travail.css'
import { supabase } from '../lib/supabase'
import { isNative } from '../lib/version'
import { useBackHandler } from '../lib/back'
import { addDays, dayLabel, hm, loadWork, occurrences, parseDay, remLabel, syncWorkReminders, ymd } from '../lib/travail'
import type { WorkEvent, WorkNote, WorkTask } from '../lib/travail'

const DAYS_AHEAD = 14
const TIMED_REMINDERS: [number, string][] = [[5, '5 min avant'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant'], [1440, '1 jour avant']]
const ALLDAY_REMINDERS: [number, string][] = [[240, 'La veille à 20h'], [960, 'La veille à 8h']]
const DURATIONS: [number, string][] = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']]

type Fiche = { kind: 'event'; ev: WorkEvent; dayKey: string } | { kind: 'task'; t: WorkTask } | { kind: 'note'; n: WorkNote }
type NewEvent = Pick<WorkEvent, 'title' | 'note' | 'day' | 'at_time' | 'duration_min' | 'remind_min' | 'weekly'>

const stampFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const isDeadline = (title: string) => /deadline|date limite|échéance/i.test(title)

/** Section « Carnet de travail » : rendez-vous (avec rappels sur le téléphone), tâches et notes. Chaque fiche s'ouvre en détail. */
export function TravailPage() {
  const [events, setEvents] = useState<WorkEvent[]>([])
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [notes, setNotes] = useState<WorkNote[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [toast, setToast] = useState('')
  const [fiche, setFiche] = useState<Fiche | null>(null)
  const [adding, setAdding] = useState<AddKind | null>(null)
  const [, setTick] = useState(0)

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600) }

  const reload = useCallback(async () => {
    const r = await loadWork()
    if (r.missing) { setState('missing'); return }
    if (r.error) { setErrMsg(r.error); setState('error'); return }
    setEvents(r.events); setTasks(r.tasks); setNotes(r.notes); setState('ready')
  }, [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (state === 'ready') syncWorkReminders(events) }, [events, state])
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60_000); return () => clearInterval(t) }, [])

  const fail = (e: { message?: string } | null, what: string) => {
    if (!e) return false
    flash(`Impossible d'enregistrer ${what}. Vérifie ta connexion.`)
    return true
  }

  /* ---------- écritures ---------- */
  const act = {
    addEvent: async (row: NewEvent) => {
      const { data, error } = await supabase.from('work_events').insert(row).select().single()
      if (fail(error, 'le rendez-vous')) return false
      setEvents((l) => [...l, data as WorkEvent]); flash(row.remind_min != null && isNative ? 'Ajouté, rappel programmé' : 'Rendez-vous ajouté')
      return true
    },
    saveEvent: async (id: string, row: NewEvent) => {
      const { data, error } = await supabase.from('work_events').update(row).eq('id', id).select().single()
      if (fail(error, 'le rendez-vous')) return null
      const ev = data as WorkEvent
      setEvents((l) => l.map((x) => (x.id === id ? ev : x))); flash('Rendez-vous modifié')
      return ev
    },
    delEvent: async (ev: WorkEvent) => {
      const { error } = await supabase.from('work_events').delete().eq('id', ev.id)
      if (fail(error, 'la suppression')) return false
      setEvents((l) => l.filter((x) => x.id !== ev.id)); flash('Rendez-vous supprimé')
      return true
    },
    addTask: async (text: string, due: string) => {
      const { data, error } = await supabase.from('work_tasks').insert({ text, due: due || null }).select().single()
      if (fail(error, 'la tâche')) return false
      setTasks((l) => [...l, data as WorkTask]); flash('Tâche ajoutée')
      return true
    },
    saveTask: async (id: string, patch: Partial<WorkTask>) => {
      const { data, error } = await supabase.from('work_tasks').update(patch).eq('id', id).select().single()
      if (fail(error, 'la tâche')) return null
      const t = data as WorkTask
      setTasks((l) => l.map((x) => (x.id === id ? t : x)))
      return t
    },
    toggleTask: async (t: WorkTask) => {
      const patch = { done: !t.done, done_at: !t.done ? new Date().toISOString() : null }
      setTasks((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))
      const { data, error } = await supabase.from('work_tasks').update(patch).eq('id', t.id).select().single()
      if (fail(error, 'la tâche')) { setTasks((l) => l.map((x) => (x.id === t.id ? t : x))); return null }
      return data as WorkTask
    },
    delTask: async (t: WorkTask) => {
      const { error } = await supabase.from('work_tasks').delete().eq('id', t.id)
      if (fail(error, 'la suppression')) return false
      setTasks((l) => l.filter((x) => x.id !== t.id)); flash('Tâche supprimée')
      return true
    },
    addNote: async (text: string) => {
      const { data, error } = await supabase.from('work_notes').insert({ text }).select().single()
      if (fail(error, 'la note')) return false
      setNotes((l) => [data as WorkNote, ...l]); flash('Note enregistrée'); return true
    },
    saveNote: async (id: string, text: string) => {
      const { data, error } = await supabase.from('work_notes').update({ text }).eq('id', id).select().single()
      if (fail(error, 'la note')) return null
      const n = data as WorkNote
      setNotes((l) => l.map((x) => (x.id === id ? n : x))); flash('Note modifiée')
      return n
    },
    delNote: async (n: WorkNote) => {
      const { error } = await supabase.from('work_notes').delete().eq('id', n.id)
      if (fail(error, 'la suppression')) return false
      setNotes((l) => l.filter((x) => x.id !== n.id)); flash('Note supprimée')
      return true
    },
  }

  const today = ymd(new Date())
  const occ = useMemo(() => occurrences(events, today, DAYS_AHEAD), [events, today])
  const now = Date.now()
  const next = occ.find((o) => o.ev.at_time && o.start.getTime() > now)
  const ready = state === 'ready'

  return (
    <div className="ct">
      <div className="ct-intro">
        <p>Rendez-vous, tâches et notes de travail</p>
        <span className="ct-sync">
          <span className={`ct-dot ${ready ? 'on' : state === 'loading' ? 'busy' : 'err'}`} />
          {ready ? (isNative ? 'Rappels actifs sur ce téléphone' : "Rappels sur l'appli Android") : state === 'loading' ? 'Chargement…' : 'Hors service'}
        </span>
      </div>

      {state === 'missing' && <p className="ct-notice warn" style={{ marginBottom: 16 }}>Le carnet de travail n'est pas encore activé sur le serveur.</p>}
      {state === 'error' && <p className="ct-notice err" style={{ marginBottom: 16 }}>Le carnet ne se charge pas ({errMsg}). Tire vers le bas ou reviens dans un instant.</p>}

      {next && (
        <button className="ct-next" onClick={() => setFiche({ kind: 'event', ev: next.ev, dayKey: next.dayKey })}>
          <span className="lbl">Prochain rendez-vous</span>
          <span className="what">{next.ev.title}</span>
          <span className="when">{next.dayKey === today ? "Aujourd'hui" : dayLabel(next.dayKey)} · {next.ev.at_time} · {relative(next.start.getTime() - now, next.dayKey)}</span>
        </button>
      )}

      <div className="ct-grid">
        <section className="ct-card" aria-labelledby="ct-ag">
          <div className="ct-card-h"><h2 id="ct-ag">Agenda</h2><span className="ct-sub">14 prochains jours</span></div>
          <div className="ct-card-b">
            <button className="ct-new" disabled={!ready} onClick={() => setAdding('event')}><Plus size={18} strokeWidth={2} /> Nouveau rendez-vous</button>
            <Agenda occ={occ} today={today} ready={ready} onOpen={(ev, dayKey) => setFiche({ kind: 'event', ev, dayKey })} />
          </div>
        </section>

        <div className="ct-col">
          <Tasks tasks={tasks} today={today} disabled={!ready} onNew={() => setAdding('task')} onToggle={act.toggleTask} onOpen={(t) => setFiche({ kind: 'task', t })} />
          <Notes notes={notes} disabled={!ready} onNew={() => setAdding('note')} onOpen={(n) => setFiche({ kind: 'note', n })} />
        </div>
      </div>

      <p className="ct-foot">BY <b>NORD DIGITAL</b></p>
      {toast && <div className="ct-toast" role="status">{toast}</div>}

      {adding && <AddSheet kind={adding} act={act} onClose={() => setAdding(null)} />}
      {fiche && <FicheView fiche={fiche} today={today} act={act} onChange={setFiche} onClose={() => setFiche(null)} />}
    </div>
  )
}

function relative(ms: number, dayKey: string) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `dans ${m} min`
  if (m < 1440) return `dans ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  const days = Math.round((parseDay(dayKey).getTime() - parseDay(ymd(new Date())).getTime()) / 86400000)
  return days <= 1 ? 'demain' : `dans ${days} jours`
}

/* ---------- Agenda ---------- */
function Agenda({ occ, today, ready, onOpen }: { occ: ReturnType<typeof occurrences>; today: string; ready: boolean; onOpen: (ev: WorkEvent, dayKey: string) => void }) {
  const byDay = new Map<string, typeof occ>()
  for (const o of occ) byDay.set(o.dayKey, [...(byDay.get(o.dayKey) ?? []), o])
  const keys = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)).filter((k, i) => i < 2 || byDay.has(k))
  const now = Date.now()
  if (!ready) return <p className="ct-empty">Chargement des rendez-vous…</p>
  return (
    <div className="ct-days">
      {keys.map((k, i) => (
        <div className="ct-day" key={k}>
          <h3>{dayLabel(k)}{i === 0 && <span className="ct-tag">Aujourd'hui</span>}{i === 1 && <span className="ct-tag">Demain</span>}</h3>
          {!byDay.has(k) && <div className="ct-empty-day">Rien de prévu.</div>}
          {byDay.get(k)?.map((o) => {
            const ev = o.ev, allDay = !ev.at_time
            return (
              <button key={`${ev.id}-${k}`} className={`ct-ev${o.end.getTime() < now ? ' past' : ''}${isDeadline(ev.title) ? ' deadline' : ''}`} onClick={() => onOpen(ev, k)}>
                <span className="t">{allDay ? 'Journée' : <>{ev.at_time}<small>→ {hm(o.end)}</small></>}</span>
                <span className="n">{ev.title}</span>
                <span className="acts" aria-hidden="true"><ChevronRight size={18} strokeWidth={1.8} /></span>
                {ev.note && <span className="d">{ev.note}</span>}
                {(ev.remind_min != null || ev.weekly) && (
                  <span className="chips">
                    {ev.remind_min != null && <span className="ct-chip bell">Rappel · {remLabel(ev.remind_min, allDay)}</span>}
                    {ev.weekly && <span className="ct-chip rep">Chaque semaine</span>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
      {occ.length === 0 && <p className="ct-hint">Aucun rendez-vous dans les deux prochaines semaines. Touche « Nouveau rendez-vous » pour ajouter le premier.</p>}
    </div>
  )
}

function EventForm({ initial, disabled, submitLabel, onSave, onCancel, idPrefix = 'ct' }: {
  initial?: WorkEvent; disabled?: boolean; submitLabel: string; onSave: (row: NewEvent) => Promise<unknown>; onCancel?: () => void; idPrefix?: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [day, setDay] = useState(initial?.day ?? ymd(new Date()))
  const [time, setTime] = useState(initial?.at_time ?? '')
  const [dur, setDur] = useState(initial?.duration_min ?? 30)
  const [rem, setRem] = useState<number | null>(initial ? initial.remind_min : 240)
  const [weekly, setWeekly] = useState(initial?.weekly ?? false)
  const [busy, setBusy] = useState(false)
  const options = time ? TIMED_REMINDERS : ALLDAY_REMINDERS
  const changeTime = (v: string) => {
    setTime(v)
    const opts = v ? TIMED_REMINDERS : ALLDAY_REMINDERS
    setRem((r) => (r == null || opts.some(([m]) => m === r) ? r : v ? 15 : 240))
  }
  const durOptions = DURATIONS.some(([m]) => m === dur) ? DURATIONS : [...DURATIONS, [dur, `${dur} min`] as [number, string]]
  const id = (s: string) => `${idPrefix}-${s}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !day) return
    setBusy(true)
    const ok = await onSave({ title: title.trim(), note: note.trim() || null, day, at_time: time || null, duration_min: time ? dur : 30, remind_min: rem, weekly })
    setBusy(false)
    if (ok && !initial) { setTitle(''); setNote(''); setTime(''); setWeekly(false) }
  }
  return (
    <form className="ct-form" onSubmit={submit} autoComplete="off">
      <label className="full" htmlFor={id('title')}>Titre<input id={id('title')} required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Appeler le TL" /></label>
      <label className="third" htmlFor={id('day')}>{weekly ? 'À partir du' : 'Date'}<input id={id('day')} type="date" required value={day} onChange={(e) => setDay(e.target.value)} /></label>
      <label className="third" htmlFor={id('time')}>Heure<input id={id('time')} type="time" value={time} onChange={(e) => changeTime(e.target.value)} /></label>
      <label className="third last" htmlFor={id('dur')}>Durée
        <select id={id('dur')} value={dur} disabled={!time} onChange={(e) => setDur(Number(e.target.value))}>
          {durOptions.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
      </label>
      <label className="half" htmlFor={id('rem')}>Rappel sur le téléphone
        <select id={id('rem')} value={rem ?? ''} onChange={(e) => setRem(e.target.value === '' ? null : Number(e.target.value))}>
          {options.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          <option value="">Pas de rappel</option>
        </select>
      </label>
      <label className="half check" htmlFor={id('weekly')}><input id={id('weekly')} type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Chaque semaine</label>
      <label className="full" htmlFor={id('note')}>Précision (facultatif)<input id={id('note')} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. congé de Chailley" /></label>
      <div className="foot">
        {onCancel ? <button type="button" className="ct-btn" onClick={onCancel}>Annuler</button>
          : <span className="ct-hint">{time ? (isNative ? 'Le rappel arrive en notification sur ce téléphone.' : "Le rappel arrive sur le téléphone où l'appli est installée.") : "Sans heure, c'est une journée entière."}</span>}
        <button className="ct-btn primary" type="submit" disabled={disabled || busy}>{busy ? 'Enregistrement…' : submitLabel}</button>
      </div>
    </form>
  )
}

/* ---------- Tâches ---------- */
function Tasks({ tasks, today, disabled, onNew, onToggle, onOpen }: {
  tasks: WorkTask[]; today: string; disabled: boolean
  onNew: () => void; onToggle: (t: WorkTask) => void; onOpen: (t: WorkTask) => void
}) {
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.created_at.localeCompare(b.created_at))
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, 8)
  const pct = tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 0
  return (
    <section className="ct-card" aria-labelledby="ct-tk">
      <div className="ct-card-h"><h2 id="ct-tk">Tâches</h2><span className="ct-sub">{tasks.length ? `${open.length} à faire` : ''}</span></div>
      <div className="ct-card-b">
        <button className="ct-new" disabled={disabled} onClick={onNew}><Plus size={18} strokeWidth={2} /> Nouvelle tâche</button>
        {tasks.length > 0 && <div className="ct-bar"><div className="bar"><i style={{ width: `${pct}%` }} /></div><span>{pct} % fait</span></div>}
        <div className="ct-tasks">
          {!tasks.length && <p className="ct-empty">Aucune tâche pour l'instant. Note ici ce qui n'a pas d'heure fixe : préparer le Weekly, relancer un dossier…</p>}
          {[...open, ...done].map((t) => (
            <div key={t.id} className={`ct-task${t.done ? ' done' : ''}`}>
              <input type="checkbox" id={`ct-t-${t.id}`} checked={t.done} onChange={() => onToggle(t)} aria-label={t.done ? 'Remettre à faire' : 'Marquer terminée'} />
              <button className="tx" onClick={() => onOpen(t)}>{t.text}</button>
              {t.due ? <DueChip due={t.due} today={today} done={t.done} /> : <span />}
              <ChevronRight size={16} strokeWidth={1.8} className="ct-chev" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DueChip({ due, today, done }: { due: string; today: string; done: boolean }) {
  const tomorrow = addDays(today, 1)
  const cls = done ? '' : due < today ? ' late' : due <= tomorrow ? ' soon' : ''
  return <span className={`ct-due${cls}`}>{due === today ? "Aujourd'hui" : due === tomorrow ? 'Demain' : dayLabel(due)}</span>
}

/* ---------- Notes ---------- */
function Notes({ notes, disabled, onNew, onOpen }: { notes: WorkNote[]; disabled: boolean; onNew: () => void; onOpen: (n: WorkNote) => void }) {
  return (
    <section className="ct-card" aria-labelledby="ct-nt">
      <div className="ct-card-h"><h2 id="ct-nt">Notes</h2><span className="ct-sub">{notes.length ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : ''}</span></div>
      <div className="ct-card-b">
        <button className="ct-new" disabled={disabled} onClick={onNew}><Plus size={18} strokeWidth={2} /> Nouvelle note</button>
        <div className="ct-notes">
          {!notes.length && <p className="ct-empty">Pas encore de note. Touche « Nouvelle note » : compte rendu d'appel, idée pour le Weekly…</p>}
          {notes.map((n) => (
            <button key={n.id} className="ct-note" onClick={() => onOpen(n)}>
              <span className="body clamp">{n.text}</span>
              <span className="stamp">{shortFmt.format(new Date(n.created_at))}</span>
              <span className="acts" aria-hidden="true"><ChevronRight size={16} strokeWidth={1.8} /></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Ajout : un bouton d'abord, le formulaire s'ouvre dans une fiche ---------- */
type AddKind = 'event' | 'task' | 'note'
function AddSheet({ kind, act, onClose }: {
  kind: AddKind; onClose: () => void
  act: { addEvent: (row: NewEvent) => Promise<boolean>; addTask: (text: string, due: string) => Promise<boolean>; addNote: (text: string) => Promise<boolean> }
}) {
  useBackHandler(true, onClose)
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const title = kind === 'event' ? 'Nouveau rendez-vous' : kind === 'task' ? 'Nouvelle tâche' : 'Nouvelle note'
  const saveText = async (e: FormEvent) => {
    e.preventDefault(); if (!text.trim()) return
    setBusy(true)
    const ok = kind === 'task' ? await act.addTask(text.trim(), due) : await act.addNote(text.trim())
    setBusy(false); if (ok) onClose()
  }
  return (
    <div className="ct-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ct-fiche" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ct-f-head">
          <span className="ct-label">{title}</span>
          <button className="ct-icon" aria-label="Fermer" onClick={onClose}><X size={20} strokeWidth={1.8} /></button>
        </div>
        <div className="ct-f-body">
          {kind === 'event' && <EventForm idPrefix="ct-n" submitLabel="Ajouter à l'agenda" onCancel={onClose} onSave={async (row) => { const ok = await act.addEvent(row); if (ok) onClose(); return ok }} />}
          {kind === 'task' && (
            <form className="ct-form" autoComplete="off" onSubmit={saveText}>
              <label className="full" htmlFor="ct-n-task">Tâche<input id="ct-n-task" required autoFocus maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. Préparer le Weekly" /></label>
              <label className="full" htmlFor="ct-n-due">Échéance (facultatif)<input id="ct-n-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
              <div className="foot"><button type="button" className="ct-btn" onClick={onClose}>Annuler</button><button className="ct-btn primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Ajouter la tâche'}</button></div>
            </form>
          )}
          {kind === 'note' && (
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} autoComplete="off" onSubmit={saveText}>
              <textarea id="ct-n-note" className="ct-note-in" style={{ minHeight: 180 }} autoFocus aria-label="Texte de la note" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Compte rendu d'appel, idée pour le Weekly…" />
              <div className="ct-f-foot" style={{ padding: 0, border: 0 }}><button type="button" className="ct-btn" onClick={onClose}>Annuler</button><button className="ct-btn primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la note'}</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Fiche détaillée ---------- */
type Act = {
  saveEvent: (id: string, row: NewEvent) => Promise<WorkEvent | null>; delEvent: (ev: WorkEvent) => Promise<boolean>
  saveTask: (id: string, patch: Partial<WorkTask>) => Promise<WorkTask | null>; toggleTask: (t: WorkTask) => Promise<WorkTask | null>; delTask: (t: WorkTask) => Promise<boolean>
  saveNote: (id: string, text: string) => Promise<WorkNote | null>; delNote: (n: WorkNote) => Promise<boolean>
}

function FicheView({ fiche, today, act, onChange, onClose }: { fiche: Fiche; today: string; act: Act; onChange: (f: Fiche) => void; onClose: () => void }) {
  const [edit, setEdit] = useState(false)
  const [armed, setArmed] = useState(false)
  useBackHandler(true, () => (edit ? setEdit(false) : onClose()))
  useEffect(() => { setEdit(false); setArmed(false) }, [fiche.kind, fiche.kind === 'event' ? fiche.ev.id : fiche.kind === 'task' ? fiche.t.id : fiche.n.id])

  const del = async () => {
    if (!armed) { setArmed(true); return }
    const ok = fiche.kind === 'event' ? await act.delEvent(fiche.ev) : fiche.kind === 'task' ? await act.delTask(fiche.t) : await act.delNote(fiche.n)
    if (ok) onClose()
  }
  const label = fiche.kind === 'event' ? 'Rendez-vous' : fiche.kind === 'task' ? 'Tâche' : 'Note'
  const delLabel = armed ? (fiche.kind === 'event' && fiche.ev.weekly ? 'Confirmer : toutes les semaines' : 'Confirmer la suppression') : 'Supprimer'

  let body: ReactNode = null
  if (fiche.kind === 'event') {
    const ev = fiche.ev, allDay = !ev.at_time
    const start = parseDay(fiche.dayKey, ev.at_time)
    const end = new Date(start.getTime() + ev.duration_min * 60000)
    body = edit
      ? <EventForm initial={ev} idPrefix="ct-f" submitLabel="Enregistrer" onCancel={() => setEdit(false)}
          onSave={async (row) => { const r = await act.saveEvent(ev.id, row); if (r) { onChange({ kind: 'event', ev: r, dayKey: r.weekly ? fiche.dayKey : r.day }); setEdit(false) } return r }} />
      : <>
          <h2 className={`ct-f-title${isDeadline(ev.title) ? ' danger' : ''}`}>{ev.title}</h2>
          <dl className="ct-dl">
            <dt>Quand</dt><dd>{dayLabel(fiche.dayKey)} · {allDay ? 'journée entière' : `${ev.at_time} → ${hm(end)}`}</dd>
            {!allDay && <><dt>Durée</dt><dd>{ev.duration_min >= 60 && ev.duration_min % 60 === 0 ? `${ev.duration_min / 60} h` : `${ev.duration_min} min`}</dd></>}
            <dt>Rappel</dt><dd>{ev.remind_min != null ? remLabel(ev.remind_min, allDay) : 'Aucun'}</dd>
            <dt>Répétition</dt><dd>{ev.weekly ? `Chaque ${new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(parseDay(ev.day))}, depuis le ${dayLabel(ev.day).toLowerCase()}` : 'Une seule fois'}</dd>
            {ev.note && <><dt>Précision</dt><dd className="pre">{ev.note}</dd></>}
            <dt>Créé le</dt><dd className="mono">{stampFmt.format(new Date(ev.created_at))}</dd>
          </dl>
        </>
  } else if (fiche.kind === 'task') {
    const t = fiche.t
    body = edit
      ? <TaskEdit t={t} onCancel={() => setEdit(false)} onSave={async (patch) => { const r = await act.saveTask(t.id, patch); if (r) { onChange({ kind: 'task', t: r }); setEdit(false) } }} />
      : <>
          <h2 className={`ct-f-title${t.done ? ' done' : ''}`}>{t.text}</h2>
          <dl className="ct-dl">
            <dt>Statut</dt><dd><span className={`ct-chip ${t.done ? 'okc' : 'rep'}`}>{t.done ? 'Terminée' : 'À faire'}</span></dd>
            <dt>Échéance</dt><dd>{t.due ? <DueChip due={t.due} today={today} done={t.done} /> : 'Aucune'}</dd>
            {t.done && t.done_at && <><dt>Terminée le</dt><dd className="mono">{stampFmt.format(new Date(t.done_at))}</dd></>}
            <dt>Créée le</dt><dd className="mono">{stampFmt.format(new Date(t.created_at))}</dd>
          </dl>
          <button className="ct-btn" onClick={async () => { const r = await act.toggleTask(t); if (r) onChange({ kind: 'task', t: r }) }}>{t.done ? 'Remettre à faire' : 'Marquer terminée'}</button>
        </>
  } else {
    const n = fiche.n
    body = edit
      ? <NoteEdit n={n} onCancel={() => setEdit(false)} onSave={async (text) => { const r = await act.saveNote(n.id, text); if (r) { onChange({ kind: 'note', n: r }); setEdit(false) } }} />
      : <>
          <p className="ct-f-note">{n.text}</p>
          <dl className="ct-dl"><dt>Écrite le</dt><dd className="mono">{stampFmt.format(new Date(n.created_at))}</dd></dl>
        </>
  }

  return (
    <div className="ct-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ct-fiche" role="dialog" aria-modal="true" aria-label={`Fiche ${label.toLowerCase()}`}>
        <div className="ct-f-head">
          <span className="ct-label">{edit ? `Modifier · ${label}` : label}</span>
          <button className="ct-icon" aria-label="Fermer" onClick={onClose}><X size={20} strokeWidth={1.8} /></button>
        </div>
        <div className="ct-f-body">{body}</div>
        {!edit && (
          <div className="ct-f-foot">
            <button className={`ct-btn${armed ? ' danger' : ''}`} onClick={del}><Trash2 size={16} strokeWidth={1.8} /> {delLabel}</button>
            {armed ? <button className="ct-btn" onClick={() => setArmed(false)}>Annuler</button>
              : <button className="ct-btn primary" onClick={() => setEdit(true)}><Pencil size={16} strokeWidth={1.8} /> Modifier</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskEdit({ t, onSave, onCancel }: { t: WorkTask; onSave: (p: Partial<WorkTask>) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(t.text)
  const [due, setDue] = useState(t.due ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <form className="ct-form" autoComplete="off" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; setBusy(true); await onSave({ text: text.trim(), due: due || null }); setBusy(false) }}>
      <label className="full" htmlFor="ct-f-task">Tâche<input id="ct-f-task" required maxLength={200} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label className="full" htmlFor="ct-f-due">Échéance (facultatif)<input id="ct-f-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <div className="foot"><button type="button" className="ct-btn" onClick={onCancel}>Annuler</button><button className="ct-btn primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>
  )
}

function NoteEdit({ n, onSave, onCancel }: { n: WorkNote; onSave: (text: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(n.text)
  const [busy, setBusy] = useState(false)
  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} autoComplete="off" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; setBusy(true); await onSave(text.trim()); setBusy(false) }}>
      <textarea id="ct-f-note" className="ct-note-in" style={{ minHeight: 180 }} aria-label="Texte de la note" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="ct-f-foot" style={{ padding: 0, border: 0 }}><button type="button" className="ct-btn" onClick={onCancel}>Annuler</button><button className="ct-btn primary" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>
  )
}
