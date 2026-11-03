import { useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Plus, TrendingUp, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useBackHandler } from '../lib/back'
import { fmt, parseAmount, todayISO } from '../lib/format'
import { INV_TYPES, invTypeLabel, openProject, projectStats, useOpenProject } from '../lib/invest'
import type { InvKind, InvMove, InvProject, InvType } from '../lib/types'
import { fmtDateLong } from '../components/DatePicker'

const KIND_LABEL: Record<InvKind, string> = { capital: 'Investissement', depense: 'Dépense du projet', revenu: 'Revenu du projet', versement: 'Versé sur un compte' }
const fmtDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/* ---------- Fiche sombre (style Business Pro) ---------- */
function BpSheet({ title, onClose, children, foot }: { title: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useBackHandler(true, onClose)
  return (
    <div className="bp-ov top" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="bp-sh-head"><h2>{title}</h2><button className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">{children}</div>
        {foot && <div className="bp-sh-foot">{foot}</div>}
      </div>
    </div>
  )
}

function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { cur } = useData()
  return (
    <label className="bp-fld">Montant ({cur})
      <input className="bp-in mono" inputMode="numeric" autoFocus placeholder={`0 ${cur}`} style={{ fontSize: 22, fontWeight: 600, textAlign: 'center' }}
        value={value} onChange={(e) => { const n = parseAmount(e.target.value); onChange(n ? n.toLocaleString('fr-FR') : '') }} />
    </label>
  )
}

function AccountChips({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const { accounts } = useData()
  return (
    <div className="bp-chips">
      {accounts.filter((a) => !a.archived).map((a) => <button key={a.id} type="button" className={`bp-chip ${value === a.id ? 'on' : ''}`} onClick={() => onChange(a.id)}>{a.name}</button>)}
    </div>
  )
}

/* ---------- Fiche projet : nom, activité, type ---------- */
function ProjectFields({ name, activite, type, autre, set }: { name: string; activite: string; type: InvType; autre: string; set: (p: Partial<{ name: string; activite: string; type: InvType; autre: string }>) => void }) {
  return (
    <>
      <label className="bp-fld">Nom du projet<input className="bp-in" value={name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Vente de poulets" /></label>
      <label className="bp-fld">Activité<input className="bp-in" value={activite} onChange={(e) => set({ activite: e.target.value })} placeholder="Ex. élevage, épicerie, transport…" /></label>
      <div className="bp-fld">Type
        <div className="bp-seg" style={{ alignSelf: 'flex-start' }}>
          {INV_TYPES.map((t) => <button key={t.k} type="button" className={type === t.k ? 'on' : ''} onClick={() => set({ type: t.k })}>{t.label}</button>)}
        </div>
      </div>
      {type === 'autre' && <label className="bp-fld">Précise le type<input className="bp-in" value={autre} onChange={(e) => set({ autre: e.target.value })} placeholder="Ex. location, prêt à un proche…" /></label>}
    </>
  )
}
const projectError = (p: { name: string; type: InvType; autre: string }) => (!p.name.trim() ? 'Indique le nom du projet.' : p.type === 'autre' && !p.autre.trim() ? 'Précise le type du projet.' : '')

/* ---------- « Investir » : projet existant ou nouveau, puis montant et compte ---------- */
export function InvestSheet({ onClose, projectId, onDone }: { onClose: () => void; projectId?: string; onDone?: (id: string) => void }) {
  const { carnet, invProjects, reload, ledgerReady } = useData()
  const open = invProjects.filter((p) => !p.archived)
  const [pick, setPick] = useState<string | 'new' | null>(projectId ?? (open.length ? null : 'new'))
  const [p, setP] = useState({ name: '', activite: '', type: 'vente' as InvType, autre: '' })
  const [amount, setAmount] = useState('')
  const [acc, setAcc] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!ledgerReady) return setErr("Les investissements ne sont pas encore activés sur le serveur. Contacte NORD DIGITAL.")
    if (!pick) return setErr('Choisis un projet, ou crée un nouveau projet.')
    if (pick === 'new') { const e = projectError(p); if (e) return setErr(e) }
    const n = parseAmount(amount)
    if (!n) return setErr('Indique le montant investi.')
    if (!acc) return setErr("Choisis le compte d'où part l'argent investi.")
    setBusy(true); setErr('')
    let pid = pick
    if (pick === 'new') {
      const { data, error } = await supabase.from('inv_projects').insert({ carnet_id: carnet!.id, name: p.name.trim(), activite: p.activite.trim(), type: p.type, type_autre: p.type === 'autre' ? p.autre.trim() : '' }).select('id').single()
      if (error || !data) { setBusy(false); return setErr('Création du projet impossible. Vérifie ta connexion.') }
      pid = data.id as string
    }
    const { error } = await supabase.from('inv_moves').insert({ carnet_id: carnet!.id, project_id: pid, kind: 'capital', amount: n, account_id: acc, moved_on: date, note: note.trim() || null })
    setBusy(false)
    if (error) return setErr('Enregistrement impossible. Vérifie ta connexion.')
    await reload(); onClose(); openProject(pid); onDone?.(pid)
  }

  return (
    <BpSheet title="Investir" onClose={onClose} foot={<><button className="bp-btn" onClick={onClose}>Annuler</button><button className="bp-btn primary" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Valider'}</button></>}>
      {!projectId && (
        <div className="bp-fld">Projet
          <div className="bp-chips">
            {open.map((x) => <button key={x.id} type="button" className={`bp-chip ${pick === x.id ? 'on' : ''}`} onClick={() => setPick(x.id)}>{x.name}</button>)}
            <button type="button" className={`bp-chip ${pick === 'new' ? 'on' : ''}`} onClick={() => setPick('new')}><Plus size={14} /> Nouveau projet</button>
          </div>
        </div>
      )}
      {pick === 'new' && <ProjectFields {...p} set={(x) => setP({ ...p, ...x })} />}
      <AmountField value={amount} onChange={setAmount} />
      <div className="bp-fld">Compte d'où part l'argent <AccountChips value={acc} onChange={setAcc} /></div>
      <label className="bp-fld">Date<input className="bp-in" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} /></label>
      <label className="bp-fld">Note<input className="bp-in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <p className="bp-hint">L'argent investi est retiré du compte choisi (le solde baisse). Il apparaît dans le Journal et dans le projet.</p>
      {err && <p className="bp-err">{err}</p>}
    </BpSheet>
  )
}

/* ---------- Liste des projets (dans le hub Business Pro) ---------- */
export function InvestPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const { invProjects, invMoves, cur } = useData()
  const [inv, setInv] = useState(false)
  const list = invProjects.filter((p) => !p.archived)
  return (
    <section className="bp-panel" style={{ marginTop: 14 }}>
      <div className="bp-row">
        <h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} /> Mes investissements</h2>
        <button className="bp-btn primary sm" onClick={() => setInv(true)}><Plus size={16} /> Investir</button>
      </div>
      {list.length === 0 && <p className="bp-empty">Aucun projet. Touche « Investir » pour créer ton premier projet (vente, partenariat…).</p>}
      <div className="bp-list">
        {list.map((p) => {
          const s = projectStats(invMoves, p.id)
          return (
            <button key={p.id} className="bp-item" onClick={() => onOpen(p.id)}>
              <span className="n">{p.name}</span><span className="t">{fmt(s.dispo, cur)}</span>
              <span className="s">{invTypeLabel(p.type, p.type_autre)}{p.activite ? ` · ${p.activite}` : ''} · capital {fmt(s.capital, cur)}</span>
            </button>
          )
        })}
      </div>
      {inv && <InvestSheet onClose={() => setInv(false)} />}
    </section>
  )
}

/* ---------- Page d'un projet : Capital, Dépenses, Revenus en haut ---------- */
export function InvProjectPage({ onBack }: { onBack: () => void }) {
  const id = useOpenProject()
  const { invProjects, invMoves, accById, cur } = useData()
  const p = invProjects.find((x) => x.id === id)
  const moves = useMemo(() => invMoves.filter((m) => m.project_id === id), [invMoves, id])
  const s = projectStats(invMoves, id ?? '')
  const [add, setAdd] = useState<InvKind | null>(null)
  const [edit, setEdit] = useState(false)
  const [detail, setDetail] = useState<InvMove | null>(null)

  if (!p) return (
    <div className="bp">
      <header className="bp-top pt-safe"><button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button><h1>Projet</h1></header>
      <p className="bp-empty">Projet introuvable.</p>
    </div>
  )
  return (
    <div className="bp">
      <header className="bp-top pt-safe">
        <button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button>
        <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h1>
        <button className="bp-iconbtn" aria-label="Modifier le projet" onClick={() => setEdit(true)}><Pencil size={20} /></button>
      </header>
      <p className="bp-hint" style={{ marginTop: 0 }}>{invTypeLabel(p.type, p.type_autre)}{p.activite ? ` · ${p.activite}` : ''}</p>
      <div className="bp-stats">
        <div className="bp-stat"><div className="l">Capital</div><div className="v">{fmt(s.capital, cur)}</div></div>
        <div className="bp-stat"><div className="l">Dépenses</div><div className="v buy">{fmt(s.depenses, cur)}</div></div>
        <div className="bp-stat"><div className="l">Revenus</div><div className="v sell">{fmt(s.revenus, cur)}</div></div>
      </div>
      <section className="bp-panel" style={{ marginTop: 12 }}>
        <div className="bp-two">
          <div><div className="bp-label">Disponible dans le projet</div><div className={`bp-bignum ${s.dispo < 0 ? 'neg' : ''}`}>{fmt(s.dispo, cur)}</div></div>
          <div><div className="bp-label">Résultat (revenus − dépenses)</div><div className="bp-bignum" style={{ color: s.resultat < 0 ? 'var(--danger)' : 'var(--sell)' }}>{fmt(s.resultat, cur)}</div></div>
        </div>
        {s.verse > 0 && <p className="bp-hint">Déjà versé sur tes comptes : {fmt(s.verse, cur)}</p>}
        <div className="bp-two" style={{ marginTop: 12 }}>
          <button className="bp-btn buy" onClick={() => setAdd('depense')}><Plus size={16} /> Dépense</button>
          <button className="bp-btn sell" onClick={() => setAdd('revenu')}><Plus size={16} /> Revenu</button>
          <button className="bp-btn primary" onClick={() => setAdd('capital')}><TrendingUp size={16} /> Investir</button>
          <button className="bp-btn" onClick={() => setAdd('versement')}>Verser sur un compte</button>
        </div>
      </section>

      <section className="bp-panel" style={{ marginTop: 12 }}>
        <div className="bp-row"><h2 style={{ fontSize: 18 }}>Historique</h2><span className="bp-hint" style={{ margin: 0 }}>{moves.length} mouvement{moves.length > 1 ? 's' : ''}</span></div>
        {moves.length === 0 && <p className="bp-empty">Aucun mouvement.</p>}
        <div className="bp-txs">
          {moves.map((m) => (
            <button key={m.id} className="bp-tx" onClick={() => setDetail(m)}>
              <span className="a"><span>{KIND_LABEL[m.kind]}</span></span>
              <span className={`m ${m.kind === 'depense' || m.kind === 'versement' ? 'achat' : 'vente'}`}>{m.kind === 'depense' || m.kind === 'versement' ? '−' : '+'}{fmt(m.amount, cur)}</span>
              <span className="d">{fmtDay(m.moved_on)}{m.account_id ? ` · ${accById.get(m.account_id)?.name ?? ''}` : ''}{m.note ? ` · ${m.note}` : ''}</span>
            </button>
          ))}
        </div>
      </section>
      <p className="bp-foot">BY <b>NORD DIGITAL</b></p>

      {add === 'capital' && <InvestSheet projectId={p.id} onClose={() => setAdd(null)} />}
      {add && add !== 'capital' && <MoveSheet project={p} kind={add} dispo={s.dispo} onClose={() => setAdd(null)} />}
      {edit && <EditProjectSheet project={p} onClose={() => setEdit(false)} onDeleted={onBack} />}
      {detail && <MoveDetail m={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* Dépense, revenu, ou versement vers un compte */
function MoveSheet({ project, kind, dispo, onClose }: { project: InvProject; kind: Exclude<InvKind, 'capital'>; dispo: number; onClose: () => void }) {
  const { carnet, reload, cur } = useData()
  const [amount, setAmount] = useState(kind === 'versement' && dispo > 0 ? dispo.toLocaleString('fr-FR') : '')
  const [acc, setAcc] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const n = parseAmount(amount)
    if (!n) return setErr('Indique le montant.')
    if (kind === 'versement' && !acc) return setErr('Choisis le compte qui reçoit l\'argent.')
    if (kind === 'versement' && n > dispo) return setErr(`Le projet n'a que ${fmt(Math.max(0, dispo), cur)} disponible.`)
    setBusy(true); setErr('')
    const { error } = await supabase.from('inv_moves').insert({ carnet_id: carnet!.id, project_id: project.id, kind, amount: n, account_id: kind === 'versement' ? acc : null, moved_on: date, note: note.trim() || null })
    setBusy(false)
    if (error) return setErr('Enregistrement impossible. Vérifie ta connexion.')
    await reload(); onClose()
  }
  const title = kind === 'depense' ? 'Nouvelle dépense du projet' : kind === 'revenu' ? 'Nouveau revenu du projet' : 'Verser sur un compte'
  return (
    <BpSheet title={title} onClose={onClose} foot={<><button className="bp-btn" onClick={onClose}>Annuler</button><button className="bp-btn primary" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : 'Valider'}</button></>}>
      <AmountField value={amount} onChange={setAmount} />
      {kind === 'versement' && <div className="bp-fld">Compte qui reçoit l'argent <AccountChips value={acc} onChange={setAcc} /></div>}
      <label className="bp-fld">Date<input className="bp-in" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} /></label>
      <label className="bp-fld">Note<input className="bp-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'depense' ? 'Ex. achat de marchandise' : kind === 'revenu' ? 'Ex. vente du jour' : ''} /></label>
      <p className="bp-hint">{kind === 'versement' ? `Disponible : ${fmt(Math.max(0, dispo), cur)}. Le compte choisi augmente (visible dans le Journal).` : "Reste dans le projet : le solde de tes comptes ne bouge pas. Visible dans le projet et dans le Journal."}</p>
      {err && <p className="bp-err">{err}</p>}
    </BpSheet>
  )
}

function MoveDetail({ m, onClose }: { m: InvMove; onClose: () => void }) {
  const { accById, cur, reload } = useData()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    if (!armed) return setArmed(true)
    setBusy(true)
    await supabase.from('inv_moves').delete().eq('id', m.id)
    setBusy(false); await reload(); onClose()
  }
  return (
    <BpSheet title={KIND_LABEL[m.kind]} onClose={onClose} foot={<button className={`bp-btn danger ${armed ? 'armed' : ''}`} disabled={busy} onClick={remove}>{armed ? 'Confirmer la suppression' : 'Supprimer'}</button>}>
      <div className="bp-bignum">{fmt(m.amount, cur)}</div>
      <p className="bp-hint">{fmtDateLong(m.moved_on)}</p>
      {m.account_id && <p className="bp-hint">Compte : {accById.get(m.account_id)?.name}</p>}
      {m.note && <p className="bp-hint">Note : {m.note}</p>}
    </BpSheet>
  )
}

function EditProjectSheet({ project, onClose, onDeleted }: { project: InvProject; onClose: () => void; onDeleted: () => void }) {
  const { reload, invMoves } = useData()
  const [p, setP] = useState({ name: project.name, activite: project.activite, type: project.type, autre: project.type_autre })
  const [err, setErr] = useState('')
  const [armed, setArmed] = useState(false)
  const count = invMoves.filter((m) => m.project_id === project.id).length
  const save = async () => {
    const e = projectError(p); if (e) return setErr(e)
    const { error } = await supabase.from('inv_projects').update({ name: p.name.trim(), activite: p.activite.trim(), type: p.type, type_autre: p.type === 'autre' ? p.autre.trim() : '' }).eq('id', project.id)
    if (error) return setErr('Enregistrement impossible.')
    await reload(); onClose()
  }
  const archive = async () => {
    if (!armed) return setArmed(true)
    // Avec des mouvements : on archive (l'historique reste dans le Journal) ; sans mouvement : on supprime
    if (count) await supabase.from('inv_projects').update({ archived: true }).eq('id', project.id)
    else await supabase.from('inv_projects').delete().eq('id', project.id)
    await reload(); onClose(); onDeleted()
  }
  return (
    <BpSheet title="Modifier le projet" onClose={onClose} foot={<>
      <button className={`bp-btn danger ${armed ? 'armed' : ''}`} onClick={archive}>{armed ? 'Confirmer' : count ? 'Clôturer le projet' : 'Supprimer'}</button>
      <button className="bp-btn primary" onClick={save}>Enregistrer</button></>}>
      <ProjectFields {...p} set={(x) => setP({ ...p, ...x })} />
      {count > 0 && <p className="bp-hint">Clôturer : le projet disparaît de la liste, son historique reste dans le Journal.</p>}
      {err && <p className="bp-err">{err}</p>}
    </BpSheet>
  )
}

