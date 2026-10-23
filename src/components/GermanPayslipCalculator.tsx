import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { Calculator, ArrowRight } from 'lucide-react'

interface GermanPayslipCalculatorProps {
  initialGrossMonthlyCents?: number
  onApplyToAssumptions?: (netMonthlyCents: number) => void
}

export function GermanPayslipCalculator({
  initialGrossMonthlyCents = 450000,
  onApplyToAssumptions,
}: GermanPayslipCalculatorProps) {
  const [grossInput, setGrossInput] = useState((initialGrossMonthlyCents / 100).toFixed(0))
  const [taxClass, setTaxClass] = useState<'1' | '3' | '4' | '5'>('1')
  const [churchTax, setChurchTax] = useState(false)
  const [hasChildren, setHasChildren] = useState(false)
  const [healthZusatz, setHealthZusatz] = useState('1.7')

  const grossMonthly = Math.max(0, parseFloat(grossInput) || 0)
  const grossAnnual = grossMonthly * 12

  // Statutory social security employee contribution rates (2026/German standard)
  const rvRate = 0.093 // Rentenversicherung 9.3%
  const avRate = 0.013 // Arbeitslosenversicherung 1.3%
  const zusatzHalf = (parseFloat(healthZusatz) || 1.7) / 200
  const kvRate = 0.073 + zusatzHalf // Krankenversicherung 7.3% + half Zusatzbeitrag
  const pvRate = hasChildren ? 0.022 : 0.026 // Pflegeversicherung

  const rvCents = Math.round(grossMonthly * rvRate * 100)
  const avCents = Math.round(grossMonthly * avRate * 100)
  const kvCents = Math.round(grossMonthly * kvRate * 100)
  const pvCents = Math.round(grossMonthly * pvRate * 100)
  const totalSocialCents = rvCents + avCents + kvCents + pvCents

  // Approximate progressive German income tax (Lohnsteuer) based on Tax Class
  let estimatedTaxRate = 0.16
  if (taxClass === '1' || taxClass === '4') {
    if (grossAnnual > 70000) estimatedTaxRate = 0.28
    else if (grossAnnual > 55000) estimatedTaxRate = 0.23
    else if (grossAnnual > 40000) estimatedTaxRate = 0.18
    else if (grossAnnual > 25000) estimatedTaxRate = 0.12
    else estimatedTaxRate = 0.05
  } else if (taxClass === '3') {
    estimatedTaxRate = Math.max(0.04, estimatedTaxRate - 0.08)
  } else if (taxClass === '5') {
    estimatedTaxRate = Math.min(0.38, estimatedTaxRate + 0.10)
  }

  const taxCents = Math.round(grossMonthly * estimatedTaxRate * 100)
  const soliCents = grossAnnual > 68000 ? Math.round(taxCents * 0.055) : 0
  const churchCents = churchTax ? Math.round(taxCents * 0.08) : 0
  const totalTaxCents = taxCents + soliCents + churchCents

  const netCents = Math.max(0, Math.round(grossMonthly * 100) - totalSocialCents - totalTaxCents)
  const totalDeductionsCents = totalSocialCents + totalTaxCents
  const effectiveDeductionPct = grossMonthly > 0 ? (totalDeductionsCents / (grossMonthly * 100)) * 100 : 0

  return (
    <div className="payslip-card">
      <div className="payslip-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--positive" style={{ width: 34, height: 34 }}>
            <Calculator size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>German Payslip Reverse-Calculator</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Simulate statutory German salary deductions (Steuerklasse I–V, KV, PV, RV, AV)
            </p>
          </div>
        </div>
      </div>

      <div className="payslip-grid">
        {/* Controls Column */}
        <div className="payslip-controls">
          <label className="payslip-field">
            <span>Gross Monthly Salary (€)</span>
            <input
              type="number"
              step="100"
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              className="payslip-input"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="payslip-field">
              <span>Tax Class (Steuerklasse)</span>
              <select value={taxClass} onChange={(e) => setTaxClass(e.target.value as any)} className="payslip-select">
                <option value="1">Class I (Single)</option>
                <option value="3">Class III (Married Higher)</option>
                <option value="4">Class IV (Married Equal)</option>
                <option value="5">Class V (Married Secondary)</option>
              </select>
            </label>

            <label className="payslip-field">
              <span>KV Zusatzbeitrag (%)</span>
              <input
                type="number"
                step="0.1"
                value={healthZusatz}
                onChange={(e) => setHealthZusatz(e.target.value)}
                className="payslip-input"
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={churchTax} onChange={(e) => setChurchTax(e.target.checked)} />
              Church Tax (Kirchensteuer)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasChildren} onChange={(e) => setHasChildren(e.target.checked)} />
              Has Children (PV bonus)
            </label>
          </div>
        </div>

        {/* Results Column */}
        <div className="payslip-results">
          <div className="payslip-net-box">
            <span className="payslip-net-label">Estimated Net Monthly Salary</span>
            <div className="payslip-net-val">{formatMoney(netCents)}</div>
            <div className="payslip-net-sub">
              Total deductions: {formatMoney(totalDeductionsCents)} ({effectiveDeductionPct.toFixed(1)}%)
            </div>
          </div>

          {/* Breakdown table */}
          <div className="payslip-breakdown">
            <div className="payslip-row">
              <span>Income Tax (Lohnsteuer)</span>
              <strong>{formatMoney(taxCents)}</strong>
            </div>
            {soliCents > 0 && (
              <div className="payslip-row">
                <span>Solidaritätszuschlag</span>
                <strong>{formatMoney(soliCents)}</strong>
              </div>
            )}
            <div className="payslip-row">
              <span>Pension (Rentenversicherung 9.3%)</span>
              <strong>{formatMoney(rvCents)}</strong>
            </div>
            <div className="payslip-row">
              <span>Health (Krankenversicherung {(kvRate * 100).toFixed(2)}%)</span>
              <strong>{formatMoney(kvCents)}</strong>
            </div>
            <div className="payslip-row">
              <span>Care (Pflegeversicherung {(pvRate * 100).toFixed(1)}%)</span>
              <strong>{formatMoney(pvCents)}</strong>
            </div>
            <div className="payslip-row">
              <span>Unemployment (Arbeitslosenversicherung 1.3%)</span>
              <strong>{formatMoney(avCents)}</strong>
            </div>
          </div>

          {onApplyToAssumptions && (
            <button
              type="button"
              className="btn primary"
              style={{ width: '100%', marginTop: 10, fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => onApplyToAssumptions(netCents)}
            >
              Apply {formatMoney(netCents)} to Full-Time Plan Forecast <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
