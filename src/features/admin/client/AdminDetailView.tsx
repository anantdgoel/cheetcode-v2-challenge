'use client'

import { useState } from 'react'
import Image from 'next/image'
import { formatPercent, formatTitle } from '@/core/engine/report'
import type { AdminCandidateDetail, AdminDetailShift } from '@/core/domain/views'
import { useRouter } from 'next/navigation'

function ScoreBar ({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  return (
    <div className='score-bar'>
      <div className='score-bar__fill' style={{ height: `${pct}%` }} />
    </div>
  )
}

function parseSummary (text: string) {
  const sections: Record<string, string> = {}
  let current: string | null = null
  for (const line of text.split('\n')) {
    const match = line.match(/^(SIGNAL|STRENGTHS|CONCERNS|SUMMARY):\s*(.*)$/)
    if (match) {
      current = match[1]
      if (match[2].trim()) sections[current] = match[2].trim()
    } else if (current && line.trim()) {
      sections[current] = sections[current] ? sections[current] + '\n' + line : line
    }
  }
  return sections
}

function ShiftCard ({ shift, index }: { shift: AdminDetailShift; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const finalRun = shift.runs.find((r) => r.kind === 'final' && r.metrics)
  const bestMetrics = finalRun?.metrics ?? shift.runs.find((r) => r.metrics)?.metrics

  return (
    <article className='admin-shift-card'>
      <button
        className='admin-shift-header'
        onClick={() => setExpanded(!expanded)}
        type='button'
      >
        <div className='shift-header-left'>
          <span className='shift-number'>Shift {index + 1}</span>
          <span className={`state-badge state-badge--${shift.state}`}>{shift.state}</span>
          {bestMetrics && (
            <span className='shift-score'>Score: {bestMetrics.hiddenScore}</span>
          )}
        </div>
        <div className='shift-header-right'>
          <span className='shift-date'>{new Date(shift.startedAt).toLocaleDateString()}</span>
          <span className={`chevron ${expanded ? 'chevron--open' : ''}`}>&#9662;</span>
        </div>
      </button>

      {expanded && (
        <div className='admin-shift-body'>
          {shift.runs.map((run) => (
            <div key={run.id} className='admin-run-card'>
              <div className='run-header'>
                <span className='run-kind'>{run.kind}</span>
                <span className='run-trigger'>{run.trigger}</span>
                <span className={`state-badge state-badge--${run.state}`}>{run.state}</span>
                {run.metrics && (
                  <span className='run-score'>
                    {run.metrics.hiddenScore} pts &middot; {formatPercent(run.metrics.efficiency)}
                  </span>
                )}
              </div>

              {run.probeSummary && (
                <div className='run-probe-info'>
                  <span>Probe: {run.probeSummary.probeKind} ({run.probeSummary.deskCondition})</span>
                  {run.probeSummary.failureModes.length > 0 && (
                    <span className='failure-modes'>
                      Failures: {run.probeSummary.failureModes.join(', ')}
                    </span>
                  )}
                </div>
              )}

              {run.chiefOperatorNote && (
                <p className='run-note'>{run.chiefOperatorNote}</p>
              )}

              <details className='policy-details'>
                <summary>View Policy Code</summary>
                <pre className='policy-code'>{run.sourceSnapshot}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function AdminDetailView ({ detail }: { detail: AdminCandidateDetail }) {
  const router = useRouter()
  const [summary, setSummary] = useState(detail.summary?.summary ?? null)
  const [summaryAt, setSummaryAt] = useState(detail.summary?.generatedAt ?? null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const lb = detail.leaderboardRow

  async function handleGenerate () {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/admin/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github: detail.github })
      })
      const data = await res.json() as { summary?: string; throttled?: boolean; error?: string }
      if (!res.ok) {
        setGenError(data.error ?? 'Failed to generate')
        return
      }
      if (data.summary) {
        setSummary(data.summary)
        setSummaryAt(Date.now())
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  // Score progression across shifts
  const scoreHistory = detail.shifts
    .flatMap((s) => s.runs
      .filter((r): r is typeof r & { metrics: NonNullable<typeof r.metrics> } => !!r.metrics)
      .map((r) => ({
        score: r.metrics.hiddenScore,
        efficiency: r.metrics.efficiency,
        shiftStarted: s.startedAt
      })))
    .sort((a, b) => a.shiftStarted - b.shiftStarted)

  const maxScore = Math.max(100, ...scoreHistory.map((s) => s.score))

  return (
    <section className='admin-panel'>
      <button
        className='admin-back'
        onClick={() => router.push('/admin')}
        type='button'
      >
        &larr; Back to Board
      </button>

      {/* Profile Card */}
      <div className='admin-profile'>
        <Image
          className='admin-avatar admin-avatar--lg'
          src={`https://github.com/${detail.github}.png?size=80`}
          alt=''
          width={48}
          height={48}
          unoptimized
        />
        <div className='admin-profile-info'>
          <h1>{detail.github}</h1>
          <div className='admin-profile-meta'>
            {lb && (
              <>
                <span className={`title-badge title-badge--${lb.title}`}>
                  {formatTitle(lb.title)}
                </span>
                <span>Best: {lb.hiddenScore} pts</span>
                <span>{formatPercent(lb.boardEfficiency)} efficiency</span>
              </>
            )}
            <span>{detail.shifts.length} shift{detail.shifts.length !== 1 ? 's' : ''}</span>
            <a
              href={`https://github.com/${detail.github}`}
              target='_blank'
              rel='noopener noreferrer'
              className='admin-github-link'
            >
              GitHub &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      {detail.contact && (
        <div className='admin-contact-card'>
          <p className='eyebrow'>Contact Info</p>
          <p><strong>{detail.contact.name}</strong> &mdash; {detail.contact.email}</p>
          <p className='contact-date'>Submitted {new Date(detail.contact.submittedAt).toLocaleDateString()}</p>
        </div>
      )}

      {/* LLM Summary */}
      <div className='admin-section'>
        <div className='section-heading'>
          <div>
            <p className='eyebrow'>LLM Assessment</p>
          </div>
          <button
            className='app-button app-button--sm'
            onClick={handleGenerate}
            disabled={generating}
            type='button'
          >
            {generating ? 'Generating...' : summary ? 'Regenerate' : 'Generate Summary'}
          </button>
        </div>
        {genError && <p className='admin-error'>{genError}</p>}
        {summary
          ? (
            <div className='admin-summary'>
              {(() => {
                const s = parseSummary(summary)
                return (
                  <>
                    {s.SIGNAL && (
                      <div className='summary-signal'>
                        <span className='eyebrow'>Signal</span>
                        <strong className='summary-signal-value'>{s.SIGNAL}</strong>
                      </div>
                    )}
                    {(['STRENGTHS', 'CONCERNS', 'SUMMARY'] as const).map((key) => s[key] && (
                      <div key={key}>
                        <span className='eyebrow'>{key.charAt(0) + key.slice(1).toLowerCase()}</span>
                        <p className='summary-section-body'>{s[key]}</p>
                      </div>
                    ))}
                  </>
                )
              })()}
              {summaryAt && (
                <p className='summary-date'>Generated {new Date(summaryAt).toLocaleString()}</p>
              )}
            </div>
            )
          : !generating && (
            <p className='empty-state'>No assessment generated yet. Click generate to create one.</p>
            )}
      </div>

      {/* Score Progression */}
      {scoreHistory.length > 1 && (
        <div className='admin-section'>
          <p className='eyebrow'>Score Progression</p>
          <div className='score-progression'>
            {scoreHistory.map((entry, i) => (
              <div key={i} className='score-progression-bar'>
                <ScoreBar score={entry.score} max={maxScore} />
                <span className='score-label'>{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts List */}
      <div className='admin-section'>
        <p className='eyebrow'>Shift History ({detail.shifts.length})</p>
        <div className='admin-shifts-list'>
          {detail.shifts.map((shift, i) => (
            <ShiftCard key={shift.id} shift={shift} index={detail.shifts.length - 1 - i} />
          ))}
        </div>
      </div>
    </section>
  )
}
