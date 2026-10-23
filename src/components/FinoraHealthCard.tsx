import { formatMoney } from '../lib/money'

interface FinoraHealthCardProps {
  score: number
  runwayMonths: number | null
  savingsCents: number
}

export function FinoraHealthCard({
  score,
  runwayMonths,
  savingsCents,
}: FinoraHealthCardProps) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)))
  const displayStatus = boundedScore >= 80 ? 'Optimal' : boundedScore >= 60 ? 'Healthy' : 'Attention'
  const isSurplus = savingsCents >= 0

  const runwayText =
    runwayMonths !== null && runwayMonths > 0
      ? `Runway buffer is healthy for ${runwayMonths.toFixed(1)} months.`
      : isSurplus
        ? `Surplus buffer is positive at ${formatMoney(savingsCents)}.`
        : `Deficit buffer of ${formatMoney(Math.abs(savingsCents))}. Adjust spending targets.`

  return (
    <div className="finora-health-card">
      <div className="finora-health-card__top">
        <span className="finora-health-card__tag">Health Index</span>
        <span className={`finora-health-card__status finora-health-card__status--${displayStatus.toLowerCase()}`}>
          {displayStatus}
        </span>
      </div>

      <div className="finora-health-card__score-wrap">
        <span className="finora-health-card__score">{boundedScore}</span>
        <span className="finora-health-card__score-max">/ 100</span>
      </div>

      <div className="finora-health-card__track">
        <div
          className="finora-health-card__bar"
          style={{ width: `${boundedScore}%` }}
        />
      </div>

      <p className="finora-health-card__hint">{runwayText}</p>
    </div>
  )
}
