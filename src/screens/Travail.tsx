import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import '@fontsource/bricolage-grotesque/500.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './travail.css'
import { supabase } from '../lib/supabase'
import { isNative } from '../lib/version'
import { addDays, dayLabel, hm, loadWork, occurrences, parseDay, remLabel, syncWorkReminders, ymd } from '../lib/travail'
import type { WorkEvent, WorkNote, WorkTask } from '../lib/travail'

const DAYS_AHEAD = 14
const TIMED_REMINDERS: [number, string][] = [[5, '5 min avant'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant'], [1440, '1 jour avant']]
const ALLDAY_REMINDERS: [number, string][] = [[240, 'La veille à 20h'], [960, 'La veille à 8h']]

/** Section « Carnet de travail » : rendez-vous (avec rappels sur le téléphone), tâches et notes. */
export function TravailPage() {
  const [events, setEvents] = useState<WorkEvent[]>([])
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [notes, setNotes] = useState<WorkNote[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [toast, setToast] = useState('')
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

  const today = ymd(new Date())
  const occ = useMemo(() => occurrences(events, today, DAYS_AHEAD), [events, today])
  const now = Date.now()
  const next = occ.find((o) => o.ev.at_time && o.start.getTime() > now)

  return (
    <div className="ct">
      <div className="ct-intro">
        <p>Rendez-vous, tâches et notes de travail</p>
        <span className="ct-sync">
          <span className={`ct-dot ${state === 'ready' ? 'on' : state === 'loading' ? 'busy' : 'err'}`} />
          {state === 'ready' ? (isNative ? 'Rappels actifs sur ce téléphone' : 'Rappels sur l\'appli Android') : state === 'loading' ? 'Chargement…' : 'Hors service'}
        </span>
      </div>

      {state === 'missing' && <p className="ct-notice warn" style={{ marginBottom: 16 }}>Le carnet de travail n'est pas encore activé sur le serveur. Contacte NORD DIGITAL.</p>}
      {state === 'error' && <p className="ct-notice err" style={{ marginBottom: 16 }}>Le carnet ne se charge pas ({errMsg}). Tire vers le bas ou reviens dans un instant.</p>}

      {next && (
        <div className="ct-next">
          <span className="lbl">Prochain rendez-vous</span>
          <span className="what">{next.ev.title}</span>
          <span className="when">{next.dayKey === today ? "Aujourd'hui" : dayLabel(next.dayKey)} · {next.ev.at_time} · {relative(next.start.getTime() - now, next.dayKey)}</span>
        </div>
      )}

      <div className="ct-grid">
        <section className="ct-card" aria-labelledby="ct-ag">
          <div className="ct-card-h"><h2 id="ct-ag">Agenda</h2><span className="ct-sub">14 prochains jours</span></div>
          <div className="ct-card-b">
            <Agenda occ={occ} today={today} ready={state === 'ready'} onDelete={async (ev) => {
              const { error } = await supabase.from('work_events').delete().eq('id', ev.id)
              if (fail(error, 'la suppression')) return
              setEvents((l) => l.filter((x) => x.id !== ev.id)); flash('Rendez-vous supprimé')
            }} />
            <EventForm disabled={state !== 'ready'} onSave={async (row) => {
              const { data, error } = await supabase.from('work_events').insert(row).select().single()
              if (fail(error, 'le rendez-vous')) return false
              setEvents((l) => [...l, data as WorkEvent]); flash(row.remind_min != null && isNative ? 'Ajouté, rappel programmé' : 'Rendez-vous ajouté')
              return true
            }} />
          </div>
        </section>

        <div className="ct-col">
          <Tasks tasks={tasks} today={today} disabled={state !== 'ready'}
            onAdd={async (text, due) => {
              const { data, error } = await supabase.from('work_tasks').insert({ text, due: due || null }).select().single()
              if (!fail(error, 'la tâche')) setTasks((l) => [...l, data as WorkTask])
            }}
            onToggle={async (t) => {
              const patch = { done: !t.done, done_at: !t.done ? new Date().toISOString() : null }
              setTasks((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))
              const { error } = await supabase.from('work_tasks').update(patch).eq('id', t.id)
              if (fail(error, 'la tâche')) setTasks((l) => l.map((x) => (x.id === t.id ? t : x)))
            }}
            onDelete={async (t) => {
              const { error } = await supabase.from('work_tasks').delete().eq('id', t.id)
              if (!fail(error, 'la suppression')) setTasks((l) => l.filter((x) => x.id !== t.id))
            }} />
          <Notes notes={notes} disabled={state !== 'ready'}
            onAdd={async (text) => {
              const { data, error } = await supabase.from('work_notes').insert({ text }).select().single()
              if (fail(error, 'la note')) return false
              setNotes((l) => [data as WorkNote, ...l]); flash('Note enregistrée'); return true
            }}
            onDelete={async (n) => {
              const { error } = await supabase.from('work_notes').delete().eq('id', n.id)
              if (!fail(error, 'la suppression')) setNotes((l) => l.filter((x) => x.id !== n.id))
            }} />
        </div>
      </div>

      <p className="ct-foot">BY <b>NORD DIGITAL</b></p>
      {toast && <div className="ct-toast" role="status">{toast}</div>}
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
function Agenda({ occ, today, ready, onDelete }: { occ: ReturnType<typeof occurrences>; today: string; ready: boolean; onDelete: (ev: WorkEvent) => Promise<void> }) {
  const [armed, setArmed] = useState<string | null>(null)
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
            const ev = o.ev, allDay = !ev.at_time, key = `${ev.id}-${k}`
            const deadline = /deadline|date limite|échéance/i.test(ev.title)
            return (
              <div key={key} className={`ct-ev${o.end.getTime() < now ? ' past' : ''}${deadline ? ' deadline' : ''}`}>
                <div className="t">{allDay ? 'Journée' : <>{ev.at_time}<small>→ {hm(o.end)}</small></>}</div>
                <div className="n">{ev.title}</div>
                <div className="acts">
                  {armed === key ? (
                    <>
                      <button className="ct-btn danger sm" onClick={async () => { await onDelete(ev); setArmed(null) }}>{ev.weekly ? 'Supprimer toutes les semaines' : 'Supprimer'}</button>
                      <button className="ct-btn sm" onClick={() => setArmed(null)}>Annuler</button>
                    </>
                  ) : (
                    <button className="ct-icon del" aria-label={`Supprimer ${ev.title}`} onClick={() => setArmed(key)}><Trash2 size={17} strokeWidth={1.8} /></button>
                  )}
                </div>
                {ev.note && <div className="d">{ev.note}</div>}
                {(ev.remind_min != null || ev.weekly) && (
                  <div className="chips">
                    {ev.remind_min != null && <span className="ct-chip bell">Rappel · {remLabel(ev.remind_min, allDay)}</span>}
                    {ev.weekly && <span className="ct-chip rep">Chaque semaine</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {occ.length === 0 && <p className="ct-hint">Aucun rendez-vous dans les deux prochaines semaines. Ajoute le premier avec le formulaire ci-dessous.</p>}
    </div>
  )
}

type NewEvent = Pick<WorkEvent, 'title' | 'note' | 'day' | 'at_time' | 'duration_min' | 'remind_min' | 'weekly'>

function EventForm({ disabled, onSave }: { disabled: boolean; onSave: (row: NewEvent) => Promise<boolean> }) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [day, setDay] = useState(ymd(new Date()))
  const [time, setTime] = useState('')
  const [dur, setDur] = useState(30)
  const [rem, setRem] = useState<number | null>(240)
  const [weekly, setWeekly] = useState(false)
  const [busy, setBusy] = useState(false)
  const options = time ? TIMED_REMINDERS : ALLDAY_REMINDERS
  useEffect(() => {
    setRem((r) => (r == null || options.some(([m]) => m === r) ? r : time ? 15 : 240))
  }, [time]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !day) return
    setBusy(true)
    const ok = await onSave({ title: title.trim(), note: note.trim() || null, day, at_time: time || null, duration_min: time ? dur : 30, remind_min: rem, weekly })
    setBusy(false)
    if (ok) { setTitle(''); setNote(''); setTime(''); setWeekly(false) }
  }
  return (
    <form className="ct-form" onSubmit={submit} autoComplete="off">
      <span className="ct-label full">Nouveau rendez-vous</span>
      <label className="full" htmlFor="ct-title">Titre<input id="ct-title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Appeler le TL" /></label>
      <label className="third" htmlFor="ct-day">Date<input id="ct-day" type="date" required value={day} onChange={(e) => setDay(e.target.value)} /></label>
      <label className="third" htmlFor="ct-time">Heure<input id="ct-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label className="third last" htmlFor="ct-dur">Durée
        <select id="ct-dur" value={dur} disabled={!time} onChange={(e) => setDur(Number(e.target.value))}>
          <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option><option value={120}>2 h</option>
        </select>
      </label>
      <label className="half" htmlFor="ct-rem">Rappel sur le téléphone
        <select id="ct-rem" value={rem ?? ''} onChange={(e) => setRem(e.target.value === '' ? null : Number(e.target.value))}>
          {options.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          <option value="">Pas de rappel</option>
        </select>
      </label>
      <label className="half check" htmlFor="ct-weekly"><input id="ct-weekly" type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Chaque semaine</label>
      <label className="full" htmlFor="ct-note">Précision (facultatif)<input id="ct-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. congé de Chailley" /></label>
      <div className="foot">
        <span className="ct-hint">{time ? (isNative ? 'Le rappel arrive en notification sur ce téléphone.' : "Le rappel arrive sur le téléphone où l'appli est installée.") : "Sans heure, c'est une journée entière."}</span>
        <button className="ct-btn primary" type="submit" disabled={disabled || busy}>{busy ? 'Ajout…' : "Ajouter à l'agenda"}</button>
      </div>
    </form>
  )
}

/* ---------- Tâches ---------- */
function Tasks({ tasks, today, disabled, onAdd, onToggle, onDelete }: {
  tasks: WorkTask[]; today: string; disabled: boolean
  onAdd: (text: string, due: string) => Promise<void>; onToggle: (t: WorkTask) => void; onDelete: (t: WorkTask) => void
}) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.created_at.localeCompare(b.created_at))
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, 8)
  const pct = tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 0
  const tomorrow = addDays(today, 1)
  return (
    <section className="ct-card" aria-labelledby="ct-tk">
      <div className="ct-card-h"><h2 id="ct-tk">Tâches</h2><span className="ct-sub">{tasks.length ? `${open.length} à faire` : ''}</span></div>
      <div className="ct-card-b">
        <form className="ct-add" autoComplete="off" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; const t = text.trim(), d = due; setText(''); setDue(''); await onAdd(t, d) }}>
          <input id="ct-task" aria-label="Nouvelle tâche" placeholder="Ajouter une tâche…" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
          <input id="ct-due" className="due-in" type="date" aria-label="Échéance (facultatif)" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="ct-btn primary" type="submit" disabled={disabled}>Ajouter</button>
        </form>
        {tasks.length > 0 && <div className="ct-bar"><div className="bar"><i style={{ width: `${pct}%` }} /></div><span>{pct} % fait</span></div>}
        <div className="ct-tasks">
          {!tasks.length && <p className="ct-empty">Aucune tâche pour l'instant. Note ici ce qui n'a pas d'heure fixe : préparer le Weekly, relancer un dossier…</p>}
          {[...open, ...done].map((t) => {
            const cls = !t.due || t.done ? '' : t.due < today ? ' late' : t.due <= tomorrow ? ' soon' : ''
            return (
              <div key={t.id} className={`ct-task${t.done ? ' done' : ''}`}>
                <input type="checkbox" id={`ct-t-${t.id}`} checked={t.done} onChange={() => onToggle(t)} aria-label="Terminée" />
                <label className="tx" htmlFor={`ct-t-${t.id}`}>{t.text}</label>
                {t.due ? <span className={`ct-due${cls}`}>{t.due === today ? "Aujourd'hui" : t.due === tomorrow ? 'Demain' : dayLabel(t.due)}</span> : <span />}
                <button className="ct-icon del" aria-label="Supprimer la tâche" onClick={() => onDelete(t)}><Trash2 size={16} strokeWidth={1.8} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------- Notes ---------- */
function Notes({ notes, disabled, onAdd, onDelete }: { notes: WorkNote[]; disabled: boolean; onAdd: (t: string) => Promise<boolean>; onDelete: (n: WorkNote) => void }) {
  const [text, setText] = useState('')
  const [armed, setArmed] = useState<string | null>(null)
  const f = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <section className="ct-card" aria-labelledby="ct-nt">
      <div className="ct-card-h"><h2 id="ct-nt">Notes</h2><span className="ct-sub">{notes.length ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : ''}</span></div>
      <div className="ct-card-b">
        <form style={{ display: 'flex', flexDirection: 'column', gap: 8 }} autoComplete="off" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await onAdd(text.trim()))) setText('') }}>
          <textarea id="ct-note-in" className="ct-note-in" aria-label="Nouvelle note" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Note rapide : compte rendu d'appel, idée pour le Weekly…" />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="ct-btn primary" type="submit" disabled={disabled}>Enregistrer la note</button></div>
        </form>
        <div className="ct-notes">
          {!notes.length && <p className="ct-empty">Pas encore de note. Écris-en une au-dessus, elle restera ici.</p>}
          {notes.map((n) => (
            <div key={n.id} className="ct-note">
              <div className="body">{n.text}</div>
              <div className="stamp">{f.format(new Date(n.created_at))}</div>
              <div className="acts">
                <button className={`ct-icon del${armed === n.id ? ' armed' : ''}`} aria-label={armed === n.id ? 'Toucher encore pour supprimer' : 'Supprimer la note'}
                  onClick={() => (armed === n.id ? onDelete(n) : setArmed(n.id))}><Trash2 size={16} strokeWidth={1.8} /></button>
              </div>
              {armed === n.id && <span className="ct-hint">Touche encore la corbeille pour supprimer.</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
