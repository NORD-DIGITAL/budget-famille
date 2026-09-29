import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from './types'

const KEY = 'bf-hide-amounts'
const listeners = new Set<(v: boolean) => void>()
let hidden = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()

/** Masquer / afficher les montants (partagé entre les écrans, mémorisé sur l'appareil). */
export function useHidden(): [boolean, () => void] {
  const [v, setV] = useState(hidden)
  useEffect(() => { listeners.add(setV); return () => { listeners.delete(setV) } }, [])
  const toggle = () => {
    hidden = !hidden
    try { localStorage.setItem(KEY, hidden ? '1' : '0') } catch { /* ignore */ }
    listeners.forEach((l) => l(hidden))
  }
  return [v, toggle]
}

export function userInfo(session: Session | null, profile?: Profile | null) {
  const md = (session?.user.user_metadata ?? {}) as { full_name?: string; phone_local?: string }
  const email = session?.user.email ?? ''
  const name = profile?.full_name?.trim() || md.full_name?.trim() || email.split('@')[0] || 'Moi'
  const initials = name.split(/[\s\-_.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'M'
  return { name, initials, phone: md.phone_local ?? '', email }
}
