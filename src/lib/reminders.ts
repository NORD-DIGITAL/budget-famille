import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Goal, SavingsMove } from './types'
import { fmt } from './format'

const idFor = (goalId: string) => { let h = 0; for (const c of goalId) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 10000 + (h % 900000) }

/** APK : programme une notification chaque mois, le jour choisi, à 8 h. */
export async function syncReminders(goals: Goal[], carnetName: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.extra?.kind === 'epargne')
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    const list = goals.filter((g) => g.monthly_day)
    if (!list.length) return
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return
    await LocalNotifications.schedule({ notifications: list.map((g) => ({
      id: idFor(g.id), title: 'Épargne du mois',
      body: `${g.name}${g.monthly_amount ? ` : ${fmt(g.monthly_amount)}` : ''} (${carnetName})`,
      schedule: { on: { day: Math.min(28, g.monthly_day!), hour: 8, minute: 0 }, allowWhileIdle: true },
      extra: { kind: 'epargne', goal: g.id },
    })) })
  } catch { /* notifications indisponibles */ }
}

/** Web et APK : épargnes mensuelles dont le jour est passé sans versement ce mois-ci. */
export function dueReminders(goals: Goal[], moves: SavingsMove[], now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return goals.filter((g) => g.monthly_day && now.getDate() >= Math.min(28, g.monthly_day)
    && !moves.some((m) => m.goal_id === g.id && m.amount > 0 && m.moved_on.startsWith(month)))
}
