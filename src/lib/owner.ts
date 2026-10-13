import type { Session } from '@supabase/supabase-js'

/** Compte propriétaire (Sam-san) : seul à voir le Carnet de travail et le thème Encre. */
export const OWNER_EMAIL = 'gosamsan1122@gmail.com'
export const isOwner = (session: Session | null | undefined) => (session?.user.email ?? '').toLowerCase() === OWNER_EMAIL

/**
 * Partenaires Business Pro (Sam-san et Chloé) : seuls à voir la section Business Pro, et accès illimité sans Go Code.
 * Doit rester identique à la table app_partners côté serveur (supabase/business_pro.sql), qui fait foi pour les données.
 */
export const PARTNER_EMAILS = ['gosamsan1122@gmail.com', 'raharisoamaevahchloe@gmail.com']
export const isPartner = (session: Session | null | undefined) => PARTNER_EMAILS.includes((session?.user.email ?? '').toLowerCase())
