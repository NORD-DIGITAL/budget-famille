import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export type AdminMessage = { id: string; to_user: string | null; title: string; body: string; created_at: string }

/** Petite mémoire partagée : messages de l'admin, lus/non lus, et remarques nouvelles (admin). */
type State = { messages: AdminMessage[]; read: Set<string>; feedbackNew: number; ready: boolean }
let state: State = { messages: [], read: new Set(), feedbackNew: 0, ready: false }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; emit() }

let currentUid: string | null = null
export async function refreshInbox(uid: string | null, isAdmin: boolean) {
  currentUid = uid
  if (!uid) return set({ messages: [], read: new Set(), feedbackNew: 0, ready: true })
  const [m, r, fb] = await Promise.all([
    // Un admin voit aussi ses envois : on ne lui montre ici que ceux qui lui sont adressés
    supabase.from('admin_messages').select('id,to_user,title,body,created_at').or(`to_user.is.null,to_user.eq.${uid}`).order('created_at', { ascending: false }).limit(200),
    supabase.from('admin_message_reads').select('message_id').eq('user_id', uid),
    isAdmin ? supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'nouveau') : Promise.resolve({ count: 0 }),
  ])
  if (currentUid !== uid) return
  set({
    messages: (m.data as AdminMessage[]) ?? [],
    read: new Set(((r.data ?? []) as { message_id: string }[]).map((x) => x.message_id)),
    feedbackNew: (fb as { count: number | null }).count ?? 0, ready: true,
  })
}

export async function markAllRead(uid: string) {
  const unread = state.messages.filter((m) => !state.read.has(m.id))
  if (!unread.length) return
  await supabase.from('admin_message_reads').upsert(unread.map((m) => ({ message_id: m.id, user_id: uid })), { onConflict: 'message_id,user_id', ignoreDuplicates: true })
  set({ read: new Set([...state.read, ...unread.map((m) => m.id)]) })
}

export function useInbox() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state)
  const unread = s.messages.filter((m) => !s.read.has(m.id)).length
  return { ...s, unread }
}

/** Charge au démarrage puis toutes les 2 minutes et au retour dans l'application. */
export function useInboxSync(uid: string | null, isAdmin: boolean) {
  useEffect(() => {
    refreshInbox(uid, isAdmin)
    if (!uid) return
    const t = setInterval(() => refreshInbox(uid, isAdmin), 120_000)
    const v = () => { if (document.visibilityState === 'visible') refreshInbox(uid, isAdmin) }
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [uid, isAdmin])
}

/** Total affiché sur les pastilles : messages non lus (+ remarques nouvelles pour l'admin). */
export function useBadge() {
  const { unread, feedbackNew } = useInbox()
  return unread + feedbackNew
}
