import { useEffect, useRef } from 'react'

/**
 * Pile des « retours » : chaque fenêtre ou vue ouverte s'y inscrit.
 * Le bouton retour du téléphone ferme d'abord la dernière ouverte.
 */
const stack: { id: number; run: () => void }[] = []
let seq = 0

export function useBackHandler(active: boolean, fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    const id = ++seq
    stack.push({ id, run: () => ref.current() })
    return () => { const i = stack.findIndex((x) => x.id === id); if (i >= 0) stack.splice(i, 1) }
  }, [active])
}

/** Exécute le retour le plus récent. Renvoie false s'il n'y en a aucun. */
export function runBack(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.run()
  return true
}
