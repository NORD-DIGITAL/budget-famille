import { supabase } from './supabase'

export const QUOTA = 200 * 1024 * 1024 // 200 Mo par compte
const TARGET = 150 * 1024 // ~150 Ko par photo

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q))

/** Réduit une photo à ~150 Ko (WebP, sinon JPEG) en gardant le texte lisible. */
export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  let scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  let out: Blob | null = null
  for (let round = 0; round < 6; round++) {
    canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    for (const q of [0.8, 0.65, 0.5, 0.38]) {
      out = await toBlob(canvas, 'image/webp', q)
      if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg', q)
      if (out && out.size <= TARGET) return out
    }
    scale *= 0.8
  }
  return out!
}

export async function storageUsed(): Promise<number> {
  const { data } = await supabase.rpc('my_storage_used')
  return Number(data ?? 0)
}

/** Envoie une photo liée à une épargne ou une dette (et éventuellement à un mouvement). */
export async function uploadPhoto(carnetId: string, entity: 'goal' | 'debt', entityId: string, file: File, moveId?: string | null): Promise<string | null> {
  try {
    const blob = await compressImage(file)
    if ((await storageUsed()) + blob.size > QUOTA) return 'Espace photo plein (200 Mo par compte). Supprime d\'anciennes photos.'
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${carnetId}/${entity}/${entityId}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('attachments').upload(path, blob, { contentType: blob.type, upsert: false })
    if (up.error) return up.error.message
    const { error } = await supabase.from('attachments').insert({ carnet_id: carnetId, entity, entity_id: entityId, move_id: moveId ?? null, path, size: blob.size })
    if (error) { await supabase.storage.from('attachments').remove([path]); return error.message.includes('200 Mo') ? 'Espace photo plein (200 Mo par compte).' : error.message }
    return null
  } catch { return "Impossible de lire cette image." }
}

export type Photo = { id: string; path: string; url: string; move_id: string | null; size: number }

export async function listPhotos(entityId: string): Promise<Photo[]> {
  const { data } = await supabase.from('attachments').select('id,path,move_id,size').eq('entity_id', entityId).order('created_at', { ascending: false })
  const rows = (data ?? []) as Omit<Photo, 'url'>[]
  if (!rows.length) return []
  const { data: signed } = await supabase.storage.from('attachments').createSignedUrls(rows.map((r) => r.path), 3600)
  return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? '' }))
}

export async function deletePhoto(p: { id: string; path: string }) {
  await supabase.storage.from('attachments').remove([p.path])
  await supabase.from('attachments').delete().eq('id', p.id)
}

/** Supprime toutes les photos d'une épargne ou d'une dette (avant de la supprimer). */
export async function deleteEntityPhotos(entityId: string) {
  const { data } = await supabase.from('attachments').select('id,path').eq('entity_id', entityId)
  const rows = (data ?? []) as { id: string; path: string }[]
  if (rows.length) { await supabase.storage.from('attachments').remove(rows.map((r) => r.path)); await supabase.from('attachments').delete().in('id', rows.map((r) => r.id)) }
}
