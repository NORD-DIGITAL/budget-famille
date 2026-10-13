import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { supabase } from './supabase'
import { compressImage } from './attachments'

/** Pièces jointes des projets PRO (bucket privé « pro-pieces », chemins <projet>/<dossier>/<fichier>). */
const BUCKET = 'pro-pieces'
const MAX = 10 * 1024 * 1024
export const PIECE_ACCEPT = 'image/*,application/pdf'

export type Piece = { path: string; nom: string; type: string }

/** Envoie une photo (réduite à ~150 Ko) ou un PDF (10 Mo max). Renvoie la pièce ou un message d'erreur. */
export async function uploadPiece(projet: string, dossier: string, file: File): Promise<Piece | string> {
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!isPdf && !file.type.startsWith('image/')) return 'Choisis une photo ou un PDF.'
    const blob: Blob = isPdf ? file : await compressImage(file)
    if (blob.size > MAX) return 'Fichier trop lourd (10 Mo maximum).'
    const type = isPdf ? 'application/pdf' : blob.type
    const ext = isPdf ? 'pdf' : type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${projet}/${dossier}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (error) return /bucket|not found/i.test(error.message) ? "Les pièces jointes ne sont pas encore activées sur le serveur." : "Envoi de la pièce jointe impossible. Vérifie ta connexion."
    return { path, nom: file.name || `piece.${ext}`, type }
  } catch {
    return 'Impossible de lire ce fichier.'
  }
}

export async function pieceUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

export async function deletePiece(path: string) { await supabase.storage.from(BUCKET).remove([path]) }

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(b) })

/** Télécharge la pièce : enregistrement sur le web, partage / enregistrement dans l'APK. */
export async function downloadPiece(p: Piece): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(p.path)
    if (error || !data) return 'Téléchargement impossible. Vérifie ta connexion.'
    const name = p.nom.replace(/[^\w.\- ]+/g, '_') || p.path.split('/').pop()!
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({ path: name, data: await toBase64(data), directory: Directory.Cache })
      await Share.share({ title: name, files: [res.uri] })
      return null
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(data); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    return null
  } catch (e) {
    return /cancel/i.test(e instanceof Error ? e.message : '') ? null : 'Téléchargement impossible sur cet appareil.'
  }
}
