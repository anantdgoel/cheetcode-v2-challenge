import type { ReportView } from '@/core/domain/views'
import { getTitlePresentation } from '@/core/domain/title-presentation'
import { formatPercent, formatTitle } from '@/core/engine/report'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const

function formatLongDate (timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function ReportCard ({ publicId, report }: { publicId: string; report: ReportView }) {
  const { isTop, line, tone } = getTitlePresentation(report.title)
  const barClass = isTop
    ? 'report-card__bar-fill--gold'
    : report.title === 'off_the_board'
      ? 'report-card__bar-fill--muted'
      : 'report-card__bar-fill--accent'
  const metrics = [
    { label: 'Connected', value: `${report.connectedCalls} / ${report.totalCalls}` },
    {
      label: 'Dropped',
      modifier: 'report-card__metric-value--danger',
      value: String(report.droppedCalls)
    },
    { label: 'Avg Hold', value: `${report.avgHoldSeconds.toFixed(1)}s` },
    {
      label: 'Premium Trunk',
      modifier: 'report-card__metric-value--gold',
      value: `${report.premiumTrunkUsage} uses`
    }
  ]

  return (
    <section className='report-card'>
      <div className='report-card__letterhead'>
        <div>
          <div className='report-card__letterhead-brand'>Firecrawl</div>
          <div className='report-card__letterhead-sub'>Exchange Supervisory Division</div>
        </div>
        <div className='report-card__letterhead-form'>
          Form SR-57
          <span>Supervisor&apos;s Shift Report</span>
        </div>
      </div>

      <div className='report-card__identity-block'>
        <div className='report-card__callsign-area'>
          <p className='report-card__eyebrow'>Operator on Record</p>
          <h1 className='report-card__callsign'>{report.github}</h1>
          <div className='report-card__pills'>
            <span className={`report-card__pill report-card__pill--line report-card__pill--${tone}`}>
              Line {line}
            </span>
          </div>
        </div>

        <div className={`report-card__badge report-card__badge--${tone}`}>
          <span className='report-card__badge-label'>Classification</span>
          <h2 className='report-card__badge-title'>{formatTitle(report.title)}</h2>
          <div className='report-card__badge-insignia'>
            {[0, 1, 2].map((index) => (
              <span key={index} className={`report-card__badge-stripe report-card__badge-stripe--${tone}`} />
            ))}
          </div>
          <span className={`report-card__badge-certified report-card__badge-certified--${tone}`}>
            Board Certified
          </span>
        </div>
      </div>

      <div className='report-card__efficiency'>
        <div className='report-card__efficiency-left'>
          <p className='report-card__eyebrow'>Board Efficiency</p>
          <p className='report-card__efficiency-value'>{formatPercent(report.boardEfficiency)}</p>
          <p className='report-card__eyebrow report-card__eyebrow--offset'>
            Calls Connected / Attempted
          </p>
        </div>
        <div className='report-card__efficiency-right'>
          <span className='report-card__efficiency-label report-card__calls-label'>
            {report.connectedCalls} of {report.totalCalls} Calls
          </span>
          <div className='report-card__bar-track'>
            <div
              className={`report-card__bar-fill ${barClass}`}
              style={{ width: `${(report.boardEfficiency * 100).toFixed(1)}%` }}
            />
          </div>
          <span className='report-card__efficiency-label report-card__dropped-label'>
            {report.droppedCalls} Dropped
          </span>
        </div>
      </div>

      <div className='report-card__metrics-row'>
        {metrics.map((metric) => (
          <div key={metric.label} className='report-card__metric'>
            <span className='report-card__metric-label'>{metric.label}</span>
            <span className={`report-card__metric-value${metric.modifier ? ` ${metric.modifier}` : ''}`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      <div className='report-card__note'>
        <div className='report-card__note-header'>
          <p className='report-card__eyebrow'>Supervisor&apos;s Note</p>
          <span className='report-card__note-date'>{formatLongDate(report.achievedAt)}</span>
        </div>
        <div className='report-card__note-rule' />
        <p className='report-card__note-body'>{report.chiefOperatorNote}</p>
        <div className='report-card__signature'>
          <div className='report-card__signature-line' />
          <span className='report-card__signature-label'>Supervisor, Firecrawl Exchange</span>
        </div>
      </div>

      <div className='report-card__footer'>
        <div className='report-card__dots'>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className='report-card__dot' />
          ))}
        </div>
        <span>Firecrawl Exchange &middot; Central Office &middot; Confidential</span>
        <span>SHIFT: {publicId.slice(-6).toUpperCase()}</span>
      </div>
    </section>
  )
}
