import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Paperclip, Trash2, X } from 'lucide-react'
import { deletePhoto, listPhotos, QUOTA, storageUsed, uploadPhoto } from '../lib/attachments'
import type { Photo } from '../lib/attachments'

export const METHODS: [string, string][] = [['especes', 'Espèces'], ['mvola', 'MVola'], ['orange', 'Orange Money'], ['banque', 'Banque']]
export const methodLabel = (m: string | null) => METHODS.find(([k]) => k === m)?.[1] ?? ''
export const isMobileMoney = (m: string | null | undefined) => m === 'mvola' || m === 'orange'

const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`

export function MethodPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
      {METHODS.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} className={chip(value === k)}>{l}</button>)}
    </div>
  )
}

/** Champ facultatif « Référence de transaction » pour MVola / Orange Money. */
export function RefField({ id = 'ref', value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>Référence de transaction <span className="text-xs">(facultatif)</span></label>
      <input id={id} className="input tabular uppercase" placeholder="Ex : 2409301234.5678.A12345" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Choix de photos avant l'enregistrement (envoyées ensuite). */
export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = '' }} />
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-cream-tile px-3 py-1.5 text-xs">
            <Paperclip size={14} />{f.name.slice(0, 18)}
            <button type="button" aria-label="Retirer la photo" onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14} /></button>
          </span>
        ))}
        {files.length < 3 && (
          <button type="button" onClick={() => ref.current?.click()} className="flex items-center gap-2 rounded-full border border-dashed border-ink/30 px-4 py-2 text-sm">
            <Camera size={18} /> Ajouter une photo (reçu, capture…)
          </button>
        )}
      </div>
    </div>
  )
}

/** Galerie des photos d'une épargne ou d'une dette. */
export function PhotoStrip({ carnetId, entity, entityId, refreshKey = 0 }: { carnetId: string; entity: 'goal' | 'debt'; entityId: string; refreshKey?: number }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [used, setUsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [view, setView] = useState<Photo | null>(null)
  const [confirm, setConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => { setPhotos(await listPhotos(entityId)); setUsed(await storageUsed()) }, [entityId])
  useEffect(() => { load() }, [load, refreshKey])

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr('')
    for (const f of Array.from(files).slice(0, 5)) { const e = await uploadPhoto(carnetId, entity, entityId, f); if (e) { setErr(e); break } }
    setBusy(false); load()
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">Pièces jointes</p>
        <p className="text-xs text-ink-muted">{(used / 1024 / 1024).toFixed(1)} Mo / {QUOTA / 1024 / 1024} Mo</p>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => { setView(p); setConfirm(false) }} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
            {p.url && <img src={p.url} alt="Pièce jointe" className="h-full w-full object-cover" />}
            {p.move_id && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] text-white">mvt</span>}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/30 text-xs text-ink-muted">
          <Camera size={22} />{busy ? 'Envoi…' : 'Ajouter'}
        </button>
      </div>
      {err && <p className="mt-2 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-xs text-ink-muted">Les photos sont réduites automatiquement (~150 Ko) et visibles seulement par les personnes du carnet.</p>

      {view && (
        <div data-sheet className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setView(null)}>
          <img src={view.url} alt="Pièce jointe" className="max-h-[75vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button onClick={async () => { if (!confirm) return setConfirm(true); await deletePhoto(view); setView(null); load() }}
              className={`btn ${confirm ? 'bg-red-500 text-white' : 'bg-white/10 text-white'}`}><Trash2 size={18} />{confirm ? 'Confirmer la suppression' : 'Supprimer'}</button>
            <button onClick={() => setView(null)} className="btn bg-white text-ink"><X size={18} /> Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}
