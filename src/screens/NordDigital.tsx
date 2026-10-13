import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import './business.css'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useBackHandler } from '../lib/back'
import { isMissingTable, ymd } from '../lib/travail'
import { fmtAr, fmtJour, loadPartners, partnerName, telIntl, telLocal, toNum } from '../lib/business'
import type { Contact, Partner } from '../lib/business'
import { CallSheet, Partners } from './Business'

/* ---------- Projet NORD DIGITAL : suivi des projets clients (Sam-san + Andrinirina) ---------- */

export type Statut = 'devis' | 'en_cours' | 'livre' | 'annule'
export interface NdProjet {
  id: string; client: string; tel: string; type: string; titre: string; statut: Statut
  montant: number; acompte: number; echeance: string | null; notes: string
  created_by?: string | null; created_at: string; updated_at: string
}
export const TYPES = ['Site web', 'Catalogue PDF', 'Plateforme / App', 'Vidéo promo', 'Logo / design', 'Autre']
export const STATUTS: [Statut, string][] = [['devis', 'Devis'], ['en_cours', 'En cours'], ['livre', 'Livré'], ['annule', 'Annulé']]
const statutLabel = (s: Statut) => STATUTS.find(([k]) => k === s)?.[1] ?? s
export const reste = (p: NdProjet) => (p.statut === 'annule' ? 0 : Math.max(0, p.montant - p.acompte))

export async function loadNd() {
  const { data, error } = await supabase.from('nd_projets').select('*').order('updated_at', { ascending: false }).limit(1000)
  const rows = ((data ?? []) as NdProjet[]).map((p) => ({ ...p, montant: Number(p.montant) || 0, acompte: Number(p.acompte) || 0 }))
  return { rows, missing: isMissingTable(error), error: error && !isMissingTable(error) ? error.message : '' }
}
export function ndStats(rows: NdProjet[]) {
  return { enCours: rows.filter((p) => p.statut === 'en_cours').length, devis: rows.filter((p) => p.statut === 'devis').length, reste: rows.reduce((s, p) => s + reste(p), 0) }
}

type Draft = { client: string; tel: string; type: string; titre: string; statut: Statut; montant: string; acompte: string; echeance: string; notes: string }
const toDraft = (p?: NdProjet | null): Draft => ({
  client: p?.client ?? '', tel: p?.tel ?? '', type: p?.type ?? TYPES[0], titre: p?.titre ?? '', statut: p?.statut ?? 'devis',
  montant: p?.montant ? String(p.montant) : '', acompte: p?.acompte ? String(p.acompte) : '', echeance: p?.echeance ?? '', notes: p?.notes ?? '',
})

export function NordDigitalPage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<NdProjet[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [filter, setFilter] = useState<'' | Statut>('')
  const [q, setQ] = useState('')
  const [fiche, setFiche] = useState<{ id: string | null } | null>(null)
  const [call, setCall] = useState<Contact | null>(null)
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600) }
  const ctx = useData() as ReturnType<typeof useData> | null
  const myId = ctx?.session?.user.id ?? ''
  const who = (id?: string | null) => { if (!id) return ''; if (id === myId) return 'toi'; const p = partners.find((x) => x.user_id === id); return p ? partnerName(p).split(' ')[0] : '' }

  const reload = useCallback(async () => {
    const r = await loadNd()
    if (r.missing) { setState('missing'); return }
    if (r.error) { setErrMsg(r.error); setState('error'); return }
    setRows(r.rows); setState('ready')
    setPartners(await loadPartners('nord-digital'))
  }, [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const v = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [reload])
  useBackHandler(!!fiche, () => setFiche(null))
  useBackHandler(!!call, () => setCall(null))

  const save = async (id: string | null, d: Draft) => {
    const row = { client: d.client.trim(), tel: d.tel.trim(), type: d.type, titre: d.titre.trim(), statut: d.statut, montant: toNum(d.montant), acompte: toNum(d.acompte), echeance: d.echeance || null, notes: d.notes, updated_at: new Date().toISOString() }
    const qy = id ? supabase.from('nd_projets').update(row).eq('id', id) : supabase.from('nd_projets').insert(row)
    const { data, error } = await qy.select().single()
    if (error) { flash("Impossible d'enregistrer. Vérifie ta connexion."); return null }
    const p = { ...(data as NdProjet), montant: row.montant, acompte: row.acompte }
    setRows((l) => (id ? l.map((x) => (x.id === id ? p : x)) : [p, ...l]))
    flash(id ? 'Projet enregistré' : 'Projet client ajouté')
    return p
  }
  const del = async (id: string) => {
    const { error } = await supabase.from('nd_projets').delete().eq('id', id)
    if (error) { flash('Suppression impossible. Vérifie ta connexion.'); return }
    setRows((l) => l.filter((x) => x.id !== id)); setFiche(null); flash('Projet supprimé')
  }

  const today = ymd(new Date())
  const st = ndStats(rows)
  const qq = q.trim().toLowerCase()
  const shown = rows.filter((p) => (!filter || p.statut === filter) && (!qq || `${p.client} ${p.titre} ${p.type} ${p.tel}`.toLowerCase().includes(qq)))
    .sort((a, b) => ['en_cours', 'devis', 'livre', 'annule'].indexOf(a.statut) - ['en_cours', 'devis', 'livre', 'annule'].indexOf(b.statut) || (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'))
  const ready = state === 'ready'

  return (
    <div className="bp">
      <header className="bp-top pt-safe">
        <button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button>
        <h1>Projet NORD DIGITAL</h1>
        <span className="bp-sync"><span className={`bp-dot ${ready ? 'on' : state === 'loading' ? 'busy' : 'err'}`} />{ready ? 'À jour' : state === 'loading' ? 'Chargement…' : 'Hors service'}</span>
      </header>

      {partners.length > 0 && <Partners list={partners} myId={myId} onCall={setCall} />}
      {state === 'missing' && <p className="bp-notice warn">Le Projet NORD DIGITAL n'est pas encore activé sur le serveur.</p>}
      {state === 'error' && <p className="bp-notice err">Le suivi ne se charge pas ({errMsg}). Reviens dans un instant.</p>}

      <section className="bp-panel">
        <div className="bp-stats">
          <div className="bp-stat"><div className="l">En cours</div><div className="v buy">{st.enCours}</div></div>
          <div className="bp-stat"><div className="l">Devis</div><div className="v">{st.devis}</div></div>
          <div className="bp-stat"><div className="l">Reste à encaisser</div><div className="v sell">{fmtAr(st.reste)}</div></div>
        </div>
        <button className="bp-btn primary" disabled={!ready} onClick={() => setFiche({ id: null })}>+ Nouveau projet client</button>
        <input className="bp-in" type="search" placeholder="Rechercher un client, un projet…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <div className="bp-seg" style={{ flexWrap: 'wrap' }}>
          {([['', 'Tous'], ...STATUTS] as ['' | Statut, string][]).map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <div className="bp-list">
          {!ready ? <p className="bp-empty">Chargement…</p>
            : !shown.length ? <p className="bp-empty">{rows.length ? 'Aucun projet pour ces filtres.' : 'Aucun projet client pour l\'instant. Touche « + Nouveau projet client » pour ajouter le premier.'}</p>
            : shown.map((p) => {
              const late = p.echeance && p.echeance < today && (p.statut === 'devis' || p.statut === 'en_cours')
              return (
                <button key={p.id} className="bp-item" onClick={() => setFiche({ id: p.id })}>
                  <span className="n">{p.client}{p.titre ? ` · ${p.titre}` : ''}</span>
                  <span className={`nd-st ${p.statut}`}>{statutLabel(p.statut)}</span>
                  <span className="s">
                    {p.type} · {fmtAr(p.montant)}{reste(p) > 0 ? ` · reste ${fmtAr(reste(p))}` : p.montant > 0 && p.statut !== 'annule' ? ' · payé' : ''}
                    {p.echeance ? <> · <span className={late ? 'c-neg' : ''}>pour le {fmtJour(p.echeance)}</span></> : null}
                    {who(p.created_by) ? ` · par ${who(p.created_by)}` : ''}
                  </span>
                </button>
              )
            })}
        </div>
      </section>

      <p className="bp-foot">BY <b>NORD DIGITAL</b></p>
      {toast && <div className="bp-toast" role="status">{toast}</div>}
      {fiche && <NdFiche key={fiche.id ?? 'new'} p={fiche.id ? rows.find((x) => x.id === fiche.id) ?? null : null} onClose={() => setFiche(null)} onCall={setCall}
        onSave={async (d) => { const p = await save(fiche.id, d); if (p && !fiche.id) setFiche({ id: p.id }); return !!p }} onDelete={() => fiche.id && del(fiche.id)} />}
      {call && <CallSheet c={call} onClose={() => setCall(null)} />}
    </div>
  )
}

function NdFiche({ p, onClose, onSave, onDelete, onCall }: { p: NdProjet | null; onClose: () => void; onSave: (d: Draft) => Promise<boolean>; onDelete: () => void; onCall: (c: Contact) => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(p))
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(p))
  const r = Math.max(0, toNum(d.montant) - toNum(d.acompte))
  const set = (x: Partial<Draft>) => setD({ ...d, ...x })
  return (
    <div className="bp-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="bp-sheet" role="dialog" aria-modal="true" aria-label="Projet client" onSubmit={async (e) => { e.preventDefault(); if (!d.client.trim()) return; setBusy(true); await onSave(d); setBusy(false) }}>
        <div className="bp-sh-head"><h2>{p ? 'Projet client' : 'Nouveau projet client'}</h2><button type="button" className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">
          <input className="bp-title-in" placeholder="Nom du client" value={d.client} onChange={(e) => set({ client: e.target.value })} autoFocus={!p} aria-label="Client" required />
          <div className="bp-two">
            <label className="bp-fld">Type<select className="bp-in" value={d.type} onChange={(e) => set({ type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <div className="bp-fld">Téléphone
              <div className="bp-telrow">
                <input className="bp-in mono" inputMode="tel" placeholder="034 00 000 00" value={d.tel} onChange={(e) => set({ tel: e.target.value })} aria-label="Téléphone" />
                <button className="bp-btn sm" type="button" disabled={!telIntl(d.tel)} onClick={() => onCall({ id: p?.id ?? 'new', nom: d.client, tel: d.tel, produits: [], autres: '', notes: '', created_at: '', updated_at: '' })}>Contacter</button>
              </div>
            </div>
          </div>
          <label className="bp-fld">Projet<input className="bp-in" placeholder="ex. Site vitrine + catalogue WhatsApp" value={d.titre} onChange={(e) => set({ titre: e.target.value })} /></label>
          <div className="bp-sec">
            <span className="bp-label">Statut</span>
            <div className="bp-seg" style={{ flexWrap: 'wrap' }}>{STATUTS.map(([k, l]) => <button type="button" key={k} className={d.statut === k ? 'on' : ''} onClick={() => set({ statut: k })}>{l}</button>)}</div>
          </div>
          <div className="bp-two">
            <label className="bp-fld">Montant (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.montant} onChange={(e) => set({ montant: e.target.value })} /></label>
            <label className="bp-fld">Déjà payé (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.acompte} onChange={(e) => set({ acompte: e.target.value })} /></label>
          </div>
          <p className="bp-hint">{toNum(d.montant) > 0 ? (r > 0 ? `Reste à payer : ${fmtAr(r)}` : 'Entièrement payé.') : 'Indique le montant du devis.'}</p>
          <label className="bp-fld">Échéance de livraison<input className="bp-in" type="date" value={d.echeance} onChange={(e) => set({ echeance: e.target.value })} /></label>
          <label className="bp-fld">Notes<textarea className="bp-in" placeholder="Demandes du client, accès, liens…" value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          {p && <p className="bp-hint">Créé le {fmtJour(p.created_at.slice(0, 10))}{p.tel ? ` · ${telLocal(p.tel)}` : ''}</p>}
        </div>
        <div className="bp-sh-foot">
          {p ? <button type="button" className={`bp-btn danger sm${armed ? ' armed' : ''}`} onClick={() => { if (armed) onDelete(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000) } }}>{armed ? 'Confirmer la suppression' : 'Supprimer'}</button> : <span />}
          <button type="submit" className="bp-btn primary" disabled={busy || !dirty || !d.client.trim()}>{busy ? 'Enregistrement…' : p ? (dirty ? 'Enregistrer' : 'Enregistré') : 'Ajouter'}</button>
        </div>
      </form>
    </div>
  )
}
