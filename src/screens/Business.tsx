import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import './business.css'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useBackHandler } from '../lib/back'
import { ymd } from '../lib/travail'
import {
  AUTRES, MOIS, MOIS_LONG, PRODUITS, REGIONS, TABLE, UNITES,
  allProduits, contactProduits, fmtAr, fmtJour, fmtQ, initials, kindOf, loadBusiness, loadPartners, partnerName, splitAutres, telIntl, telLocal, toNum, txOf,
} from '../lib/business'
import type { BpTx, Contact, Kind, Partner, TxType } from '../lib/business'
import { PaymentFields } from './PaymentFields'
import { cleanPay, emptyPay, payError, payLabel as moyenLabel } from '../lib/paiement'
import type { PayDetails } from '../lib/paiement'

type Tab = Kind | 'tx' | 'bilan'
type Data = { fournisseurs: Contact[]; clients: Contact[]; txs: BpTx[] }
type TxDraft = { id: string | null; type: TxType; contact_id: string; produit: string; autre: string; qte: string; unite: string; prix_u: string; montant: string; jour: string; paiement: string; note: string; manual: boolean; pay: PayDetails }

const TAB_KEY = 'bf-bp-tab'
const curMonth = () => new Date().getMonth() + 1
const byJour = (a: BpTx, b: BpTx) => b.jour.localeCompare(a.jour) || b.created_at.localeCompare(a.created_at)
const sum = (l: BpTx[], t?: TxType) => l.filter((x) => !t || x.type === t).reduce((s, x) => s + x.montant, 0)

/** « Projet Légumes » (dans Business Pro) : fournisseurs et clients en légumes, achats/ventes, saisons, bilan par produit. Partagé entre ses membres. */
export function LegumesPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Data>({ fournisseurs: [], clients: [], txs: [] })
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [tab, setTabState] = useState<Tab>(() => { try { return (localStorage.getItem(TAB_KEY) as Tab) || 'fournisseur' } catch { return 'fournisseur' } })
  const [fiche, setFiche] = useState<{ kind: Kind; id: string | null } | null>(null)
  const [tx, setTx] = useState<TxDraft | null>(null)
  const [call, setCall] = useState<Contact | null>(null)
  const [toast, setToast] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const ctx = useData() as ReturnType<typeof useData> | null
  const myId = ctx?.session?.user.id ?? ''
  const who = (id?: string | null) => { if (!id) return ''; if (id === myId) return 'toi'; const p = partners.find((x) => x.user_id === id); return p ? partnerName(p).split(' ')[0] : '' }
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600) }
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t) } catch { /* ignore */ } }

  const reload = useCallback(async () => {
    const r = await loadBusiness()
    if (r.missing) { setState('missing'); return }
    if (r.error) { setErrMsg(r.error); setState('error'); return }
    setData({ fournisseurs: r.fournisseurs, clients: r.clients, txs: r.txs }); setState('ready')
    setPartners(await loadPartners('legumes'))
  }, [])
  useEffect(() => { reload() }, [reload])
  // Les deux partenaires écrivent : on recharge en revenant sur l'appli
  useEffect(() => {
    const v = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [reload])

  useBackHandler(!!fiche, () => setFiche(null))
  useBackHandler(!!tx, () => setTx(null))
  useBackHandler(!!call, () => setCall(null))

  const list = (k: Kind) => (k === 'fournisseur' ? data.fournisseurs : data.clients)
  const contacts = useMemo(() => [...data.fournisseurs, ...data.clients], [data])
  const produits = useMemo(() => allProduits(contacts, data.txs), [contacts, data.txs])
  const ready = state === 'ready'

  /* ---------- écritures ---------- */
  const saveContact = async (kind: Kind, id: string | null, row: Partial<Contact>) => {
    const body = { ...row, updated_at: new Date().toISOString() }
    const q = id ? supabase.from(TABLE[kind]).update(body).eq('id', id) : supabase.from(TABLE[kind]).insert(body)
    const { data: saved, error } = await q.select().single()
    if (error) { flash("Impossible d'enregistrer la fiche. Vérifie ta connexion."); return null }
    const c = saved as Contact
    const key = kind === 'fournisseur' ? 'fournisseurs' : 'clients'
    setData((d) => ({ ...d, [key]: id ? d[key].map((x) => (x.id === id ? c : x)) : [...d[key], c] }))
    flash(id ? 'Fiche enregistrée' : kind === 'fournisseur' ? 'Fournisseur ajouté' : 'Client ajouté')
    return c
  }
  const delContact = async (kind: Kind, id: string) => {
    const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id)
    if (error) { flash('Suppression impossible. Vérifie ta connexion.'); return false }
    const key = kind === 'fournisseur' ? 'fournisseurs' : 'clients'
    setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }))
    flash("Fiche supprimée. Ses transactions restent dans l'historique.")
    return true
  }
  const saveTx = async (d: TxDraft): Promise<string> => {
    const produit = d.produit === '__autre' ? splitAutres(d.autre)[0] ?? '' : d.produit
    const qte = toNum(d.qte), prix_u = toNum(d.prix_u)
    const montant = d.montant.trim() ? toNum(d.montant) : Math.round(qte * prix_u)
    if (!d.contact_id) return d.type === 'achat' ? 'Choisis un fournisseur.' : 'Choisis un client.'
    if (!produit) return 'Choisis un produit.'
    if (!montant) return 'Indique la quantité et le prix, ou le montant total.'
    const pe = payError(d.pay); if (pe) return pe
    const pay = cleanPay(d.pay)
    const c = list(kindOf(d.type)).find((x) => x.id === d.contact_id)
    const prev = d.id ? data.txs.find((x) => x.id === d.id) : null
    const row = { type: d.type, contact_id: d.contact_id, contact_nom: c?.nom ?? prev?.contact_nom ?? '', produit, qte, unite: d.unite, prix_u, montant, jour: d.jour || ymd(new Date()), paiement: pay.moyen, mm_numero: pay.mm_numero, reference: pay.reference, payeur_nom: pay.payeur_nom, num_doc: pay.num_doc, note: d.note.trim(), updated_at: new Date().toISOString() }
    const q = d.id ? supabase.from('bp_transactions').update(row).eq('id', d.id) : supabase.from('bp_transactions').insert(row)
    const { data: saved, error } = await q.select().single()
    if (error) return /regle_paiement|mm_numero|column/.test(error.message) ? 'Les détails du paiement ne sont pas acceptés par le serveur (numéro, référence ou nom manquant).' : "Enregistrement impossible. Vérifie ta connexion puis réessaie."
    const t = { ...(saved as BpTx), qte, prix_u, montant }
    setData((x) => ({ ...x, txs: (d.id ? x.txs.map((y) => (y.id === d.id ? t : y)) : [t, ...x.txs]).sort(byJour) }))
    flash(d.type === 'achat' ? 'Achat enregistré' : 'Vente enregistrée')
    return ''
  }
  const delTx = async (id: string) => {
    const { error } = await supabase.from('bp_transactions').delete().eq('id', id)
    if (error) { flash('Suppression impossible. Vérifie ta connexion.'); return false }
    setData((x) => ({ ...x, txs: x.txs.filter((y) => y.id !== id) })); flash('Transaction supprimée')
    return true
  }

  const newTx = (type: TxType, contact_id = '') => setTx({ id: null, type, contact_id, produit: '', autre: '', qte: '', unite: 'kg', prix_u: '', montant: '', jour: ymd(new Date()), paiement: 'Espèces', note: '', manual: false, pay: emptyPay() })
  const editTx = (t: BpTx) => setTx({
    id: t.id, type: t.type, contact_id: t.contact_id ?? '', produit: t.produit, autre: '', qte: String(t.qte || ''), unite: t.unite, prix_u: String(t.prix_u || ''),
    montant: String(t.montant || ''), jour: t.jour, paiement: t.paiement, note: t.note, pay: { moyen: t.paiement, mm_numero: t.mm_numero ?? '', reference: t.reference ?? '', payeur_nom: t.payeur_nom ?? '', num_doc: t.num_doc ?? '' }, manual: Math.round(t.qte * t.prix_u) !== Math.round(t.montant),
  })
  const nameOf = (t: BpTx) => list(kindOf(t.type)).find((c) => c.id === t.contact_id)?.nom || t.contact_nom || 'Contact supprimé'

  const tabs: [Tab, string, number | null][] = [['fournisseur', 'Fournisseurs', data.fournisseurs.length], ['client', 'Clients', data.clients.length], ['tx', 'Transactions', data.txs.length], ['bilan', 'Bilan produits', null]]

  return (
    <div className="bp">
      <header className="bp-top pt-safe">
        <button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button>
        <h1>Projet Légumes</h1>
        <span className="bp-sync"><span className={`bp-dot ${ready ? 'on' : state === 'loading' ? 'busy' : 'err'}`} />{ready ? 'À jour' : state === 'loading' ? 'Chargement…' : 'Hors service'}</span>
      </header>

      <nav className="bp-space" aria-label="Rubriques">
        {tabs.map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n != null && <span className="k">{n}</span>}</button>)}
      </nav>

      {partners.length > 0 && <Partners list={partners} myId={myId} onCall={setCall} />}

      {state === 'missing' && <p className="bp-notice warn">Le Projet Légumes n'est pas encore activé sur le serveur.</p>}
      {state === 'error' && <p className="bp-notice err">Le carnet ne se charge pas ({errMsg}). Reviens dans un instant.</p>}

      {(tab === 'fournisseur' || tab === 'client') && (
        <ContactList key={tab} kind={tab} items={list(tab)} produits={produits} ready={ready} onOpen={(id) => setFiche({ kind: tab, id })} />
      )}
      {tab === 'tx' && <TxTab txs={data.txs} produits={produits} nameOf={nameOf} who={who} onNew={newTx} onOpen={editTx} ready={ready} />}
      {tab === 'bilan' && <Bilan txs={data.txs} />}

      <p className="bp-foot">BY <b>NORD DIGITAL</b></p>
      {toast && <div className="bp-toast" role="status">{toast}</div>}

      {fiche && (
        <ContactFiche key={`${fiche.kind}-${fiche.id ?? 'new'}`} kind={fiche.kind} contact={fiche.id ? list(fiche.kind).find((c) => c.id === fiche.id) ?? null : null}
          txs={fiche.id ? data.txs.filter((t) => t.contact_id === fiche.id) : []}
          onClose={() => setFiche(null)} onCall={setCall} onTx={editTx} who={who}
          onNewTx={(id) => newTx(txOf(fiche.kind), id)}
          onSave={async (row) => { const c = await saveContact(fiche.kind, fiche.id, row); if (c && !fiche.id) setFiche({ kind: fiche.kind, id: c.id }); return !!c }}
          onDelete={async () => { if (fiche.id && await delContact(fiche.kind, fiche.id)) setFiche(null) }} />
      )}
      {tx && <TxSheet draft={tx} setDraft={setTx} data={data} produits={produits} onClose={() => setTx(null)} onSave={saveTx} onDelete={async (id) => { if (await delTx(id)) setTx(null) }} />}
      {call && <CallSheet c={call} onClose={() => setCall(null)} />}
    </div>
  )
}

/* ---------- Les deux partenaires, visibles l'un pour l'autre ici seulement ---------- */
export function Partners({ list, myId, onCall }: { list: Partner[]; myId: string; onCall: (c: Contact) => void }) {
  return (
    <section className="bp-partners" aria-label="Partenaires">
      {list.map((p) => {
        const name = partnerName(p), me = p.user_id === myId
        return (
          <div key={p.email} className="bp-partner">
            <span className="av">{initials(name)}</span>
            <span className="tx">
              <b>{name}{me && <span className="me">toi</span>}</b>
              <small>{p.has_account ? [p.phone ? telLocal(p.phone) : '', p.email].filter(Boolean).join(' · ') : 'Compte pas encore créé'}</small>
            </span>
            {!me && p.phone && <button className="bp-btn sm" onClick={() => onCall({ id: p.email, nom: name, tel: p.phone ?? '', produits: [], autres: '', notes: '', created_at: '', updated_at: '' })}>Contacter</button>}
          </div>
        )
      })}
    </section>
  )
}

/* ---------- Liste des contacts ---------- */
function ContactList({ kind, items, produits, ready, onOpen }: { kind: Kind; items: Contact[]; produits: string[]; ready: boolean; onOpen: (id: string | null) => void }) {
  const isF = kind === 'fournisseur'
  const [q, setQ] = useState('')
  const [prod, setProd] = useState('')
  const [mois, setMois] = useState('')
  const [reg, setReg] = useState('')
  const regions = [...new Set(items.map((c) => c.region).filter(Boolean) as string[])].sort()
  const qq = q.trim().toLowerCase(), qd = qq.replace(/\D/g, '').replace(/^0/, '')
  const shown = items.filter((c) => {
    if (qq) {
      const hay = [c.nom, c.quartier, c.region, c.tel, c.autres, ...c.produits].join(' ').toLowerCase()
      if (!hay.includes(qq) && !(qd.length >= 3 && telIntl(c.tel).includes(qd))) return false
    }
    if (prod && !contactProduits(c).includes(prod)) return false
    if (isF && mois && !(c.mois ?? []).includes(+mois)) return false
    if (!isF && reg && c.region !== reg) return false
    return true
  }).sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))

  return (
    <>
      <div className="bp-tools">
        <button className="bp-btn primary" disabled={!ready} onClick={() => onOpen(null)}>+ Nouveau {isF ? 'fournisseur' : 'client'}</button>
        <input className="bp-in" type="search" placeholder={`Rechercher un nom, ${isF ? 'quartier' : 'région'}, numéro…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <div className="bp-filters">
          <label className="bp-fld">Produit<select className="bp-in" value={prod} onChange={(e) => setProd(e.target.value)}><option value="">Tous</option>{produits.map((p) => <option key={p}>{p}</option>)}</select></label>
          {isF
            ? <label className="bp-fld">En saison en<select className="bp-in" value={mois} onChange={(e) => setMois(e.target.value)}><option value="">Tous les mois</option>{MOIS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}{i + 1 === curMonth() ? ' (ce mois)' : ''}</option>)}</select></label>
            : <label className="bp-fld">Région<select className="bp-in" value={reg} onChange={(e) => setReg(e.target.value)}><option value="">Toutes</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>}
        </div>
      </div>
      <div className="bp-list">
        {!ready ? <p className="bp-empty">Chargement…</p>
          : !shown.length ? <p className="bp-empty">{items.length ? 'Aucun résultat pour ces filtres.' : `Aucun ${isF ? 'fournisseur' : 'client'} pour l'instant. Touche « + Nouveau » pour ajouter le premier.`}</p>
          : shown.map((c) => {
            const sub = [isF ? c.quartier : c.region, contactProduits(c).join(', ')].filter(Boolean).join(' · ') || 'Fiche à compléter'
            return (
              <button key={c.id} className="bp-item" onClick={() => onOpen(c.id)}>
                <span className="n">{c.nom || 'Sans nom'}</span><span className="t">{telLocal(c.tel)}</span><span className="s">{sub}</span>
              </button>
            )
          })}
      </div>
    </>
  )
}

/* ---------- Ligne de transaction ---------- */
function TxRow({ t, who, by, onOpen }: { t: BpTx; who?: string; by?: string; onOpen: () => void }) {
  return (
    <button className="bp-tx" onClick={onOpen}>
      <span className="a"><span className={`bp-tag ${t.type}`}>{t.type === 'achat' ? 'Achat' : 'Vente'}</span><span>{t.produit}{who ? ` · ${who}` : ''}</span></span>
      <span className={`m ${t.type}`}>{t.type === 'achat' ? '−' : '+'} {fmtAr(t.montant)}</span>
      <span className="d">{fmtJour(t.jour)} · {fmtQ(t.qte)} {t.unite} × {fmtAr(t.prix_u)} · {moyenLabel({ moyen: t.paiement, mm_numero: t.mm_numero, reference: t.reference, payeur_nom: t.payeur_nom, num_doc: t.num_doc })}{t.note ? ` · ${t.note}` : ''}{by ? ` · par ${by}` : ''}</span>
    </button>
  )
}

/* ---------- Fiche fournisseur / client ---------- */
function ContactFiche({ kind, contact, txs, onClose, onSave, onDelete, onCall, onTx, onNewTx, who }: {
  kind: Kind; contact: Contact | null; txs: BpTx[]; who: (id?: string | null) => string; onClose: () => void; onSave: (row: Partial<Contact>) => Promise<boolean>; onDelete: () => void
  onCall: (c: Contact) => void; onTx: (t: BpTx) => void; onNewTx: (contactId: string) => void
}) {
  const isF = kind === 'fournisseur'
  const blank = { nom: '', tel: '', produits: [] as string[], autres: '', notes: '', quartier: '', region: '', mois: [] as number[] }
  const [f, setF] = useState(() => ({ ...blank, ...contact, quartier: contact?.quartier ?? '', region: contact?.region ?? '', mois: contact?.mois ?? [] }))
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const dirty = !contact || (['nom', 'tel', 'autres', 'notes', 'quartier', 'region'] as const).some((k) => (f[k] ?? '') !== (contact[k] ?? '')) || f.produits.join() !== contact.produits.join() || (isF && (f.mois ?? []).join() !== (contact.mois ?? []).join())
  const sorted = [...txs].sort(byJour)
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const save = async () => {
    setBusy(true)
    const row: Partial<Contact> = { nom: f.nom.trim(), tel: f.tel.trim(), produits: f.produits, autres: f.autres.trim(), notes: f.notes, ...(isF ? { quartier: f.quartier.trim(), mois: [...(f.mois ?? [])].sort((a, b) => a - b) } : { region: f.region.trim() }) }
    await onSave(row)
    setBusy(false)
  }

  return (
    <div className="bp-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label={isF ? 'Fiche fournisseur' : 'Fiche client'}>
        <div className="bp-sh-head">
          <h2>{contact ? (isF ? 'Fournisseur' : 'Client') : isF ? 'Nouveau fournisseur' : 'Nouveau client'}</h2>
          <button className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="bp-sh-body">
          <input className="bp-title-in" placeholder={isF ? 'Nom du fournisseur' : 'Nom du client'} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} autoFocus={!contact} aria-label="Nom" />
          <div className="bp-two">
            {isF
              ? <label className="bp-fld">Quartier<input className="bp-in" placeholder="ex. Andravoahangy" value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} /></label>
              : <label className="bp-fld">Région<input className="bp-in" list="bp-regions" placeholder="ex. Analamanga" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /><datalist id="bp-regions">{REGIONS.map((r) => <option key={r} value={r} />)}</datalist></label>}
            <div className="bp-fld">Téléphone
              <div className="bp-telrow">
                <input className="bp-in mono" inputMode="tel" placeholder="034 00 000 00" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} aria-label="Téléphone" />
                <button className="bp-btn sm" type="button" disabled={!telIntl(f.tel)} onClick={() => onCall({ ...(contact as Contact), nom: f.nom, tel: f.tel })}>Contacter</button>
              </div>
            </div>
          </div>

          <div className="bp-sec">
            <span className="bp-label">Produits {isF ? 'fournis' : 'achetés'}</span>
            <div className="bp-chips">
              {[...PRODUITS, AUTRES].map((p) => (
                <button key={p} type="button" className={`bp-chip${f.produits.includes(p) ? ' on' : ''}`} aria-pressed={f.produits.includes(p)} onClick={() => setF({ ...f, produits: toggle(f.produits, p) })}>
                  {p}{p === AUTRES ? ' (à préciser)' : ''}
                </button>
              ))}
            </div>
            {f.produits.includes(AUTRES) && <input className="bp-in" placeholder="Autres produits, séparés par des virgules (ex. Tomate, Petsay)" value={f.autres} onChange={(e) => setF({ ...f, autres: e.target.value })} />}
          </div>

          {isF && (
            <div className="bp-sec">
              <span className="bp-label">Saison de production</span>
              <div className="bp-mois">
                {MOIS.map((m, i) => (
                  <button key={m} type="button" title={MOIS_LONG[i]} aria-pressed={(f.mois ?? []).includes(i + 1)} className={`bp-chip${(f.mois ?? []).includes(i + 1) ? ' on' : ''}${i + 1 === curMonth() ? ' now' : ''}`}
                    onClick={() => setF({ ...f, mois: toggle(f.mois ?? [], i + 1) })}>{m}</button>
                ))}
              </div>
              <p className="bp-hint">Touche les mois où il produit. Le mois en cours est souligné.</p>
            </div>
          )}

          <label className="bp-fld">Notes<textarea className="bp-in" placeholder="Qualité, prix habituels, jours de livraison…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>

          {contact && (
            <>
              {who(contact.created_by) && <p className="bp-hint">Fiche ajoutée par {who(contact.created_by)} le {fmtJour(contact.created_at.slice(0, 10))}.</p>}
              <div className="bp-sec">
                <span className="bp-label">Bilan</span>
                <div className="bp-stats">
                  <div className="bp-stat"><div className="l">Total {isF ? 'achats' : 'ventes'}</div><div className={`v ${isF ? 'buy' : 'sell'}`}>{fmtAr(sum(txs))}</div></div>
                  <div className="bp-stat"><div className="l">Transactions</div><div className="v">{txs.length}</div></div>
                  <div className="bp-stat"><div className="l">Dernière</div><div className="v" style={{ fontSize: 14 }}>{sorted[0] ? fmtJour(sorted[0].jour) : 'Aucune'}</div></div>
                </div>
              </div>
              <div className="bp-sec">
                <div className="bp-row"><span className="bp-label">Historique des {isF ? 'achats' : 'ventes'}</span><button className="bp-btn primary sm" onClick={() => onNewTx(contact.id)}>+ {isF ? 'Achat' : 'Vente'}</button></div>
                <div className="bp-txs">
                  {sorted.length ? sorted.map((t) => <TxRow key={t.id} t={t} by={who(t.created_by)} onOpen={() => onTx(t)} />) : <p className="bp-hint">Aucune transaction. Chaque {isF ? 'achat' : 'vente'} enregistré apparaît ici automatiquement.</p>}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="bp-sh-foot">
          {contact
            ? <button className={`bp-btn danger sm${armed ? ' armed' : ''}`} onClick={() => { if (armed) onDelete(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000) } }}>{armed ? 'Confirmer la suppression' : 'Supprimer la fiche'}</button>
            : <span />}
          <button className="bp-btn primary" disabled={busy || !dirty || !f.nom.trim()} onClick={save}>{busy ? 'Enregistrement…' : contact ? (dirty ? 'Enregistrer' : 'Enregistré') : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Appeler / SMS / WhatsApp ---------- */
export function CallSheet({ c, onClose }: { c: Contact; onClose: () => void }) {
  const intl = telIntl(c.tel), loc = telLocal(c.tel)
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(loc); setCopied(true) } catch { /* le numéro reste sélectionnable */ } }
  return (
    <div className="bp-ov top" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label="Contacter">
        <div className="bp-sh-head"><h2>{c.nom || 'Contact'}</h2><button className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">
          <div className="bp-bignum">{loc}</div>
          <div className="bp-callgrid">
            <a className="bp-btn primary" href={`tel:+${intl}`}>Appeler</a>
            <a className="bp-btn" href={`sms:+${intl}`}>Message SMS</a>
            <a className="bp-btn" href={`https://wa.me/${intl}`} target="_blank" rel="noopener">WhatsApp</a>
            <button className="bp-btn" onClick={copy}>{copied ? 'Numéro copié' : 'Copier le numéro'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Formulaire achat / vente ---------- */
function TxSheet({ draft: d, setDraft, data, produits, onClose, onSave, onDelete }: {
  draft: TxDraft; setDraft: (d: TxDraft) => void; data: Data; produits: string[]; onClose: () => void; onSave: (d: TxDraft) => Promise<string>; onDelete: (id: string) => void
}) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const isA = d.type === 'achat'
  const people = (isA ? data.fournisseurs : data.clients).slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  const c = people.find((x) => x.id === d.contact_id)
  const cp = contactProduits(c)
  const opts = [...cp, ...produits.filter((p) => !cp.includes(p))]
  const isOther = d.produit === '__autre' || (!!d.produit && !opts.includes(d.produit))
  const set = (p: Partial<TxDraft>) => {
    const n = { ...d, ...p }
    if (('qte' in p || 'prix_u' in p) && !n.manual) { const m = Math.round(toNum(n.qte) * toNum(n.prix_u)); n.montant = m ? String(m) : '' }
    setDraft(n)
  }
  const submit = async () => { setBusy(true); setErr(''); const e = await onSave(isOther && d.produit !== '__autre' ? { ...d, produit: '__autre', autre: d.produit } : d); setBusy(false); if (e) setErr(e); else onClose() }

  return (
    <div className="bp-ov top" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="bp-sheet" role="dialog" aria-modal="true" aria-label="Transaction" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="bp-sh-head">
          <h2>{d.id ? 'Modifier la transaction' : isA ? 'Nouvel achat' : 'Nouvelle vente'}</h2>
          <button type="button" className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button>
        </div>
        <div className="bp-sh-body">
          {!d.id && (
            <div className="bp-seg">
              {(['achat', 'vente'] as TxType[]).map((t) => <button key={t} type="button" className={d.type === t ? `on ${t}` : ''} onClick={() => d.type !== t && set({ type: t, contact_id: '' })}>{t === 'achat' ? 'Achat' : 'Vente'}</button>)}
            </div>
          )}
          <label className="bp-fld">{isA ? 'Fournisseur' : 'Client'}
            <select className="bp-in" value={d.contact_id} onChange={(e) => set({ contact_id: e.target.value })}>
              <option value="">Choisir…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.nom || 'Sans nom'}{(p.quartier || p.region) ? ` · ${p.quartier || p.region}` : ''}</option>)}
              {d.contact_id && !c && <option value={d.contact_id}>{data.txs.find((t) => t.id === d.id)?.contact_nom || 'Contact supprimé'}</option>}
            </select>
          </label>
          {!people.length && <p className="bp-hint">Ajoute d'abord un {isA ? 'fournisseur' : 'client'} dans sa rubrique.</p>}
          <label className="bp-fld">Produit
            <select className="bp-in" value={isOther ? '__autre' : d.produit} onChange={(e) => set({ produit: e.target.value })}>
              <option value="">Choisir…</option>
              {opts.map((p) => <option key={p}>{p}</option>)}
              <option value="__autre">Autre (à préciser)…</option>
            </select>
          </label>
          {isOther && <input className="bp-in" placeholder="Nom du produit" value={d.produit === '__autre' ? d.autre : d.produit} onChange={(e) => set({ produit: '__autre', autre: e.target.value })} aria-label="Nom du produit" />}
          <div className="bp-three">
            <label className="bp-fld">Quantité<input className="bp-in mono" inputMode="decimal" placeholder="0" value={d.qte} onChange={(e) => set({ qte: e.target.value })} /></label>
            <label className="bp-fld">Unité<select className="bp-in" value={d.unite} onChange={(e) => set({ unite: e.target.value })}>{UNITES.map((u) => <option key={u}>{u}</option>)}</select></label>
            <label className="bp-fld">Prix unitaire (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="0" value={d.prix_u} onChange={(e) => set({ prix_u: e.target.value })} /></label>
          </div>
          <label className="bp-fld">Montant total (Ar)<input className="bp-in mono" inputMode="numeric" placeholder="Calculé automatiquement" value={d.montant} onChange={(e) => setDraft({ ...d, montant: e.target.value, manual: e.target.value.trim() !== '' })} /></label>
          <label className="bp-fld">Date<input className="bp-in" type="date" value={d.jour} onChange={(e) => set({ jour: e.target.value })} /></label>
          <PaymentFields value={d.pay} onChange={(pay) => set({ pay })} idPrefix="bpt" />
          <label className="bp-fld">Note<input className="bp-in" placeholder="Qualité, livraison, reste à payer…" value={d.note} onChange={(e) => set({ note: e.target.value })} /></label>
          {err && <p className="bp-err" role="alert">{err}</p>}
        </div>
        <div className="bp-sh-foot">
          {d.id
            ? <button type="button" className={`bp-btn danger sm${armed ? ' armed' : ''}`} onClick={() => { if (armed) onDelete(d.id!); else setArmed(true) }}>{armed ? 'Confirmer' : 'Supprimer'}</button>
            : <span />}
          <button type="submit" className="bp-btn primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Rubrique Transactions ---------- */
function TxTab({ txs, produits, nameOf, who, onNew, onOpen, ready }: { txs: BpTx[]; produits: string[]; nameOf: (t: BpTx) => string; who: (id?: string | null) => string; onNew: (t: TxType) => void; onOpen: (t: BpTx) => void; ready: boolean }) {
  const [type, setType] = useState<'' | TxType>('')
  const [prod, setProd] = useState('')
  const [month, setMonth] = useState('')
  const base = txs.filter((t) => (!prod || t.produit === prod) && (!month || t.jour.startsWith(month)))
  const shown = base.filter((t) => !type || t.type === type)
  const a = sum(base, 'achat'), v = sum(base, 'vente')
  return (
    <section className="bp-panel">
      <div className="bp-row">
        <div className="bp-seg">{([['', 'Tout'], ['achat', 'Achats'], ['vente', 'Ventes']] as const).map(([k, l]) => <button key={k} className={type === k ? `on ${k}` : ''} onClick={() => setType(k)}>{l}</button>)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="bp-btn buy sm" disabled={!ready} onClick={() => onNew('achat')}>+ Achat</button>
          <button className="bp-btn sell sm" disabled={!ready} onClick={() => onNew('vente')}>+ Vente</button>
        </div>
      </div>
      <div className="bp-filters">
        <label className="bp-fld">Produit<select className="bp-in" value={prod} onChange={(e) => setProd(e.target.value)}><option value="">Tous</option>{produits.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="bp-fld">Mois<input className="bp-in" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      </div>
      <div className="bp-stats">
        <div className="bp-stat"><div className="l">Achats</div><div className="v buy">{fmtAr(a)}</div></div>
        <div className="bp-stat"><div className="l">Ventes</div><div className="v sell">{fmtAr(v)}</div></div>
        <div className="bp-stat"><div className="l">Ventes − achats</div><div className={`v ${v - a < 0 ? 'neg' : ''}`}>{fmtAr(v - a)}</div></div>
      </div>
      <div className="bp-txs">
        {shown.length ? shown.map((t) => <TxRow key={t.id} t={t} who={nameOf(t)} by={who(t.created_by)} onOpen={() => onOpen(t)} />)
          : <p className="bp-empty">{txs.length ? 'Aucune transaction pour ces filtres.' : 'Aucune transaction. Ajoute un achat ou une vente avec les boutons ci-dessus.'}</p>}
      </div>
    </section>
  )
}

/* ---------- Bilan par produit ---------- */
function Bilan({ txs }: { txs: BpTx[] }) {
  const [month, setMonth] = useState('')
  type R = { a: number; v: number; qa: Record<string, number>; qv: Record<string, number>; n: number }
  const rows: Record<string, R> = {}
  for (const t of txs) {
    if (month && !t.jour.startsWith(month)) continue
    const r = rows[t.produit] ?? (rows[t.produit] = { a: 0, v: 0, qa: {}, qv: {}, n: 0 })
    if (t.type === 'achat') { r.a += t.montant; r.qa[t.unite] = (r.qa[t.unite] ?? 0) + t.qte } else { r.v += t.montant; r.qv[t.unite] = (r.qv[t.unite] ?? 0) + t.qte }
    r.n++
  }
  const names = [...PRODUITS.filter((p) => rows[p]), ...Object.keys(rows).filter((p) => !PRODUITS.includes(p)).sort()]
  const max = Math.max(1, ...names.map((p) => Math.max(rows[p].a, rows[p].v)))
  const qs = (o: Record<string, number>) => Object.entries(o).map(([u, q]) => `${fmtQ(q)} ${u}`).join(' · ') || '—'
  const ta = names.reduce((s, p) => s + rows[p].a, 0), tv = names.reduce((s, p) => s + rows[p].v, 0)
  return (
    <section className="bp-panel">
      <div className="bp-row"><h2 style={{ fontSize: 20 }}>Bilan par produit</h2><label className="bp-fld" style={{ flex: '0 1 190px' }}>Période<input className="bp-in" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></div>
      <p className="bp-hint">Achats et ventes de chaque légume, calculés automatiquement à partir des transactions. Laisse la période vide pour tout voir.</p>
      {!names.length ? <p className="bp-empty">Aucune transaction {month ? 'sur cette période' : "pour l'instant"}.</p> : (
        <>
          <div className="bp-legend"><span><i style={{ background: 'var(--buy)' }} />Achats</span><span><i style={{ background: 'var(--sell)' }} />Ventes</span></div>
          <div className="bp-bars">
            {names.map((p) => (
              <div className="bp-bar-row" key={p}><span className="nm">{p}</span>
                <div className="bp-bar-pair"><div className="bp-bar b" style={{ width: `${(rows[p].a / max) * 100}%` }} title={`Achats ${fmtAr(rows[p].a)}`} /><div className="bp-bar s" style={{ width: `${(rows[p].v / max) * 100}%` }} title={`Ventes ${fmtAr(rows[p].v)}`} /></div>
              </div>
            ))}
          </div>
          <div className="bp-tblw">
            <table className="bp-tbl">
              <thead><tr><th>Produit</th><th>Achats</th><th>Ventes</th><th>Marge</th><th>Nb</th></tr></thead>
              <tbody>{names.map((p) => { const r = rows[p], mg = r.v - r.a; return (
                <tr key={p}><td>{p}</td><td className="c-buy">{fmtAr(r.a)}<span className="q">{qs(r.qa)}</span></td><td className="c-sell">{fmtAr(r.v)}<span className="q">{qs(r.qv)}</span></td><td className={mg < 0 ? 'c-neg' : ''}>{fmtAr(mg)}</td><td>{r.n}</td></tr>
              ) })}</tbody>
              <tfoot><tr><td>Total</td><td className="c-buy">{fmtAr(ta)}</td><td className="c-sell">{fmtAr(tv)}</td><td className={tv - ta < 0 ? 'c-neg' : ''}>{fmtAr(tv - ta)}</td><td /></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
