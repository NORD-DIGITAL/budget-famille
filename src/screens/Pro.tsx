import { useEffect, useState } from 'react'
import { ArrowLeft, Briefcase, ChevronRight, Leaf, MessageCircle, NotebookPen, Rocket, Sparkles, X } from 'lucide-react'
import './business.css'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data'
import { useBackHandler } from '../lib/back'
import { userInfo } from '../lib/prefs'
import { APP_LABEL } from '../lib/version'
import { addDays, hm, loadWork, occurrences, ymd } from '../lib/travail'
import { fmtAr, loadBusiness } from '../lib/business'
import { ADMIN_WHATSAPP_LOCAL, usePro, whatsappAdmin } from '../lib/pro'
import type { Projet } from '../lib/pro'
import { TravailPage } from './Travail'
import { LegumesPage } from './Business'
import { NordDigitalPage, loadNd, ndStats } from './NordDigital'

export type ProView = 'hub' | 'travail' | 'legumes' | 'nd'

/* ---------- Résumés (hub et carte d'accueil) ---------- */
type Summary = { work: { next: string; todo: number } | null; legumes: { a: number; v: number; saison: number } | null; nd: { enCours: number; reste: number } | null }

function useSummary(projets: Projet[]) {
  const [s, setS] = useState<Summary | null>(null)
  const key = projets.join(',')
  useEffect(() => {
    let alive = true
    const has = (p: Projet) => key.split(',').includes(p)
    Promise.all([loadWork(), has('legumes') ? loadBusiness() : null, has('nord-digital') ? loadNd() : null]).then(([w, b, n]) => {
      if (!alive) return
      const now = new Date(), today = ymd(now), m = today.slice(0, 7), mo = now.getMonth() + 1
      let work: Summary['work'] = null
      if (!w.missing && !w.error) {
        const next = occurrences(w.events, today, 7).filter((o) => o.end.getTime() > now.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
        const when = next ? (next.dayKey === today ? (next.ev.at_time ? hm(next.start) : "Aujourd'hui") : next.dayKey === addDays(today, 1) ? `Demain${next.ev.at_time ? ` ${hm(next.start)}` : ''}` : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(next.start)) : ''
        work = { next: next ? `${when} · ${next.ev.title}` : '', todo: w.tasks.filter((t) => !t.done && t.due && t.due <= today).length }
      }
      const legumes = b && !b.missing && !b.error ? {
        a: b.txs.filter((t) => t.type === 'achat' && t.jour.startsWith(m)).reduce((x, t) => x + t.montant, 0),
        v: b.txs.filter((t) => t.type === 'vente' && t.jour.startsWith(m)).reduce((x, t) => x + t.montant, 0),
        saison: b.fournisseurs.filter((f) => (f.mois ?? []).includes(mo)).length,
      } : null
      const nd = n && !n.missing && !n.error ? (({ enCours, reste }) => ({ enCours, reste }))(ndStats(n.rows)) : null
      setS({ work, legumes, nd })
    })
    return () => { alive = false }
  }, [key])
  return s
}

/* ---------- Espace PRO (onglet « Business Pro ») ---------- */
export function ProPage({ onBack, initial = 'hub' }: { onBack?: () => void; initial?: ProView }) {
  const { session } = useData()
  const pro = usePro(session)
  const [view, setView] = useState<ProView>(initial)
  const [ask, setAsk] = useState(false)
  const back = initial === 'hub' ? () => setView('hub') : onBack ?? (() => setView('hub'))
  useBackHandler(view !== 'hub' && initial === 'hub', () => setView('hub'))
  const s = useSummary(pro.projets)
  const has = (p: Projet) => pro.projets.includes(p)

  if (view === 'legumes' && has('legumes')) return <LegumesPage onBack={back} />
  if (view === 'nd' && has('nord-digital')) return <NordDigitalPage onBack={back} />
  if (view === 'travail') return (
    <div className="bp bp-ct">
      <header className="bp-top pt-safe">
        <button className="bp-iconbtn" aria-label="Retour" onClick={back}><ArrowLeft size={24} strokeWidth={1.8} /></button>
        <h1>Carnet de travail</h1>
      </header>
      <TravailPage />
    </div>
  )

  return (
    <div className="bp">
      <header className="bp-top pt-safe">
        {onBack && <button className="bp-iconbtn" aria-label="Retour" onClick={onBack}><ArrowLeft size={24} strokeWidth={1.8} /></button>}
        <h1 style={onBack ? undefined : { paddingLeft: 4 }}>Business Pro</h1>
        <span className="bp-pro-tag">PRO</span>
      </header>

      <div className="bp-projs">
        <button className="bp-proj" onClick={() => setView('travail')}>
          <span className="ic"><NotebookPen size={22} strokeWidth={1.8} /></span>
          <span className="tx"><b>Carnet de travail</b>
            <small>{s?.work ? (s.work.next || 'Aucun rendez-vous cette semaine') + (s.work.todo ? ` · ${s.work.todo} tâche${s.work.todo > 1 ? 's' : ''} à faire` : '') : 'Tes rendez-vous, tâches et notes'}</small></span>
          <ChevronRight size={18} />
        </button>
        {has('legumes') && (
          <button className="bp-proj" onClick={() => setView('legumes')}>
            <span className="ic leaf"><Leaf size={22} strokeWidth={1.8} /></span>
            <span className="tx"><b>Projet Légumes</b>
              <small>{s?.legumes ? <>Achats <i className="c-buy">{fmtAr(s.legumes.a)}</i> · Ventes <i className="c-sell">{fmtAr(s.legumes.v)}</i> ce mois</> : 'Fournisseurs, clients, achats et ventes'}</small></span>
            <ChevronRight size={18} />
          </button>
        )}
        {has('nord-digital') && (
          <button className="bp-proj" onClick={() => setView('nd')}>
            <span className="ic nd"><Rocket size={22} strokeWidth={1.8} /></span>
            <span className="tx"><b>Projet NORD DIGITAL</b>
              <small>{s?.nd ? <>{s.nd.enCours} en cours · reste <i className="c-sell">{fmtAr(s.nd.reste)}</i> à encaisser</> : 'Suivi des projets clients'}</small></span>
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <section className="bp-panel" style={{ marginTop: 14 }}>
        <div className="bp-row"><h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} /> Autres fonctions à la demande</h2></div>
        <p className="bp-hint">Il te manque un outil pour ton activité (stock, rendez-vous clients, devis…) ? Propose-le : NORD DIGITAL peut l'ajouter à ton espace PRO.</p>
        <div className="bp-two">
          <button className="bp-btn primary" onClick={() => setAsk(true)}>Proposer une fonction</button>
          <a className="bp-btn" href={whatsappAdmin("Bonjour NORD DIGITAL, je voudrais une fonction en plus dans mon espace PRO Budget.Go.Family : ")} target="_blank" rel="noopener"><MessageCircle size={18} /> WhatsApp de l'admin</a>
        </div>
        <p className="bp-hint">WhatsApp : {ADMIN_WHATSAPP_LOCAL}</p>
      </section>

      <p className="bp-foot">BY <b>NORD DIGITAL</b></p>
      {ask && <AskSheet onClose={() => setAsk(false)} />}
    </div>
  )
}

function AskSheet({ onClose }: { onClose: () => void }) {
  const { session, profile } = useData()
  const me = userInfo(session, profile)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  useBackHandler(true, onClose)
  const send = async () => {
    setState('busy')
    const { error } = await supabase.from('feedback').insert({ kind: 'amelioration', message: `[PRO] Fonction demandée : ${text.trim()}`, sender_name: me.name, app_version: APP_LABEL })
    setState(error ? 'err' : 'ok')
  }
  return (
    <div className="bp-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label="Proposer une fonction">
        <div className="bp-sh-head"><h2>Proposer une fonction</h2><button className="bp-iconbtn" aria-label="Fermer" onClick={onClose}><X size={22} /></button></div>
        <div className="bp-sh-body">
          {state === 'ok' ? <p className="bp-hint" style={{ color: 'var(--sell)', fontSize: 15 }}>Merci ! Ta demande est bien arrivée chez NORD DIGITAL. Tu recevras la réponse dans ta boîte de réception.</p> : (
            <>
              <label className="bp-fld">Ta demande<textarea className="bp-in" autoFocus placeholder="Ex. suivre le stock de ma boutique, envoyer des devis à mes clients…" value={text} onChange={(e) => setText(e.target.value)} /></label>
              {state === 'err' && <p className="bp-err">Envoi impossible. Vérifie ta connexion, ou écris directement sur WhatsApp.</p>}
            </>
          )}
        </div>
        <div className="bp-sh-foot">
          <a className="bp-btn sm" href={whatsappAdmin(`Bonjour NORD DIGITAL, je voudrais une fonction en plus dans mon espace PRO : ${text.trim()}`)} target="_blank" rel="noopener"><MessageCircle size={16} /> Plutôt sur WhatsApp</a>
          {state === 'ok' ? <button className="bp-btn primary" onClick={onClose}>Fermer</button>
            : <button className="bp-btn primary" disabled={state === 'busy' || text.trim().length < 3} onClick={send}>{state === 'busy' ? 'Envoi…' : 'Envoyer'}</button>}
        </div>
      </div>
    </div>
  )
}

/* ---------- Carte de l'accueil : section PRO (sombre, comme Business Pro) ---------- */
export function ProGlance({ onOpen }: { onOpen: () => void }) {
  const { session } = useData()
  const pro = usePro(session)
  const s = useSummary(pro.projets)
  const has = (p: Projet) => pro.projets.includes(p)
  return (
    <button className="bp-glance" onClick={onOpen}>
      <span className="h"><Briefcase size={20} strokeWidth={1.8} /><b>Business Pro</b><small>Espace PRO</small><ChevronRight size={18} /></span>
      <span className="line"><NotebookPen size={16} strokeWidth={1.8} />
        <span>{s?.work ? (s.work.next || 'Aucun rendez-vous cette semaine') : 'Carnet de travail'}</span>
        {!!s?.work?.todo && <em>{s.work.todo} tâche{s.work.todo > 1 ? 's' : ''}</em>}
      </span>
      {(has('legumes') || has('nord-digital')) && (
        <span className="g">
          {has('legumes') && <span>Achats légumes<b className="buy">{s?.legumes ? fmtAr(s.legumes.a) : '…'}</b></span>}
          {has('legumes') && <span>Ventes légumes<b className="sell">{s?.legumes ? fmtAr(s.legumes.v) : '…'}</b></span>}
          {has('nord-digital') && <span>Projets ND<b className="leaf">{s?.nd ? `${s.nd.enCours} en cours` : '…'}</b></span>}
        </span>
      )}
    </button>
  )
}
