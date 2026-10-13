import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Mode PRO (v3.9.0).
 * - Projet Légumes : Sam-san + Chloé. Projet NORD DIGITAL : Sam-san + Andrinirina.
 * - Les membres d'un projet sont PRO d'office ; tout autre utilisateur peut « Passer en PRO » (table pro_users).
 * Le serveur fait foi (my_pro, bp_member) ; ces listes ne servent que de secours si le serveur ne répond pas.
 */
export type Projet = 'legumes' | 'nord-digital'
export const PROJET_MEMBERS: Record<Projet, string[]> = {
  legumes: ['gosamsan1122@gmail.com', 'raharisoamaevahchloe@gmail.com'],
  'nord-digital': ['gosamsan1122@gmail.com', 'andrinirinaonja@gmail.com'],
}
export const ADMIN_WHATSAPP = '261342943804'
export const ADMIN_WHATSAPP_LOCAL = '034 29 438 04'
export const PRO_WELCOME_KEY = 'bf-pro-welcome'

const emailOf = (s: Session | null | undefined) => (s?.user.email ?? '').toLowerCase()
const fallbackProjets = (s: Session | null | undefined) => (Object.keys(PROJET_MEMBERS) as Projet[]).filter((p) => PROJET_MEMBERS[p].includes(emailOf(s)))

export type ProState = { ready: boolean; pro: boolean; projets: Projet[] }
const cache = new Map<string, ProState>()
const listeners = new Set<() => void>()

async function fetchPro(uid: string, session: Session) {
  const { data, error } = await supabase.rpc('my_pro')
  const row = (Array.isArray(data) ? data[0] : data) as { pro: boolean; projets: string[] } | undefined
  const fb = fallbackProjets(session)
  const st: ProState = error || !row
    ? { ready: true, pro: fb.length > 0, projets: fb }
    : { ready: true, pro: !!row.pro, projets: (row.projets ?? []).filter((p): p is Projet => p === 'legumes' || p === 'nord-digital') }
  cache.set(uid, st)
  listeners.forEach((l) => l())
}

/** État PRO de l'utilisateur connecté (mis en cache pour toute la session). */
export function usePro(session: Session | null | undefined): ProState {
  const uid = session?.user.id ?? ''
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((x) => x + 1)
    listeners.add(l)
    if (uid && session && !cache.has(uid)) { cache.set(uid, { ready: false, pro: fallbackProjets(session).length > 0, projets: fallbackProjets(session) }); fetchPro(uid, session) }
    return () => { listeners.delete(l) }
  }, [uid, session])
  if (!uid) return { ready: true, pro: false, projets: [] }
  return cache.get(uid) ?? { ready: false, pro: fallbackProjets(session).length > 0, projets: fallbackProjets(session) }
}

/** Accès illimité côté appli (secours) : membres d'un projet. */
export const isProjectMember = (s: Session | null | undefined) => fallbackProjets(s).length > 0

/** « Passer en PRO » : enregistre le choix, puis l'appelant déconnecte l'utilisateur. */
export async function becomePro(): Promise<string> {
  const { error } = await supabase.from('pro_users').insert({})
  if (error && error.code !== '23505') return /pro_users|does not exist|PGRST205/i.test(error.message) ? "Le mode PRO n'est pas encore activé sur le serveur." : "Impossible pour l'instant. Vérifie ta connexion."
  return ''
}

export const whatsappAdmin = (text: string) => `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`
