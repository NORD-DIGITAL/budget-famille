import { useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { fmt, parseAmount, todayISO } from '../lib/format'
import { DateField } from './DatePicker'
import { AccountPicker, isMobileMoneyAccount, RefField } from './Money'
import { Sheet } from './ui'

/* Ouverture de la fiche « Ajouter de l'argent » depuis n'importe quel écran */
let target: string | null = null
const subs = new Set<() => void>()
export const openAddMoney = (accountId: string) => { target = accountId; subs.forEach((f) => f()) }
const close = () => { target = null; subs.forEach((f) => f()) }
const useTarget = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => target)

const REVENU = 'revenu'

/**
 * « Ajouter » sur un compte : la provenance est obligatoire.
 *  - un autre compte → transfert (le compte d'origine diminue, les deux historiques montrent le mouvement) ;
 *  - « Revenu » → une opération de revenu sur ce compte (catégorie à choisir).
 */
export function AddMoneyHost() {
  const acc = useTarget()
  return acc ? <AddMoneySheet key={acc} accountId={acc} /> : null
}

function AddMoneySheet({ accountId }: { accountId: string }) {
  const { carnet, accounts, accById, categories, childrenOf, cur, reload, ledgerReady } = useData()
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const acc = accById.get(accountId)
  const revRoots = (childrenOf.get(null) ?? []).filter((c) => c.kind === 'revenu' && !c.archived)
  const revCats = revRoots.flatMap((r) => [r, ...(childrenOf.get(r.id) ?? []).filter((c) => !c.archived)])
  const fromName = from && from !== REVENU ? accById.get(from)?.name : undefined

  const save = async () => {
    const n = parseAmount(amount)
    if (!n) return setErr('Indique un montant.')
    if (!from) return setErr(`Choisis la provenance de cet argent : un autre compte (Banque, MVola, Orange Money…) ou « Revenu ».`)
    if (from === REVENU && !catId) return setErr('Choisis le type de revenu.')
    setBusy(true); setErr('')
    const r = ref.trim() ? ref.trim().toUpperCase() : null
    const { error } = from === REVENU
      ? await supabase.from('transactions').insert({ carnet_id: carnet!.id, kind: 'revenu', amount: n, category_id: catId, account_id: accountId, occurred_on: date, note: note.trim() || null, ref: r })
      : await supabase.from('account_transfers').insert({ carnet_id: carnet!.id, from_account: from, to_account: accountId, amount: n, moved_on: date, ref: r, note: note.trim() || null })
    setBusy(false)
    if (error) return setErr(!ledgerReady && from !== REVENU ? "Les transferts ne sont pas encore activés sur le serveur. Contacte NORD DIGITAL." : "Enregistrement impossible. Vérifie ta connexion.")
    await reload(); close()
  }

  return (
    <Sheet open onClose={close} title={`Ajouter sur ${acc?.name ?? 'le compte'}`}>
      <div className="space-y-4">
        <input className="input tabular text-center text-2xl font-bold" inputMode="numeric" autoFocus placeholder={`0 ${cur}`} aria-label="Montant"
          value={amount} onChange={(e) => { const v = parseAmount(e.target.value); setAmount(v ? v.toLocaleString('fr-FR') : '') }} />
        <div>
          <p className="label">Provenance <span className="text-red-500">*</span></p>
          <AccountPicker accounts={accounts} value={from} exclude={accountId} extra={[[REVENU, 'Revenu']]} onChange={(v) => { setFrom(v); setErr('') }} />
          {fromName && <p className="mt-1.5 text-xs text-ink-muted">{fmt(parseAmount(amount), cur)} sera retiré de {fromName} et ajouté à {acc?.name}.</p>}
        </div>
        {from === REVENU && (
          <div>
            <p className="label">Type de revenu</p>
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
              {revCats.map((c) => (
                <button key={c.id} type="button" onClick={() => setCatId(c.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${catId === c.id ? 'border-ink bg-ink text-white' : 'border-cream-line bg-cream-tile'}`}>{c.name}</button>
              ))}
              {revCats.length === 0 && categories.length > 0 && <p className="text-sm text-ink-muted">Aucune catégorie de revenu.</p>}
            </div>
          </div>
        )}
        <div><p className="label">Date</p><DateField value={date} onChange={setDate} /></div>
        {(isMobileMoneyAccount(fromName) || isMobileMoneyAccount(acc?.name)) && <RefField id="am-ref" value={ref} onChange={setRef} />}
        <div><label className="label" htmlFor="am-note">Note</label><input id="am-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={busy} className="btn-primary w-full">{busy ? 'Enregistrement…' : 'Valider'}</button>
      </div>
    </Sheet>
  )
}
