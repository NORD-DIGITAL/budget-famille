import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

/**
 * Numéro de version de l'application (à augmenter à chaque mise à jour publiée).
 * Règle NORD DIGITAL : si APP_VERSION < min_version (table app_config), l'application est bloquée.
 */
export const APP_VERSION = 30
export const APP_LABEL = '3.0'
export const isNative = Capacitor.isNativePlatform()
export const OLD_VERSION_MSG = "Vous utilisez l'ancienne version de Budget.Go.Family, merci de contacter Nord Digital svp."

export type AppConfig = { min: number; latest: number; apkUrl: string; webUrl: string }

/** Lit la configuration publique (sans connexion). Hors ligne : on ne bloque pas. */
export function useAppConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data, error } = await supabase.from('app_config').select('key,value')
      if (!alive || error || !data) return
      const m = new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]))
      setCfg({ min: Number(m.get('min_version') ?? 0), latest: Number(m.get('latest_version') ?? 0), apkUrl: m.get('apk_url') ?? '', webUrl: m.get('web_url') ?? '' })
    }
    load()
    const v = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', v)
    return () => { alive = false; document.removeEventListener('visibilitychange', v) }
  }, [])
  return cfg
}

/** Ouvre le lien de téléchargement de l'APK dans le navigateur du téléphone. */
export function openApk(url: string) {
  if (isNative) window.location.href = url
  else window.open(url, '_blank', 'noopener')
}

/** Version web : vide le cache hors ligne et recharge la dernière version. */
export async function reloadLatestWeb() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((regs ?? []).map((r) => r.update().catch(() => undefined)))
    const keys = await caches?.keys?.()
    await Promise.all((keys ?? []).map((k) => caches.delete(k)))
  } catch { /* ignore */ }
  window.location.reload()
}
