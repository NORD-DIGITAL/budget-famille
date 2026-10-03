import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { useData } from '../lib/data'
import { fmt, parseAmount } from '../lib/format'
import { deletePhoto, listPhotos, uploadPhoto } from '../lib/attachments'
import type { Photo } from '../lib/attachments'
import { Sheet } from './ui'
import { DateField, fmtDateLong } from './DatePicker'
import { isMobileMoney, MethodPicker, methodLabel, PhotoStrip, RefField } from './Money'

export type HRow = { id: string; amount: number; date: string; method: string | null; ref: string | null; note: string | null }
export type HPatch = { amount: number; date: string; method: string | null; ref: string | null; note: string | null }

/**
 * Historique des mouvements (remboursements d'une dette, versements/retraits d'une épargne).
 * Chaque ligne ouvre sa propre fiche : détail, photos du mouvement, Modifier, Supprimer.
 */
export function MoveHistory({ carnetId, entity, entityId, rows, title, labels, onDelete, onUpdate }: {
  carnetId: string; entity: 'goal' | 'debt'; entityId: string; rows: HRow[]; title: string
  labels: { plus: string; minus: string }
  onDelete: (r: HRow) => Promise<void>; onUpdate: (r: HRow, p: HPatch) => Promise<string | null>
}) {
  const { cur } = useData()
  const [sel, setSel] = useState<HRow | null>(null)
  const [refresh, setRefresh] = useState(0)
  const live = sel ? rows.find((r) => r.id === sel.id) ?? sel : null
  const total = rows.reduce((a, r) => a + r.amount, 0)
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-baseline justify-between"><p className="font-semibold">{title}</p><p className="text-xs text-ink-muted">{rows.length} mouvement{rows.length > 1 ? 's' : ''}{rows.length ? ` · ${fmt(Math.abs(total), cur)}` : ''}</p></div>
        {rows.length === 0 && <p className="text-sm text-ink-muted">Aucun mouvement enregistré pour l'instant.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => setSel(r)} className="flex w-full items-center gap-3 border-b border-neutral-100 py-2.5 text-left last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{fmtDateLong(r.date)}</p>
              <p className="truncate text-xs text-ink-muted">{[r.amount < 0 ? labels.minus : labels.plus, methodLabel(r.method), r.ref ? `Réf. ${r.ref}` : null, r.note].filter(Boolean).join(' · ')}</p>
            </div>
            <span className={`tabular text-sm font-semibold ${r.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{r.amount < 0 ? '−' : '+'}{fmt(Math.abs(r.amount), cur)}</span>
            <ChevronRight size={16} className="shrink-0 text-neutral-400" />
          </button>
        ))}
      </div>
      <PhotoStrip carnetId={carnetId} entity={entity} entityId={entityId} refreshKey={rows.length + refresh} />
      <MoveSheet row={live} carnetId={carnetId} entity={entity} entityId={entityId} labels={labels}
        onClose={() => { setSel(null); setRefresh((x) => x + 1) }} onDelete={onDelete} onUpdate={onUpdate} />
    </div>
  )
}

function MoveSheet({ row, carnetId, entity, entityId, labels, onClose, onDelete, onUpdate }: {
  row: HRow | null; carnetId: string; entity: 'goal' | 'debt'; entityId: string; labels: { plus: string; minus: string }
  onClose: () => void; onDelete: (r: HRow) => Promise<void>; onUpdate: (r: HRow, p: HPatch) => Promise<string | null>
}) {
  const { cur } = useData()
  const [edit, setEdit] = useState<{ amount: string; date: string; method: string; ref: string; note: string } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [view, setView] = useState<Photo | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => { if (row) setPhotos((await listPhotos(entityId)).filter((p) => p.move_id === row.id)) }, [row, entityId])
  useEffect(() => { setEdit(null); setConfirm(false); setErr(''); setPhotos([]); load() }, [row?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setEdit(null); setConfirm(false); onClose() }

  const save = async () => {
    if (!row || !edit) return
    const n = parseAmount(edit.amount)
    if (!n) return setErr('Indique un montant.')
    setBusy(true); setErr('')
    const e = await onUpdate(row, { amount: (row.amount < 0 ? -1 : 1) * n, date: edit.date, method: edit.method, ref: isMobileMoney(edit.method) && edit.ref.trim() ? edit.ref.trim().toUpperCase() : null, note: edit.note.trim() || null })
    setBusy(false)
    if (e) return setErr(e)
    setEdit(null)
  }
  const remove = async () => {
    if (!row) return
    if (!confirm) return setConfirm(true)
    setBusy(true)
    for (const p of photos) await deletePhoto(p)
    await onDelete(row); setBusy(false); close()
  }
  const add = async (files: FileList | null) => {
    if (!files?.length || !row) return
    setBusy(true); setErr('')
    for (const f of Array.from(files).slice(0, 5)) { const e = await uploadPhoto(carnetId, entity, entityId, f, row.id); if (e) { setErr(e); break } }
    setBusy(false); load()
  }
  const minus = (row?.amount ?? 0) < 0

  return (
    <Sheet open={!!row} onClose={close} title={edit ? 'Modifier le mouvement' : 'Détail du mouvement'}>
      {row && !edit && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1 rounded-3xl bg-cream-tile p-5 text-center">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${minus ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>{minus ? labels.minus : labels.plus}</span>
            <p className={`tabular text-3xl font-bold ${minus ? 'text-red-600' : 'text-emerald-600'}`}>{minus ? '−' : '+'}{fmt(Math.abs(row.amount), cur)}</p>
          </div>
          <div className="text-sm">
            {([['Date', fmtDateLong(row.date)], ['Moyen', methodLabel(row.method)], ['Référence', row.ref], ['Note', row.note]] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-neutral-100 py-2.5 last:border-0"><span className="text-ink-muted">{k}</span><span className="text-right font-medium">{v}</span></div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Photos de ce mouvement</p>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => <button key={p.id} onClick={() => setView(p)} className="aspect-square overflow-hidden rounded-xl bg-neutral-100">{p.url && <img src={p.url} alt="Pièce jointe" className="h-full w-full object-cover" />}</button>)}
              <button disabled={busy} onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/30 text-xs text-ink-muted"><Camera size={20} />{busy ? '…' : 'Ajouter'}</button>
            </div>
          </div>
          {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setErr(''); setEdit({ amount: Math.abs(row.amount).toLocaleString('fr-FR'), date: row.date, method: row.method ?? 'especes', ref: row.ref ?? '', note: row.note ?? '' }) }} className="btn-ghost flex-1 py-2.5 text-sm"><Pencil size={16} /> Modifier</button>
            <button onClick={remove} disabled={busy} className={`btn flex-1 py-2.5 text-sm ${confirm ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><Trash2 size={16} />{confirm ? 'Confirmer la suppression' : 'Supprimer'}</button>
          </div>
        </div>
      )}
      {row && edit && (
        <div className="space-y-4">
          <input className="input tabular text-center text-2xl font-semibold" inputMode="numeric" aria-label="Montant" value={edit.amount} onChange={(e) => { const n = parseAmount(e.target.value); setEdit({ ...edit, amount: n ? n.toLocaleString('fr-FR') : '' }) }} />
          <div><p className="label">Date</p><DateField value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} /></div>
          <div><p className="label">Moyen</p><MethodPicker value={edit.method} onChange={(v) => setEdit({ ...edit, method: v })} /></div>
          {isMobileMoney(edit.method) && <RefField value={edit.ref} onChange={(v) => setEdit({ ...edit, ref: v })} />}
          <div><label className="label" htmlFor="mv-note">Note</label><input id="mv-note" className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
          {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
          <button onClick={save} disabled={busy} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button onClick={() => setEdit(null)} className="w-full py-2 text-sm text-ink-muted">Annuler</button>
        </div>
      )}
      {view && (
        <div data-sheet className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setView(null)}>
          <img src={view.url} alt="Pièce jointe" className="max-h-[75vh] max-w-full rounded-xl object-contain" />
          <button onClick={() => setView(null)} className="btn mt-4 bg-white text-ink"><X size={18} /> Fermer</button>
        </div>
      )}
    </Sheet>
  )
}
