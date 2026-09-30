import { Capacitor } from '@capacitor/core'
import { BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric'

/**
 * Déverrouillage par empreinte / visage :
 * - dans l'APK : capteur du téléphone (plugin natif) ;
 * - dans le navigateur : WebAuthn (empreinte Android, Face ID / Touch ID sur iPhone, Windows Hello sur PC).
 * Rien ne quitte l'appareil : c'est un verrou local posé sur la session déjà ouverte.
 */
const isNative = () => Capacitor.isNativePlatform()
const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const rand = (n = 32) => crypto.getRandomValues(new Uint8Array(n))

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (isNative()) return (await NativeBiometric.isAvailable({ useFallback: true })).isAvailable
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

export const biometricEnabled = (uid: string) => get(`bf-bio-${uid}`) === '1'

async function verifyNative() {
  // Empreinte / visage d'abord ; si ça échoue ou si le capteur est indisponible,
  // le téléphone propose automatiquement son code de verrouillage (PIN, schéma, mot de passe).
  await NativeBiometric.verifyIdentity({
    title: 'Budget.Go.Family', subtitle: 'Déverrouiller',
    description: 'Empreinte, visage ou code du téléphone',
    useFallback: true, fallbackTitle: 'Utiliser le code du téléphone', maxAttempts: 5,
    allowedBiometryTypes: [BiometryType.FINGERPRINT, BiometryType.FACE_AUTHENTICATION, BiometryType.IRIS_AUTHENTICATION, BiometryType.DEVICE_CREDENTIAL],
  })
}

/** Active le déverrouillage : demande une première vérification. */
export async function enableBiometric(uid: string, email: string): Promise<string | null> {
  try {
    if (isNative()) { await verifyNative() }
    else {
      const cred = (await navigator.credentials.create({ publicKey: {
        challenge: rand(), rp: { name: 'Budget.Go.Family' },
        user: { id: rand(16), name: email || 'budget', displayName: email || 'Budget.Go.Family' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
      } })) as PublicKeyCredential | null
      if (!cred) return 'Activation annulée.'
      set(`bf-bio-cred-${uid}`, b64(cred.rawId))
    }
    set(`bf-bio-${uid}`, '1')
    return null
  } catch { return "L'empreinte ou le visage n'a pas été reconnu, ou l'activation a été annulée." }
}

export function disableBiometric(uid: string) { set(`bf-bio-${uid}`, null); set(`bf-bio-cred-${uid}`, null) }

export async function verifyBiometric(uid: string): Promise<boolean> {
  try {
    if (isNative()) { await verifyNative(); return true }
    const id = get(`bf-bio-cred-${uid}`)
    const res = await navigator.credentials.get({ publicKey: {
      challenge: rand(), userVerification: 'required', timeout: 60000,
      ...(id ? { allowCredentials: [{ type: 'public-key', id: unb64(id) }] } : {}),
    } })
    return !!res
  } catch { return false }
}

/* ---------- Déconnexion automatique à 8 h et 18 h ---------- */
export const LOCK_HOURS = [8, 18]
const lastKey = (uid: string) => `bf-last-auth-${uid}`
export const markAuth = (uid: string) => set(lastKey(uid), String(Date.now()))

/** Dernière échéance (8 h ou 18 h) passée avant maintenant. */
function lastBoundary(now = new Date()) {
  const cands = [-1, 0].flatMap((d) => LOCK_HOURS.map((h) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, 0, 0).getTime()))
  return Math.max(...cands.filter((t) => t <= now.getTime()))
}
/** Vrai si la session a commencé avant la dernière échéance de 8 h / 18 h. */
export function sessionExpired(uid: string) {
  const v = get(lastKey(uid))
  if (!v) { markAuth(uid); return false }
  return Number(v) < lastBoundary()
}
