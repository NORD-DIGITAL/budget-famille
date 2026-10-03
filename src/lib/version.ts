import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

/**
 * Version au format X.Y.Z (règle NORD DIGITAL) :
 *   X = refonte majeure, Y = nouvelles fonctions, Z = corrections.
 * APP_VERSION = X*10000 + Y*100 + Z (sert à comparer avec min_version / latest_version de app_config).
 * Si APP_VERSION < min_version, l'application est bloquée.
 */
export const APP_LABEL = '3.5.0'
export const APP_VERSION = APP_LABEL.split('.').map(Number).reduce((a, n, i) => a + n * [10000, 100, 1][i], 0)
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
