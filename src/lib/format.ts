export const fmt = (n: number, cur = 'Ar') =>
  `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} ${cur}`

export const signed = (n: number, cur = 'Ar') => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), cur)

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const addMonths = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const monthShort = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
}
export const daysInMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const dayLabel = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const t = todayISO()
  if (iso === t) return "Aujourd'hui"
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (iso === `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`) return 'Hier'
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const parseAmount = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0
export const COLORS = ['#3b82f6','#14b8a6','#8b5cf6','#eab308','#a855f7','#ef4444','#0ea5e9','#f97316','#ca8a04','#06b6d4','#ec4899','#22c55e','#64748b','#84cc16']
