import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { supabase } from './supabase'

/* ---------- Carnet de travail : types et accès Supabase ---------- */

export interface WorkEvent {
  id: string; title: string; note: string | null; day: string; at_time: string | null
  duration_min: number; remind_min: number | null; weekly: boolean; created_at: string
}
export interface WorkTask { id: string; text: string; due: string | null; done: boolean; done_at: string | null; created_at: string }
export interface WorkNote { id: string; text: string; created_at: string }

/** Une occurrence affichée dans l'agenda (un rendez-vous hebdomadaire en donne plusieurs). */
export interface Occurrence { ev: WorkEvent; dayKey: string; start: Date; end: Date }

/** Vrai quand les tables du carnet n'existent pas encore côté serveur. */
export const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|does not exist/i.test(e.message ?? ''))

export async function loadWork() {
  const [ev, tk, nt] = await Promise.all([
    supabase.from('work_events').select('*').order('day'),
    supabase.from('work_tasks').select('*').order('created_at'),
    supabase.from('work_notes').select('*').order('created_at', { ascending: false }),
  ])
  const err = ev.error ?? tk.error ?? nt.error
  return {
    events: (ev.data ?? []) as WorkEvent[], tasks: (tk.data ?? []) as WorkTask[], notes: (nt.data ?? []) as WorkNote[],
    missing: isMissingTable(err), error: err && !isMissingTable(err) ? err.message : '',
  }
}

/* ---------- Dates (heure locale du téléphone) ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export function parseDay(key: string, time?: string | null) {
  const [y, m, d] = key.split('-').map(Number)
  const [h, mi] = (time ?? '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, mi)
}
export const addDays = (key: string, n: number) => { const d = parseDay(key); d.setDate(d.getDate() + n); return ymd(d) }
export function dayLabel(key: string) {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(parseDay(key))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Occurrences entre aujourd'hui et aujourd'hui + n jours. */
export function occurrences(events: WorkEvent[], from: string, days: number): Occurrence[] {
  const out: Occurrence[] = []
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i)
    const wd = parseDay(key).getDay()
    for (const ev of events) {
      const hit = ev.weekly ? key >= ev.day && parseDay(ev.day).getDay() === wd : ev.day === key
      if (!hit) continue
      const start = parseDay(key, ev.at_time)
      const end = ev.at_time ? new Date(start.getTime() + ev.duration_min * 60000) : parseDay(addDays(key, 1))
      out.push({ ev, dayKey: key, start, end })
    }
  }
  return out.sort((a, b) => (a.ev.at_time ? 1 : 0) - (b.ev.at_time ? 1 : 0) || a.start.getTime() - b.start.getTime())
}

export function remLabel(min: number | null, allDay: boolean) {
  if (min == null) return ''
  if (allDay) {
    if (min === 240) return 'La veille à 20h'
    if (min === 960) return 'La veille à 8h'
    return `La veille vers ${(24 - Math.round(min / 60) + 48) % 24}h`
  }
  if (min === 0) return "À l'heure"
  if (min < 60) return `${min} min avant`
  if (min === 1440) return '1 jour avant'
  return min % 60 === 0 ? `${min / 60} h avant` : `${min} min avant`
}

/* ---------- Notifications du téléphone (APK) ---------- */

const KIND = 'travail'
const idFor = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 2_000_000 + (h % 900_000) }

/** Reprogramme toutes les notifications du carnet de travail à partir de la liste des rendez-vous. */
export async function syncWorkReminders(events: WorkEvent[]) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.extra?.kind === KIND)
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    const now = Date.now()
    const list = events.filter((e) => e.remind_min != null).map((e) => {
      const fire = new Date(parseDay(e.day, e.at_time).getTime() - e.remind_min! * 60000)
      const body = e.at_time ? `${e.at_time} · ${e.title}` : `Demain · ${e.title}`
      if (e.weekly) {
        return {
          id: idFor(e.id), title: 'Carnet de travail', body,
          schedule: { on: { weekday: fire.getDay() + 1, hour: fire.getHours(), minute: fire.getMinutes() }, allowWhileIdle: true },
          extra: { kind: KIND, event: e.id },
        }
      }
      if (fire.getTime() <= now) return null
      return { id: idFor(e.id), title: 'Carnet de travail', body, schedule: { at: fire, allowWhileIdle: true }, extra: { kind: KIND, event: e.id } }
    }).filter((n): n is NonNullable<typeof n> => !!n)
    if (!list.length) return
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return
    await LocalNotifications.schedule({ notifications: list })
  } catch { /* notifications indisponibles */ }
}
