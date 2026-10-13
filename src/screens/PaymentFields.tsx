import { MOYENS, fmtMm, isMobile, needsDoc } from '../lib/paiement'
import type { PayDetails } from '../lib/paiement'

/** Moyen de paiement + détails exigés par la règle NORD DIGITAL (thème sombre Business Pro). */
export function PaymentFields({ value: p, onChange, idPrefix = 'pay' }: { value: PayDetails; onChange: (p: PayDetails) => void; idPrefix?: string }) {
  const set = (x: Partial<PayDetails>) => onChange({ ...p, ...x })
  const digits = p.mm_numero
  const prefixOk = digits.length < 3 || /^03[234678]/.test(digits)
  return (
    <div className="bp-sec">
      <label className="bp-fld" htmlFor={`${idPrefix}-moyen`}>Moyen de paiement
        <select id={`${idPrefix}-moyen`} className="bp-in" value={p.moyen} onChange={(e) => set({ moyen: e.target.value })}>
          {MOYENS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      {isMobile(p.moyen) && (
        <div className="bp-two">
          <label className="bp-fld" htmlFor={`${idPrefix}-num`}>Numéro {p.moyen}
            <input id={`${idPrefix}-num`} className="bp-in mono" inputMode="numeric" autoComplete="off" placeholder="034 12 345 67"
              value={fmtMm(digits)} onChange={(e) => set({ mm_numero: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            {!prefixOk && <span className="bp-err" style={{ textTransform: 'none', letterSpacing: 0 }}>Doit commencer par 032, 033, 034, 036, 037 ou 038.</span>}
          </label>
          <label className="bp-fld" htmlFor={`${idPrefix}-ref`}>Référence
            <input id={`${idPrefix}-ref`} className="bp-in mono" autoComplete="off" placeholder="Réf. de la transaction" maxLength={80} value={p.reference} onChange={(e) => set({ reference: e.target.value })} />
          </label>
        </div>
      )}
      {needsDoc(p.moyen) && (
        <div className="bp-two">
          <label className="bp-fld" htmlFor={`${idPrefix}-nom`}>Nom {p.moyen === 'Chèque' ? 'sur le chèque' : 'du donneur d\'ordre'}
            <input id={`${idPrefix}-nom`} className="bp-in" autoComplete="off" maxLength={120} value={p.payeur_nom} onChange={(e) => set({ payeur_nom: e.target.value })} />
          </label>
          <label className="bp-fld" htmlFor={`${idPrefix}-doc`}>Numéro {p.moyen === 'Chèque' ? 'du chèque' : 'du virement'}
            <input id={`${idPrefix}-doc`} className="bp-in mono" autoComplete="off" maxLength={60} value={p.num_doc} onChange={(e) => set({ num_doc: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}
