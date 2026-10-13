import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Download, Eye, FileText, Mail, Paperclip, Plus, Rocket, Trash2, X } from 'lucide-react'
import './business.css'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useBackHandler } from '../lib/back'
import { isMissingTable } from '../lib/travail'
import { fmtAr, fmtJour, loadPartners, partnerName, telIntl, toNum } from '../lib/business'
import type { Contact, Partner } from '../lib/business'
import { CallSheet, Partners } from './Business'
import { PaymentFields } from './PaymentFields'
import { cleanPay, emptyPay, payError, payLabel as moyenLabel } from '../lib/paiement'
import type { PayDetails } from '../lib/paiement'
import { PIECE_ACCEPT, deletePiece, downloadPiece, pieceUrl, uploadPiece } from '../lib/pieces'

/* ---------- Projet NORD DIGITAL : Clients, Prospects, Idées (Sam-san + Andrinirina) ---------- */

type Pay = 'abonnement' | 'cash'
type TypeClient = 'GP' | 'PRO'
export interface NdClient {
  id: string; nom: string; email: string; tel: string; activite: string; type_client: TypeClient
  hebergement: 'nord-digital' | 'autre'; hebergement_autre: string; domaine: string
  date_conception: string | null; date_deploiement: string | null; premier_paiement: string | null; premier_paiement_montant: number
  type_paiement: Pay; mensualite: number; abo_statut: 'paye' | 'impaye'
  cash_mode: 'nette' | 'echelonne'; montant_total: number; deja_paye: number; cash_statut: 'paye' | 'en_attente'
  statut: 'en_cours' | 'termine' | 'vendu'; notes: string
  created_by?: string | null; created_at: string; updated_at: string
}
export interface NdProspect {
  id: string; nom: string; email: string; tel: string; activite: string; type_client: TypeClient; date_conception: string | null
  idee: string; type_paiement: Pay; taches: { t: string; ok: boolean }[]; statut: 'en_cours' | 'annule'
  created_by?: string | null; created_at: string; updated_at: string
}
export interface NdIdee {
  id: string; secteur: string; solution: string; type_client: TypeClient | 'GP et PRO'; type_paiement: Pay; note: string
  created_by?: string | null; created_at: string; updated_at: string
}

export interface NdPaiement extends PayDetails {
  id: string; client_id: string; jour: string; montant: number; mois: string | null; note: string
  piece_path: string | null; piece_nom: string | null; piece_type: string | null
  created_by?: string | null; created_at: string
}

export const SECTEURS = ['Commerce / boutique', 'Restauration', 'Santé (pharmacie, cabinet)', 'Garage / auto', 'Immobilier', 'Éducation / école', 'Beauté / bien-être', 'Agriculture / légumes', 'Artisans / services', 'Transport / livraison', 'Événementiel', 'Association / ONG', 'Autre']
export const SOLUTIONS = ['Site vitrine', 'Catalogue PDF + WhatsApp', 'Boutique en ligne', 'Plateforme de gestion (caisse, stock…)', 'App mobile', 'Prise de rendez-vous', 'Vidéo promo', 'Autre']
const CLIENT_STATUTS: [NdClient['statut'], string][] = [['en_cours', 'En cours'], ['termine', 'Terminé'], ['vendu', 'Vendu']]

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const moisLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '') }

/** Abonnement : mois sans paiement depuis le début de l'abonnement (déploiement, 1er paiement ou création) jusqu'au mois en cours. */
export function moisImpayes(c: NdClient, pays: NdPaiement[]): string[] {
  if (c.type_paiement !== 'abonnement' || c.statut !== 'en_cours') return []
  const start = (c.date_deploiement ?? c.premier_paiement ?? c.created_at).slice(0, 7)
  const paid = new Set(pays.map((p) => p.mois ?? p.jour.slice(0, 7)))
  const out: string[] = []
  const d = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1), end = ym(new Date())
  for (let i = 0; i < 120 && ym(d) <= end; i++) { if (!paid.has(ym(d))) out.push(ym(d)); d.setMonth(d.getMonth() + 1) }
  return out
}

/** Ce qu'un client doit encore : calculé depuis l'historique des paiements quand il existe, sinon depuis la fiche. */
export function resteClient(c: NdClient, pays: NdPaiement[] = []) {
  if (c.type_paiement === 'abonnement') {
    if (pays.length) return moisImpayes(c, pays).length * c.mensualite
    return c.abo_statut === 'impaye' ? c.mensualite : 0
  }
  if (pays.length) return Math.max(0, c.montant_total - pays.reduce((s, p) => s + p.montant, 0))
  if (c.cash_statut === 'paye') return 0
  return c.cash_mode === 'echelonne' ? Math.max(0, c.montant_total - c.deja_paye) : c.montant_total
}
const payLabel = (c: NdClient, pays: NdPaiement[]) => {
  const r = resteClient(c, pays)
  if (c.type_paiement === 'abonnement') {
    const imp = pays.length ? moisImpayes(c, pays) : []
    return `Abonnement ${fmtAr(c.mensualite)}/mois · ${pays.length ? (imp.length ? `${imp.length} mois impayé${imp.length > 1 ? 's' : ''}` : 'à jour') : c.abo_statut === 'paye' ? 'payé' : 'pas encore payé'}`
  }
  return `Cash ${c.cash_mode === 'echelonne' ? 'échelonné' : 'net'} · ${r > 0 ? `reste ${fmtAr(r)}` : 'payé'}`
}

export async function loadNd() {
  const num = (c: NdClient) => ({ ...c, mensualite: Number(c.mensualite) || 0, montant_total: Number(c.montant_total) || 0, deja_paye: Number(c.deja_paye) || 0, premier_paiement_montant: Number(c.premier_paiement_montant) || 0 })
  const [c, p, i, pa] = await Promise.all([
    supabase.from('nd_clients').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('nd_prospects').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('nd_idees').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('nd_paiements').select('*').order('jour', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
  ])
  const err = c.error ?? p.error ?? i.error
  return {
    clients: ((c.data ?? []) as NdClient[]).map(num), prospects: (p.data ?? []) as NdProspect[], idees: (i.data ?? []) as NdIdee[],
    paiements: ((pa.error ? [] : pa.data ?? []) as NdPaiement[]).map((x) => ({ ...x, montant: Number(x.montant) || 0 })),
    paiementsActifs: !pa.error,
    missing: isMissingTable(err), error: err && !isMissingTable(err) ? err.message : '',
  }
}
export function ndStats(clients: NdClient[], prospects: NdProspect[], pays: NdPaiement[] = []) {
  const m = ym(new Date())
  return {
    clientsEnCours: clients.filter((c) => c.statut === 'en_cours').length,
    prospects: prospects.filter((p) => p.statut === 'en_cours').length,
    reste: clients.reduce((s, c) => s + resteClient(c, pays.filter((p) => p.client_id === c.id)), 0),
    encaisseMois: pays.filter((p) => p.jour.startsWith(m)).reduce((s, p) => s + p.montant, 0),
  }
}

type Tab = 'clients' | 'prospects' | 'idees'
type Fiche = { kind: 'client' | 'prospect' | 'idee'; id: string | null }
const TABLE = { client: 'nd_clients', prospect: 'nd_prospects', idee: 'nd_idees' } as const

export function NordDigitalPage({ onBack }: { onBack: () => void }) {
  const [clients, setClients] = useState<NdClient[]>([])
  const [prospects, setProspects] = useState<NdProspect[]>([])
  const [idees, setIdees] = useState<NdIdee[]>([])
  const [paiements, setPaiements] = useState<NdPaiement[]>([])
  const [paysOn, setPaysOn] = useState(true)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [tab, setTab] = useState<Tab>(() => { try { return (localStorage.getItem('bf-nd-tab') as Tab) || 'clients' } catch { return 'clients' } })
  const [q, setQ] = useState('')
  const [fiche, setFiche] = useState<Fiche | null>(null)
  const [call, setCall] = useState<Contact | null>(null)
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600) }
  const ctx = useData() as ReturnType<typeof useData> | null
  const myId = ctx?.session?.user.id ?? ''
  const who = (id?: string | null) => { if (!id) return ''; if (id === myId) return 'toi'; const p = partners.find((x) => x.user_id === id); return p ? partnerName(p).split(' ')[0] : '' }
  const go = (t: Tab) => { setTab(t); setQ(''); try { localStorage.setItem('bf-nd-tab', t) } catch { /* ignore */ } }

  const reload = useCallback(async () => {
    const r = await loadNd()
    if (r.missing) { setState('missing'); return }
    if (r.error) { setErrMsg(r.error); setState('error'); return }
    setClients(r.clients); setProspects(r.prospects); setIdees(r.idees); setPaiements(r.paiements); setPaysOn(r.paiementsActifs); setState('ready')
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

  /** Enregistre une fiche (création ou modification) et met la liste à jour. */
  const save = async <T extends { id: string }>(kind: Fiche['kind'], id: string | null, row: Record<string, unknown>): Promise<T | null> => {
    const body = { ...row, updated_at: new Date().toISOString() }
    const qy = id ? supabase.from(TABLE[kind]).update(body).eq('id', id) : supabase.from(TABLE[kind]).insert(body)
    const { data, error } = await qy.select().single()
    if (error) { flash("Impossible d'enregistrer. Vérifie ta connexion."); return null }
    const saved = data as T
    const upd = <X extends { id: string }>(l: X[]) => (id ? l.map((x) => (x.id === id ? (saved as unknown as X) : x)) : [saved as unknown as X, ...l])
    if (kind === 'client') setClients((l) => upd(l).map((c) => ({ ...c, mensualite: Number(c.mensualite) || 0, montant_total: Number(c.montant_total) || 0, deja_paye: Number(c.deja_paye) || 0, premier_paiement_montant: Number(c.premier_paiement_montant) || 0 })))
    if (kind === 'prospect') setProspects(upd)
    if (kind === 'idee') setIdees(upd)
    flash(id ? 'Enregistré' : kind === 'client' ? 'Client ajouté' : kind === 'prospect' ? 'Prospect ajouté' : 'Idée ajoutée')
    if (!id) setFiche({ kind, id: saved.id })
    return saved
  }
  const del = async (kind: Fiche['kind'], id: string) => {
    const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id)
    if (error) { flash('Suppression impossible. Vérifie ta connexion.'); return }
    if (kind === 'client') setClients((l) => l.filter((x) => x.id !== id))
    if (kind === 'prospect') setProspects((l) => l.filter((x) => x.id !== id))
    if (kind === 'idee') setIdees((l) => l.filter((x) => x.id !== id))
    setFiche(null); flash('Supprimé')
  }
  const deploy = async (id: string) => {
    const { data, error } = await supabase.rpc('nd_deploy_prospect', { p_id: id })
    if (error) { flash('Déploiement impossible. Vérifie ta connexion.'); return }
    await reload(); go('clients'); setFiche({ kind: 'client', id: data as string }); flash('Prospect déployé : il est maintenant dans Clients')
  }

  /** Paiement : création / modification / suppression ; le serveur recalcule « déjà payé » des clients cash. */
  const savePay = async (id: string | null, row: Record<string, unknown>) => {
    const qy = id ? supabase.from('nd_paiements').update(row).eq('id', id) : supabase.from('nd_paiements').insert(row)
    const { data, error } = await qy.select().single()
    if (error) return /regle_paiement/.test(error.message) ? 'Les détails du paiement ne respectent pas la règle (numéro, référence, nom).' : "Impossible d'enregistrer le paiement. Vérifie ta connexion."
    const pay = { ...(data as NdPaiement), montant: Number((data as NdPaiement).montant) || 0 }
    setPaiements((l) => (id ? l.map((x) => (x.id === id ? pay : x)) : [pay, ...l]).sort((a, b) => b.jour.localeCompare(a.jour) || b.created_at.localeCompare(a.created_at)))
    flash(id ? 'Paiement modifié' : 'Paiement enregistré')
    const c = await supabase.from('nd_clients').select('*').eq('id', pay.client_id).single()
    if (c.data) { const n = c.data as NdClient; setClients((l) => l.map((x) => (x.id === n.id ? { ...n, mensualite: Number(n.mensualite) || 0, montant_total: Number(n.montant_total) || 0, deja_paye: Number(n.deja_paye) || 0, premier_paiement_montant: Number(n.premier_paiement_montant) || 0 } : x))) }
    return ''
  }
  const delPay = async (p: NdPaiement) => {
    const { error } = await supabase.from('nd_paiements').delete().eq('id', p.id)
    if (error) { flash('Suppression impossible. Vérifie ta connexion.'); return false }
    if (p.piece_path) await deletePiece(p.piece_path)
    setPaiements((l) => l.filter((x) => x.id !== p.id)); flash('Paiement supprimé')
    return true
  }
  const paysOf = (id: string) => paiements.filter((p) => p.client_id === id)

  const st = ndStats(clients, prospects, paiements)
  const ready = state === 'ready'
  const qq = q.trim().toLowerCase()
  const match = (...xs: (string | null | undefined)[]) => !qq || xs.join(' ').toLowerCase().includes(qq)
  const order = <T extends { statut: string }>(keys: string[]) => (a: T, b: T) => keys.indexOf(a.statut) - keys.indexOf(b.statut)

  return (
    <div className="bp">
      <header className="bp-top pt-safe">
        <button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button>
        <h1>Projet NORD DIGITAL</h1>
        <span className="bp-sync"><span className={`bp-dot ${ready ? 'on' : state === 'loading' ? 'busy' : 'err'}`} />{ready ? 'À jour' : state === 'loading' ? 'Chargement…' : 'Hors service'}</span>
      </header>

      <nav className="bp-space" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} aria-label="Rubriques">
        {([['clients', 'Clients', clients.length], ['prospects', 'Prospects', prospects.filter((p) => p.statut === 'en_cours').length], ['idees', 'Idées', idees.length]] as [Tab, string, number][]).map(([k, l, n]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}<span className="k">{n}</span></button>)}
      </nav>

      {partners.length > 0 && <Partners list={partners} myId={myId} onCall={setCall} />}
      {state === 'missing' && <p className="bp-notice warn">Le Projet NORD DIGITAL n'est pas encore activé sur le serveur.</p>}
      {state === 'error' && <p className="bp-notice err">Le suivi ne se charge pas ({errMsg}). Reviens dans un instant.</p>}

      <section className="bp-panel">
        {tab === 'clients' && (
          <div className="bp-stats">
            <div className="bp-stat"><div className="l">En cours</div><div className="v buy">{st.clientsEnCours}</div></div>
            <div className="bp-stat"><div className="l">Encaissé ce mois</div><div className="v">{fmtAr(st.encaisseMois)}</div></div>
            <div className="bp-stat"><div className="l">Reste à encaisser</div><div className="v sell">{fmtAr(st.reste)}</div></div>
          </div>
        )}
        <button className="bp-btn primary" disabled={!ready} onClick={() => setFiche({ kind: tab === 'clients' ? 'client' : tab === 'prospects' ? 'prospect' : 'idee', id: null })}>
          + {tab === 'clients' ? 'Nouveau client' : tab === 'prospects' ? 'Nouveau prospect' : 'Nouvelle idée'}
        </button>
        <input className="bp-in" type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <div className="bp-list">
          {!ready && <p className="bp-empty">Chargement…</p>}
          {ready && tab === 'clients' && (() => {
            const l = clients.filter((c) => match(c.nom, c.activite, c.domaine, c.email, c.tel)).sort(order(['en_cours', 'termine', 'vendu']))
            return l.length ? l.map((c) => (
              <button key={c.id} className="bp-item" onClick={() => setFiche({ kind: 'client', id: c.id })}>
                <span className="n">{c.nom}{c.activite ? ` · ${c.activite}` : ''}</span>
                <span className={`nd-st ${c.statut}`}>{CLIENT_STATUTS.find(([k]) => k === c.statut)?.[1]}</span>
                <span className="s">{c.type_client} · {payLabel(c, paysOf(c.id))}{c.domaine ? ` · ${c.domaine}` : ''}{who(c.created_by) ? ` · par ${who(c.created_by)}` : ''}</span>
              </button>
            )) : <p className="bp-empty">{clients.length ? 'Aucun résultat.' : 'Aucun client. Ajoute-en un, ou déploie un prospect.'}</p>
          })()}
          {ready && tab === 'prospects' && (() => {
            const l = prospects.filter((p) => match(p.nom, p.activite, p.idee, p.email, p.tel)).sort(order(['en_cours', 'annule']))
            return l.length ? l.map((p) => {
              const done = p.taches.filter((t) => t.ok).length
              return (
                <button key={p.id} className="bp-item" onClick={() => setFiche({ kind: 'prospect', id: p.id })}>
                  <span className="n">{p.nom}{p.activite ? ` · ${p.activite}` : ''}</span>
                  <span className={`nd-st ${p.statut}`}>{p.statut === 'en_cours' ? 'En cours' : 'Annulé'}</span>
                  <span className="s">{p.type_client} · {p.type_paiement === 'abonnement' ? 'Abonnement' : 'Cash'}{p.taches.length ? ` · tâches ${done}/${p.taches.length}` : ''}{p.date_conception ? ` · conception ${fmtJour(p.date_conception)}` : ''}{who(p.created_by) ? ` · par ${who(p.created_by)}` : ''}</span>
                </button>
              )
            }) : <p className="bp-empty">{prospects.length ? 'Aucun résultat.' : 'Aucun prospect pour l\'instant.'}</p>
          })()}
          {ready && tab === 'idees' && (() => {
            const l = idees.filter((i) => match(i.secteur, i.solution, i.note))
            return l.length ? l.map((i) => (
              <button key={i.id} className="bp-item" onClick={() => setFiche({ kind: 'idee', id: i.id })}>
                <span className="n">{i.secteur}{i.solution ? ` · ${i.solution}` : ''}</span>
                <span className="nd-st">{i.type_client}</span>
                <span className="s">{i.type_paiement === 'abonnement' ? 'Abonnement' : 'Cash'}{i.note ? ` · ${i.note.split('\n')[0]}` : ''}</span>
              </button>
            )) : <p className="bp-empty">{idees.length ? 'Aucun résultat.' : 'Aucune idée notée. Garde ici tes idées de projets par secteur.'}</p>
          })()}
        </div>
      </section>

      <p className="bp-foot">BY <b>NORD DIGITAL</b></p>
      {toast && <div className="bp-toast" role="status">{toast}</div>}

      {fiche?.kind === 'client' && <ClientFiche key={fiche.id ?? 'new'} c={fiche.id ? clients.find((x) => x.id === fiche.id) ?? null : null} by={who} onClose={() => setFiche(null)} onCall={setCall}
        pays={fiche.id ? paysOf(fiche.id) : []} paysOn={paysOn} onSavePay={savePay} onDelPay={delPay}
        onSave={(row) => save('client', fiche.id, row)} onDelete={() => fiche.id && del('client', fiche.id)} />}
      {fiche?.kind === 'prospect' && <ProspectFiche key={fiche.id ?? 'new'} p={fiche.id ? prospects.find((x) => x.id === fiche.id) ?? null : null} onClose={() => setFiche(null)} onCall={setCall}
        onSave={(row) => save('prospect', fiche.id, row)} onDelete={() => fiche.id && del('prospect', fiche.id)} onDeploy={() => fiche.id && deploy(fiche.id)} />}
      {fiche?.kind === 'idee' && <IdeeFiche key={fiche.id ?? 'new'} i={fiche.id ? idees.find((x) => x.id === fiche.id) ?? null : null} onClose={() => setFiche(null)}
        onSave={(row) => save('idee', fiche.id, row)} onDelete={() => fiche.id && del('idee', fiche.id)} />}
      {call && <CallSheet c={call} onClose={() => setCall(null)} />}
    </div>
  )
}

/* ---------- Petits éléments communs ---------- */
function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="bp-seg" style={{ flexWrap: 'wrap' }}>{options.map(([k, l]) => <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="bp-sec"><span className="bp-label">{label}</span>{children}</div> }

/** E-mail et téléphone, avec boutons pour écrire ou appeler / WhatsApp. */
function ContactFields({ nom, email, tel, set, onCall }: { nom: string; email: string; tel: string; set: (x: { email?: string; tel?: string }) => void; onCall: (c: Contact) => void }) {
  return (
    <div className="bp-two">
      <div className="bp-fld">Téléphone
        <div className="bp-telrow">
          <input className="bp-in mono" inputMode="tel" placeholder="034 00 000 00" value={tel} onChange={(e) => set({ tel: e.target.value })} aria-label="Téléphone" />
          <button className="bp-btn sm" type="button" disabled={!telIntl(tel)} onClick={() => onCall({ id: 'nd', nom, tel, produits: [], autres: '', notes: '', created_at: '', updated_at: '' })}>Contacter</button>
        </div>
      </div>
      <div className="bp-fld">E-mail
        <div className="bp-telrow">
          <input className="bp-in" type="email" inputMode="email" placeholder="client@exemple.mg" value={email} onChange={(e) => set({ email: e.target.value })} aria-label="E-mail" />
          {/^\S+@\S+\.\S+$/.test(email.trim())
            ? <a className="bp-btn sm" href={`mailto:${email.trim()}`} aria-label="Écrire un e-mail"><Mail size={16} /></a>
            : <button className="bp-btn sm" type="button" disabled aria-label="Écrire un e-mail"><Mail size={16} /></button>}
        </div>
      </div>
    </div>
  )
}

function Sheet({ title, onClose, onSubmit, foot, children }: { title: string; onClose: () => void; onSubmit: () => void; foot: ReactNode; children: ReactNode }) {
  return (
    <div className="bp-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="bp-sheet" role="dialog" aria-modal="true" aria-label={title} onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <div className="bp-sh-head"><h2>{title}</h2><button type="button" className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">{children}</div>
        <div className="bp-sh-foot">{foot}</div>
      </form>
    </div>
  )
}
function DelBtn({ onDelete, label = 'Supprimer' }: { onDelete: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  return <button type="button" className={`bp-btn danger sm${armed ? ' armed' : ''}`} onClick={() => { if (armed) onDelete(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000) } }}>{armed ? 'Confirmer la suppression' : label}</button>
}
function useDraft<T>(init: T) {
  const [d, setD] = useState(init)
  const [base] = useState(() => JSON.stringify(init))
  const [busy, setBusy] = useState(false)
  return { d, set: (x: Partial<T>) => setD((o) => ({ ...o, ...x })), dirty: JSON.stringify(d) !== base, busy, setBusy }
}
const SaveBtn = ({ isNew, dirty, busy, ok }: { isNew: boolean; dirty: boolean; busy: boolean; ok: boolean }) =>
  <button type="submit" className="bp-btn primary" disabled={busy || !dirty || !ok}>{busy ? 'Enregistrement…' : isNew ? 'Ajouter' : dirty ? 'Enregistrer' : 'Enregistré'}</button>

/* ---------- Fiche client ---------- */
function ClientFiche({ c, by, onClose, onSave, onDelete, onCall, pays, paysOn, onSavePay, onDelPay }: {
  c: NdClient | null; by: (id?: string | null) => string; onClose: () => void; onSave: (row: Record<string, unknown>) => Promise<unknown>; onDelete: () => void; onCall: (c: Contact) => void
  pays: NdPaiement[]; paysOn: boolean; onSavePay: (id: string | null, row: Record<string, unknown>) => Promise<string>; onDelPay: (p: NdPaiement) => Promise<boolean>
}) {
  const [pay, setPay] = useState<NdPaiement | 'new' | null>(null)
  useBackHandler(!!pay, () => setPay(null))
  const hasPays = pays.length > 0
  const total = pays.reduce((s, p) => s + p.montant, 0)
  const f = useDraft({
    nom: c?.nom ?? '', email: c?.email ?? '', tel: c?.tel ?? '', activite: c?.activite ?? '', type_client: (c?.type_client ?? 'GP') as TypeClient,
    hebergement: c?.hebergement ?? 'nord-digital', hebergement_autre: c?.hebergement_autre ?? '', domaine: c?.domaine ?? '',
    date_conception: c?.date_conception ?? '', date_deploiement: c?.date_deploiement ?? '', premier_paiement: c?.premier_paiement ?? '', premier_paiement_montant: c?.premier_paiement_montant ? String(c.premier_paiement_montant) : '',
    type_paiement: (c?.type_paiement ?? 'cash') as Pay, mensualite: c?.mensualite ? String(c.mensualite) : '', abo_statut: c?.abo_statut ?? 'impaye',
    cash_mode: c?.cash_mode ?? 'nette', montant_total: c?.montant_total ? String(c.montant_total) : '', deja_paye: c?.deja_paye ? String(c.deja_paye) : '', cash_statut: c?.cash_statut ?? 'en_attente',
    statut: c?.statut ?? 'en_cours', notes: c?.notes ?? '',
  })
  const d = f.d
  const reste = Math.max(0, toNum(d.montant_total) - toNum(d.deja_paye))
  const submit = async () => {
    if (!d.nom.trim()) return
    f.setBusy(true)
    await onSave({
      ...d, nom: d.nom.trim(), email: d.email.trim(), tel: d.tel.trim(), activite: d.activite.trim(), domaine: d.domaine.trim(), hebergement_autre: d.hebergement === 'autre' ? d.hebergement_autre.trim() : '',
      date_conception: d.date_conception || null, date_deploiement: d.date_deploiement || null, premier_paiement: d.premier_paiement || null,
      premier_paiement_montant: toNum(d.premier_paiement_montant), mensualite: toNum(d.mensualite), montant_total: toNum(d.montant_total), deja_paye: toNum(d.deja_paye),
    })
    f.setBusy(false)
  }
  return (
    <Sheet title={c ? 'Client' : 'Nouveau client'} onClose={onClose} onSubmit={submit}
      foot={<>{c ? <DelBtn onDelete={onDelete} /> : <span />}<SaveBtn isNew={!c} dirty={f.dirty} busy={f.busy} ok={!!d.nom.trim()} /></>}>
      <input className="bp-title-in" placeholder="Nom du client" value={d.nom} onChange={(e) => f.set({ nom: e.target.value })} autoFocus={!c} aria-label="Nom" />
      <ContactFields nom={d.nom} email={d.email} tel={d.tel} set={f.set} onCall={onCall} />
      <label className="bp-fld">Activité (projet)<input className="bp-in" placeholder="ex. Pharmacie · caisse et stock" value={d.activite} onChange={(e) => f.set({ activite: e.target.value })} /></label>
      <div className="bp-two">
        <Field label="Type client"><Seg value={d.type_client} options={[['GP', 'GP'], ['PRO', 'PRO']]} onChange={(v) => f.set({ type_client: v })} /></Field>
        <Field label="Statut global"><Seg value={d.statut} options={CLIENT_STATUTS} onChange={(v) => f.set({ statut: v })} /></Field>
      </div>

      <Field label="Hébergement">
        <Seg value={d.hebergement} options={[['nord-digital', 'NORD DIGITAL'], ['autre', 'Autre']]} onChange={(v) => f.set({ hebergement: v })} />
        {d.hebergement === 'autre' && <input className="bp-in" placeholder="Préciser (ex. Hostinger, chez le client…)" value={d.hebergement_autre} onChange={(e) => f.set({ hebergement_autre: e.target.value })} />}
      </Field>
      <label className="bp-fld">Nom de domaine<input className="bp-in mono" placeholder="exemple.mg" value={d.domaine} onChange={(e) => f.set({ domaine: e.target.value })} /></label>

      <span className="bp-label" style={{ marginTop: 4 }}>Projet</span>
      <div className="bp-two">
        <label className="bp-fld">Date de conception<input className="bp-in" type="date" value={d.date_conception} onChange={(e) => f.set({ date_conception: e.target.value })} /></label>
        <label className="bp-fld">Date de déploiement<input className="bp-in" type="date" value={d.date_deploiement} onChange={(e) => f.set({ date_deploiement: e.target.value })} /></label>
      </div>
      <div className="bp-two">
        <label className="bp-fld">Premier paiement (date)<input className="bp-in" type="date" value={d.premier_paiement} onChange={(e) => f.set({ premier_paiement: e.target.value })} /></label>
        <label className="bp-fld">Premier paiement (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.premier_paiement_montant} onChange={(e) => f.set({ premier_paiement_montant: e.target.value })} /></label>
      </div>
      <Field label="Type de paiement">
        <Seg value={d.type_paiement} options={[['abonnement', 'Abonnement'], ['cash', 'Cash']]} onChange={(v) => f.set({ type_paiement: v })} />
      </Field>
      {d.type_paiement === 'abonnement' ? (
        <div className="bp-two">
          <label className="bp-fld">Mensualité (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.mensualite} onChange={(e) => f.set({ mensualite: e.target.value })} /></label>
          {hasPays && c
            ? <Field label="Mois impayés">{(() => { const imp = moisImpayes(c, pays); return <p className="bp-hint" style={{ color: imp.length ? 'var(--buy)' : 'var(--sell)' }}>{imp.length ? imp.map(moisLabel).join(', ') : 'Aucun, à jour.'}</p> })()}</Field>
            : <Field label="Ce mois"><Seg value={d.abo_statut} options={[['paye', 'Payé'], ['impaye', 'Pas encore']]} onChange={(v) => f.set({ abo_statut: v })} /></Field>}
        </div>
      ) : (
        <>
          <div className="bp-two">
            <Field label="Mode"><Seg value={d.cash_mode} options={[['nette', 'Net (en une fois)'], ['echelonne', 'Échelonné']]} onChange={(v) => f.set({ cash_mode: v })} /></Field>
            <Field label="Statut"><Seg value={d.cash_statut} options={[['paye', 'Payé'], ['en_attente', 'En attente']]} onChange={(v) => f.set({ cash_statut: v })} /></Field>
          </div>
          <div className="bp-two">
            <label className="bp-fld">Montant total (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.montant_total} onChange={(e) => f.set({ montant_total: e.target.value })} /></label>
            {d.cash_mode === 'echelonne' && !hasPays && <label className="bp-fld">Déjà payé (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.deja_paye} onChange={(e) => f.set({ deja_paye: e.target.value })} /></label>}
          </div>
          {hasPays && toNum(d.montant_total) > 0
            ? <p className="bp-hint" style={{ color: toNum(d.montant_total) - total > 0 ? 'var(--buy)' : 'var(--sell)' }}>Payé {fmtAr(total)} (historique) · {toNum(d.montant_total) - total > 0 ? `reste à payer ${fmtAr(toNum(d.montant_total) - total)}` : 'entièrement payé'}</p>
            : d.cash_mode === 'echelonne' && toNum(d.montant_total) > 0 && <p className="bp-hint" style={{ color: reste > 0 ? 'var(--buy)' : 'var(--sell)' }}>{reste > 0 ? `Reste à payer : ${fmtAr(reste)}` : 'Entièrement payé.'}</p>}
        </>
      )}
      {c && (
        <div className="bp-sec">
          <div className="bp-row"><span className="bp-label">Historique des paiements{hasPays ? ` · ${fmtAr(total)}` : ''}</span>
            <button type="button" className="bp-btn primary sm" disabled={!paysOn} onClick={() => setPay('new')}>+ Paiement</button></div>
          {!paysOn && <p className="bp-hint">L'historique des paiements n'est pas encore activé sur le serveur.</p>}
          <div className="bp-txs">
            {pays.map((p) => (
              <button type="button" key={p.id} className="bp-tx" onClick={() => setPay(p)}>
                <span className="a"><span className="bp-tag vente">{p.moyen}</span><span>{fmtJour(p.jour)}{p.mois && c.type_paiement === 'abonnement' ? ` · ${moisLabel(p.mois)}` : ''}</span></span>
                <span className="m vente">{fmtAr(p.montant)}</span>
                <span className="d">{moyenLabel(p)}{p.note ? ` · ${p.note}` : ''}{p.piece_path ? <> · <Paperclip size={12} style={{ verticalAlign: -1 }} /> pièce jointe</> : null}{by(p.created_by) ? ` · par ${by(p.created_by)}` : ''}</span>
              </button>
            ))}
            {paysOn && !hasPays && <p className="bp-hint">Aucun paiement enregistré. Chaque paiement ajouté ici met à jour le reste à payer.</p>}
          </div>
        </div>
      )}
      {pay && c && <PaiementSheet client={c} p={pay === 'new' ? null : pay} onClose={() => setPay(null)}
        onSave={async (row) => { const e = await onSavePay(pay === 'new' ? null : pay.id, { ...row, client_id: c.id }); if (!e) setPay(null); return e }}
        onDelete={async () => { if (pay !== 'new' && await onDelPay(pay)) setPay(null) }} />}
      <label className="bp-fld">Notes (idées de conception, accès, demandes…)<textarea className="bp-in" style={{ minHeight: 120 }} value={d.notes} onChange={(e) => f.set({ notes: e.target.value })} /></label>
      {c && <p className="bp-hint">Ajouté le {fmtJour(c.created_at.slice(0, 10))}{by(c.created_by) ? ` par ${by(c.created_by)}` : ''}.</p>}
    </Sheet>
  )
}

/* ---------- Fiche prospect ---------- */
function ProspectFiche({ p, onClose, onSave, onDelete, onDeploy, onCall }: { p: NdProspect | null; onClose: () => void; onSave: (row: Record<string, unknown>) => Promise<unknown>; onDelete: () => void; onDeploy: () => void; onCall: (c: Contact) => void }) {
  const f = useDraft({
    nom: p?.nom ?? '', email: p?.email ?? '', tel: p?.tel ?? '', activite: p?.activite ?? '', type_client: (p?.type_client ?? 'GP') as TypeClient,
    date_conception: p?.date_conception ?? '', idee: p?.idee ?? '', type_paiement: (p?.type_paiement ?? 'cash') as Pay,
    taches: p?.taches ?? [], statut: p?.statut ?? 'en_cours',
  })
  const d = f.d
  const [newTask, setNewTask] = useState('')
  const [armed, setArmed] = useState(false)
  const submit = async () => {
    if (!d.nom.trim()) return
    f.setBusy(true)
    await onSave({ ...d, nom: d.nom.trim(), email: d.email.trim(), tel: d.tel.trim(), activite: d.activite.trim(), date_conception: d.date_conception || null })
    f.setBusy(false)
  }
  const addTask = () => { const t = newTask.trim(); if (!t) return; f.set({ taches: [...d.taches, { t, ok: false }] }); setNewTask('') }
  return (
    <Sheet title={p ? 'Prospect' : 'Nouveau prospect'} onClose={onClose} onSubmit={submit}
      foot={<>{p ? <DelBtn onDelete={onDelete} /> : <span />}<SaveBtn isNew={!p} dirty={f.dirty} busy={f.busy} ok={!!d.nom.trim()} /></>}>
      <input className="bp-title-in" placeholder="Nom du prospect" value={d.nom} onChange={(e) => f.set({ nom: e.target.value })} autoFocus={!p} aria-label="Nom" />
      <ContactFields nom={d.nom} email={d.email} tel={d.tel} set={f.set} onCall={onCall} />
      <label className="bp-fld">Activité (projet)<input className="bp-in" placeholder="ex. Restaurant · site + menu WhatsApp" value={d.activite} onChange={(e) => f.set({ activite: e.target.value })} /></label>
      <div className="bp-two">
        <Field label="Type client"><Seg value={d.type_client} options={[['GP', 'GP'], ['PRO', 'PRO']]} onChange={(v) => f.set({ type_client: v })} /></Field>
        <Field label="Statut global"><Seg value={d.statut} options={[['en_cours', 'En cours'], ['annule', 'Annulé']]} onChange={(v) => f.set({ statut: v })} /></Field>
      </div>
      <div className="bp-two">
        <label className="bp-fld">Date de conception<input className="bp-in" type="date" value={d.date_conception} onChange={(e) => f.set({ date_conception: e.target.value })} /></label>
        <Field label="Type de paiement"><Seg value={d.type_paiement} options={[['abonnement', 'Abonnement'], ['cash', 'Cash']]} onChange={(v) => f.set({ type_paiement: v })} /></Field>
      </div>
      <label className="bp-fld">Idée de conception<textarea className="bp-in" style={{ minHeight: 110 }} placeholder="Pages, fonctions, couleurs, exemples qu'il aime…" value={d.idee} onChange={(e) => f.set({ idee: e.target.value })} /></label>

      <Field label={`Tâches${d.taches.length ? ` · ${d.taches.filter((t) => t.ok).length}/${d.taches.length}` : ''}`}>
        <div className="nd-tasks">
          {d.taches.map((t, i) => (
            <div key={i} className={`nd-task${t.ok ? ' ok' : ''}`}>
              <input type="checkbox" checked={t.ok} aria-label={t.ok ? 'Remettre à faire' : 'Marquer faite'} onChange={() => f.set({ taches: d.taches.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)) })} />
              <span>{t.t}</span>
              <button type="button" className="bp-iconbtn" style={{ width: 32, height: 32 }} aria-label="Retirer la tâche" onClick={() => f.set({ taches: d.taches.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="bp-telrow">
            <input className="bp-in" placeholder="Nouvelle tâche (ex. envoyer le devis)" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask() } }} />
            <button type="button" className="bp-btn sm" onClick={addTask} aria-label="Ajouter la tâche"><Plus size={16} /></button>
          </div>
        </div>
      </Field>

      {p && p.statut === 'en_cours' && (
        <div className="nd-deploy">
          <p className="bp-hint">Le projet est validé ? Le prospect passe dans <b>Clients</b>, avec son idée de conception et ses tâches dans les notes.</p>
          <button type="button" className="bp-btn primary" disabled={f.dirty} onClick={() => { if (armed) onDeploy(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000) } }}>
            <Rocket size={18} /> {armed ? 'Confirmer le déploiement' : 'Déploiement'}
          </button>
          {f.dirty && <p className="bp-hint">Enregistre d'abord tes modifications.</p>}
        </div>
      )}
    </Sheet>
  )
}

/* ---------- Fiche idée ---------- */
function IdeeFiche({ i, onClose, onSave, onDelete }: { i: NdIdee | null; onClose: () => void; onSave: (row: Record<string, unknown>) => Promise<unknown>; onDelete: () => void }) {
  const f = useDraft({ secteur: i?.secteur ?? SECTEURS[0], solution: i?.solution ?? SOLUTIONS[0], type_client: (i?.type_client ?? 'GP') as NdIdee['type_client'], type_paiement: (i?.type_paiement ?? 'cash') as Pay, note: i?.note ?? '' })
  const d = f.d
  const submit = async () => { f.setBusy(true); await onSave(d); f.setBusy(false) }
  return (
    <Sheet title={i ? 'Idée' : 'Nouvelle idée'} onClose={onClose} onSubmit={submit}
      foot={<>{i ? <DelBtn onDelete={onDelete} /> : <span />}<SaveBtn isNew={!i} dirty={f.dirty || !i} busy={f.busy} ok /></>}>
      <div className="bp-two">
        <label className="bp-fld">Secteur<select className="bp-in" value={d.secteur} onChange={(e) => f.set({ secteur: e.target.value })}>{SECTEURS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="bp-fld">Type de projet<select className="bp-in" value={d.solution} onChange={(e) => f.set({ solution: e.target.value })}>{SOLUTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <div className="bp-two">
        <Field label="Type client visé"><Seg value={d.type_client} options={[['GP', 'GP'], ['PRO', 'PRO'], ['GP et PRO', 'Les deux']]} onChange={(v) => f.set({ type_client: v })} /></Field>
        <Field label="Type de paiement"><Seg value={d.type_paiement} options={[['abonnement', 'Abonnement'], ['cash', 'Cash']]} onChange={(v) => f.set({ type_paiement: v })} /></Field>
      </div>
      <label className="bp-fld">Note<textarea className="bp-in" style={{ minHeight: 140 }} autoFocus={!i} placeholder="L'idée, à qui la proposer, le prix envisagé…" value={d.note} onChange={(e) => f.set({ note: e.target.value })} /></label>
    </Sheet>
  )
}

/* ---------- Paiement d'un client (avec pièce jointe) ---------- */
function PaiementSheet({ client, p, onClose, onSave, onDelete }: {
  client: NdClient; p: NdPaiement | null; onClose: () => void; onSave: (row: Record<string, unknown>) => Promise<string>; onDelete: () => void
}) {
  const abo = client.type_paiement === 'abonnement'
  const now = new Date()
  const [jour, setJour] = useState(p?.jour ?? now.toLocaleDateString('sv-SE'))
  const [montant, setMontant] = useState(p ? String(p.montant) : abo && client.mensualite ? String(client.mensualite) : '')
  const [mois, setMois] = useState(p?.mois ?? ym(now))
  const [det, setDet] = useState<PayDetails>(p ? { moyen: p.moyen, mm_numero: p.mm_numero, reference: p.reference, payeur_nom: p.payeur_nom, num_doc: p.num_doc } : emptyPay('MVola'))
  const [note, setNote] = useState(p?.note ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [dropPiece, setDropPiece] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [dl, setDl] = useState('')
  useBackHandler(!!view, () => setView(null))

  const submit = async () => {
    const m = toNum(montant)
    if (!m) return setErr('Indique le montant payé.')
    const e = payError(det); if (e) return setErr(e)
    setBusy(true); setErr('')
    let piece: { piece_path: string | null; piece_nom: string | null; piece_type: string | null } | null = null
    if (file) {
      const up = await uploadPiece('nord-digital', client.id, file)
      if (typeof up === 'string') { setBusy(false); return setErr(up) }
      piece = { piece_path: up.path, piece_nom: up.nom, piece_type: up.type }
    } else if (dropPiece) piece = { piece_path: null, piece_nom: null, piece_type: null }
    const err2 = await onSave({ jour, montant: m, mois: abo ? mois : null, note: note.trim(), ...cleanPay(det), ...(piece ?? {}) })
    if (err2) { if (piece?.piece_path) await deletePiece(piece.piece_path); setBusy(false); return setErr(err2) }
    if (p?.piece_path && (file || dropPiece)) await deletePiece(p.piece_path)
    setBusy(false)
  }
  const open = async () => { if (!p?.piece_path) return; const u = await pieceUrl(p.piece_path); if (u) setView(u); else setDl('Pièce introuvable.') }
  const download = async () => { if (!p?.piece_path) return; setDl('Téléchargement…'); const e = await downloadPiece({ path: p.piece_path, nom: p.piece_nom ?? 'piece', type: p.piece_type ?? '' }); setDl(e ?? '') }
  const isPdf = p?.piece_type === 'application/pdf'

  return (
    <div className="bp-ov top" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label="Paiement">
        <div className="bp-sh-head"><h2>{p ? 'Paiement' : 'Nouveau paiement'} · {client.nom}</h2><button type="button" className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">
          <div className="bp-two">
            <label className="bp-fld">Date<input className="bp-in" type="date" value={jour} onChange={(e) => setJour(e.target.value)} /></label>
            <label className="bp-fld">Montant (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" autoFocus={!p} value={montant} onChange={(e) => setMontant(e.target.value)} /></label>
          </div>
          {abo && <label className="bp-fld">Mois payé<input className="bp-in" type="month" value={mois} onChange={(e) => setMois(e.target.value)} /></label>}
          <PaymentFields value={det} onChange={setDet} idPrefix="ndp" />
          <label className="bp-fld">Note<input className="bp-in" placeholder="ex. 2e tranche" value={note} onChange={(e) => setNote(e.target.value)} /></label>

          <div className="bp-sec">
            <span className="bp-label">Pièce jointe (photo du reçu, capture MVola, PDF…)</span>
            {p?.piece_path && !file && !dropPiece && (
              <div className="nd-piece">
                <FileText size={18} /><span>{p.piece_nom ?? 'Pièce jointe'}</span>
                <button type="button" className="bp-btn sm" onClick={open}><Eye size={16} /> Voir</button>
                <button type="button" className="bp-btn sm" onClick={download} aria-label="Télécharger"><Download size={16} /></button>
                <button type="button" className="bp-iconbtn" style={{ width: 32, height: 32 }} aria-label="Retirer la pièce" onClick={() => setDropPiece(true)}><Trash2 size={16} /></button>
              </div>
            )}
            {dl && <p className="bp-hint">{dl}</p>}
            {(!p?.piece_path || file || dropPiece) && (
              <label className="nd-file">
                <Paperclip size={18} /><span>{file ? file.name : 'Ajouter une photo ou un PDF'}</span>
                <input type="file" accept={PIECE_ACCEPT} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr('') }} />
              </label>
            )}
          </div>
          {err && <p className="bp-err" role="alert">{err}</p>}
        </div>
        <div className="bp-sh-foot">
          {p ? <button type="button" className={`bp-btn danger sm${armed ? ' armed' : ''}`} onClick={() => { if (armed) onDelete(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000) } }}>{armed ? 'Confirmer la suppression' : 'Supprimer'}</button> : <span />}
          <button type="button" className="bp-btn primary" disabled={busy} onClick={submit}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
      {view && (
        <div className="bp-ov top" style={{ zIndex: 90 }} onClick={(e) => { if (e.target === e.currentTarget) setView(null) }}>
          <div className="bp-sheet" role="dialog" aria-modal="true" aria-label="Pièce jointe">
            <div className="bp-sh-head"><h2>{p?.piece_nom ?? 'Pièce jointe'}</h2><button type="button" className="bp-iconbtn" aria-label="Fermer" onClick={() => setView(null)}><X size={22} /></button></div>
            <div className="bp-sh-body">
              {isPdf
                ? <a className="bp-btn primary" href={view} target="_blank" rel="noopener"><FileText size={18} /> Ouvrir le PDF</a>
                : <img src={view} alt="Pièce jointe du paiement" style={{ width: '100%', borderRadius: 10, background: '#fff' }} />}
            </div>
            <div className="bp-sh-foot"><span /><button type="button" className="bp-btn" onClick={download}><Download size={16} /> Télécharger</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
