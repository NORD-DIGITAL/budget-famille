import { useEffect, useState } from 'react'

export type ThemeId = 'soleil' | 'menthe' | 'lagon'
export const THEMES: { id: ThemeId; label: string; color: string }[] = [
  { id: 'soleil', label: 'Soleil', color: '#FFCC00' },
  { id: 'menthe', label: 'Menthe', color: '#10B981' },
  { id: 'lagon', label: 'Lagon', color: '#0EA5E9' },
]

const key = (uid: string) => `bf-theme-${uid}`
const listeners = new Set<() => void>()
export function getUserTheme(uid: string | null): ThemeId {
  try { const v = uid ? localStorage.getItem(key(uid)) : null; if (v && THEMES.some((t) => t.id === v)) return v as ThemeId } catch { /* ignore */ }
  return 'soleil'
}
export function setUserTheme(uid: string, t: ThemeId) {
  try { localStorage.setItem(key(uid), t) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}
export function useUserTheme(uid: string | null): ThemeId {
  const [t, setT] = useState(getUserTheme(uid))
  useEffect(() => { setT(getUserTheme(uid)); const l = () => setT(getUserTheme(uid)); listeners.add(l); return () => { listeners.delete(l) } }, [uid])
  return t
}

/** Le carnet principal garde le thème choisi ; les autres carnets prennent une autre couleur, toujours la même pour un carnet donné. */
export function themeForCarnet(carnetId: string | null, principalId: string | null, userTheme: ThemeId): ThemeId {
  if (!carnetId || carnetId === principalId) return userTheme
  const others = THEMES.filter((t) => t.id !== userTheme)
  let h = 0
  for (const ch of carnetId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return others[h % others.length].id
}

export function applyTheme(t: ThemeId) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find((x) => x.id === t)!.color)
}
