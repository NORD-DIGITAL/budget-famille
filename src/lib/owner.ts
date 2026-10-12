import type { Session } from '@supabase/supabase-js'

/** Compte propriétaire (Sam-san) : seul à voir le Carnet de travail et le thème Encre. */
export const OWNER_EMAIL = 'gosamsan1122@gmail.com'
export const isOwner = (session: Session | null | undefined) => (session?.user.email ?? '').toLowerCase() === OWNER_EMAIL
