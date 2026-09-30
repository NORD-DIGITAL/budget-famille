import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Enregistre / partage un fichier texte : téléchargement sur le web, partage (WhatsApp, Drive, e-mail…) dans l'APK. */
export async function saveTextFile(name: string, content: string, mime: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: name, files: [res.uri] })
      return null
    }
    const blob = new Blob([content], { type: mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    return null
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    return /cancel/i.test(m) ? null : "Impossible d'enregistrer le fichier sur cet appareil."
  }
}

export const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const toCsv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\n')
export const stamp = () => new Date().toISOString().slice(0, 10)
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'carnet'
