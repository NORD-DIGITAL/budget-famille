import { useState } from 'react'
import { BookOpen, Check, ChevronDown, LogOut, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Carnet } from '../lib/types'
import { useData } from '../lib/data'
import { useUserTheme, themeForCarnet, THEMES } from '../lib/theme'
import { Sheet } from './ui'

/** Pastille de couleur d'un carnet (même règle de couleur que l'application). */
function useCarnetColor() {
  const { session, principalId } = useData()
  const userTheme = useUserTheme(session?.user.id ?? null)
  return (id: string) => THEMES.find((t) => t.id === themeForCarnet(id, principalId, userTheme))!.color
}

/** Liste des carnets pour passer de l'un à l'autre, les supprimer ou les quitter. */
export function CarnetSwitchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { carnets, carnet, switchCarnet, principalId, loadCarnet } = useData()
  const color = useCarnetColor()
  const [target, setTarget] = useState<Carnet | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const owner = target?.role === 'proprietaire'
  const close = () => { setTarget(null); setTyped(''); setErr(''); onClose() }

  const remove = async () => {
    if (!target) return
    setBusy(true); setErr('')
    if (owner) {
      // Photos du carnet effacées du stockage avant la suppression
      const { data: ph } = await supabase.from('attachments').select('path').eq('carnet_id', target.id)
      const paths = (ph ?? []).map((r: { path: string }) => r.path)
      if (paths.length) await supabase.storage.from('attachments').remove(paths)
    }
    const { error } = await supabase.rpc(owner ? 'delete_carnet' : 'leave_carnet', { c: target.id })
    setBusy(false)
    if (error) return setErr(error.message.replace(/^.*?: /, ''))
    if (target.id === carnet?.id) { const next = carnets.find((c) => c.id !== target.id); if (next) switchCarnet(next.id) }
    await loadCarnet(); setTarget(null); setTyped('')
  }

  return (
    <Sheet open={open} onClose={close} title={target ? (owner ? 'Supprimer ce carnet ?' : 'Quitter ce carnet ?') : 'Changer de carnet'}>
      {target ? (
        <div className="space-y-4">
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {owner
              ? <>Le carnet <b>« {target.name} »</b> et <b>toutes ses données</b> (opérations, budgets, épargnes, dettes, courses, photos) seront effacés définitivement, pour toutes les personnes qui le partagent.</>
              : <>Tu n'auras plus accès au carnet <b>« {target.name} »</b>. Ses données restent intactes pour les autres membres. Tu pourras revenir avec le code du carnet.</>}
          </p>
          {owner && <div><label className="label" htmlFor="del-c">Écris SUPPRIMER pour confirmer</label><input id="del-c" className="input" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoComplete="off" /></div>}
          {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
          <button disabled={busy || (owner && typed !== 'SUPPRIMER')} onClick={remove} className="btn w-full bg-red-500 text-white">
            {owner ? <Trash2 size={18} /> : <LogOut size={18} />}{busy ? '…' : owner ? 'Supprimer définitivement' : 'Quitter le carnet'}
          </button>
          <button onClick={() => { setTarget(null); setErr('') }} className="w-full py-2 text-sm text-ink-muted">Annuler</button>
        </div>
      ) : (
        <div className="space-y-2">
          {carnets.map((c) => {
            const canDelete = carnets.length > 1
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded-2xl border p-2 pl-3 ${c.id === carnet?.id ? 'border-ink bg-white' : 'border-cream-line bg-cream-tile'}`}>
                <button onClick={() => { switchCarnet(c.id); close() }} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left text-ink">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-ink" style={{ background: color(c.id) }}>{c.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{c.name}</span>
                    <span className="block text-xs text-ink-muted">{c.id === principalId ? 'Mon carnet principal' : c.role === 'proprietaire' ? 'Créé par toi' : 'Carnet partagé avec moi'} · {c.members} pers.</span>
                  </span>
                  {c.id === carnet?.id && <Check size={20} className="shrink-0" />}
                </button>
                {canDelete && (
                  <button onClick={() => { setErr(''); setTyped(''); setTarget(c) }} aria-label={c.role === 'proprietaire' ? `Supprimer le carnet ${c.name}` : `Quitter le carnet ${c.name}`}
                    className="shrink-0 rounded-full p-2.5 text-red-500 hover:bg-red-50">{c.role === 'proprietaire' ? <Trash2 size={18} /> : <LogOut size={18} />}</button>
                )}
              </div>
            )
          })}
          <p className="pt-2 text-center text-xs text-ink-muted">🗑 supprimer un carnet que tu as créé · ⇥ quitter un carnet partagé</p>
        </div>
      )}
    </Sheet>
  )
}

/** Bouton compact « carnet ouvert » : visible seulement s'il y a plusieurs carnets. */
export function CarnetSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' | 'chip' }) {
  const { carnets, carnet, principalId } = useData()
  const [open, setOpen] = useState(false)
  const color = useCarnetColor()
  if (carnets.length < 2 || !carnet) return null
  const other = carnet.id !== principalId
  return (
    <>
      {variant === 'chip' ? (
        <button onClick={() => setOpen(true)} className="flex max-w-full items-center gap-1.5 rounded-full border border-cream-line bg-white/85 py-1 pl-1 pr-3 text-xs text-ink">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color(carnet.id) }} />
          <span className="truncate">{other ? `Carnet : ${carnet.name}` : carnet.name}</span>
          <ChevronDown size={14} className="shrink-0" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${variant === 'dark' ? 'bg-white/5 text-white hover:bg-white/10' : 'border border-cream-line bg-cream-tile'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink" style={{ background: color(carnet.id) }}><BookOpen size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className={`block text-xs ${variant === 'dark' ? 'text-neutral-400' : 'text-ink-muted'}`}>Carnet ouvert</span>
            <span className="block truncate text-sm font-medium">{carnet.name}</span>
          </span>
          <ChevronDown size={18} className="shrink-0 opacity-60" />
        </button>
      )}
      <CarnetSwitchSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
