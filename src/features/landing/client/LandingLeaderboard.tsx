'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { type CSSProperties, type ReactNode } from 'react'
import { formatPercent, formatTitle } from '@/core/engine/report'
import type { LeaderboardEntry } from '@/core/domain/views'

const DISPATCH_PAGE_SIZE = 7
const SECTION_EYEBROW = 'from the archives'
const SECTION_HEADING = 'Prior Operators'

const FADE_SPRING = { type: 'spring' as const, stiffness: 500, damping: 38 }
const FADE_VARIANTS = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }
const VIEWPORT = { once: true, margin: '-60px' as const }

function FadeIn ({ children, delay = 0, className, style }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={FADE_VARIANTS}
      initial='hidden'
      whileInView='visible'
      viewport={VIEWPORT}
      transition={{ ...FADE_SPRING, delay }}
    >
      {children}
    </motion.div>
  )
}

function formatHold (seconds?: number) {
  return seconds == null ? '—' : `${seconds.toFixed(1)}s`
}

function lineNumber (index: number) {
  return String(index + 1).padStart(2, '0')
}

function connectedDisplay (e: LeaderboardEntry) {
  return e.connectedCalls != null && e.totalCalls != null ? `${e.connectedCalls} / ${e.totalCalls}` : '—'
}

function efficiencyFillClass (index: number, title: LeaderboardEntry['title']) {
  if (title === 'off_the_board') return 'line-efficiency__fill--muted'
  if (index === 0) return 'line-efficiency__fill--gold'
  return ''
}

function LineTile ({ entry, index }: { entry?: LeaderboardEntry; index: number }) {
  if (!entry) {
    return (
      <div className='line-tile line-tile--vacant'>
        <div className='line-tile__header'>
          <div className='line-tile__indicator'>
            <div className='line-dot' />
            <span className='line-number'>Line {lineNumber(index)}</span>
          </div>
        </div>
        <p className='line-callsign'>No signal</p>
        <div className='line-stats'>
          <div className='line-stats__row'>
            {(['Connected', 'Dropped', 'Avg Hold'] as const).map((label) => (
              <div key={label} className='line-stat'>
                <span className='line-stat__label'>{label}</span>
                <span className='line-stat__value'>—</span>
              </div>
            ))}
          </div>
          <div className='line-efficiency'>
            <div className='line-efficiency__header'>
              <span className='line-efficiency__label'>Board Efficiency</span>
            </div>
            <div className='line-efficiency__track' />
          </div>
        </div>
      </div>
    )
  }

  const isTop = index === 0
  const isMuted = entry.title === 'off_the_board'

  return (
    <Link href={`/report/${entry.publicId}`} className={`line-tile${isTop ? ' line-tile--top' : ''}`}>
      <div className='line-tile__header'>
        <div className='line-tile__indicator'>
          <div className={`line-dot${isTop ? ' line-dot--gold' : ''}`} />
          <span className={`line-number${isTop ? ' line-number--gold' : ''}`}>Line {lineNumber(index)}</span>
        </div>
        <span className='line-classification'>{formatTitle(entry.title)}</span>
      </div>
      <p className='line-callsign'>{entry.github}</p>
      <div className='line-stats'>
        <div className='line-stats__row'>
          <div className='line-stat'>
            <span className='line-stat__label'>Connected</span>
            <span className={`line-stat__value${isMuted ? ' line-stat__value--muted' : ''}`}>{connectedDisplay(entry)}</span>
          </div>
          <div className='line-stat'>
            <span className='line-stat__label'>Dropped</span>
            <span className={`line-stat__value${isMuted ? ' line-stat__value--muted' : ''}`}>{entry.droppedCalls ?? '—'}</span>
          </div>
          <div className='line-stat'>
            <span className='line-stat__label'>Avg Hold</span>
            <span className={`line-stat__value${isMuted ? ' line-stat__value--muted' : ''}`}>{formatHold(entry.avgHoldSeconds)}</span>
          </div>
        </div>
        <div className='line-efficiency'>
          <div className='line-efficiency__header'>
            <span className='line-efficiency__label'>Board Efficiency</span>
            <span className={`line-efficiency__value${isTop ? ' line-efficiency__value--gold' : ''}`}>
              {formatPercent(entry.boardEfficiency)}
            </span>
          </div>
          <div className='line-efficiency__track'>
            <div
              className={`line-efficiency__fill ${efficiencyFillClass(index, entry.title)}`}
              style={{ width: `${Math.round(entry.boardEfficiency * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

/* ─── Suspense skeleton (same copy, no data dependency) ─── */

export function LandingLeaderboardSkeleton () {
  return (
    <section className='leaderboard-card' aria-busy='true'>
      <div className='leaderboard-card__header'>
        <p className='eyebrow'>{SECTION_EYEBROW}</p>
        <h2 className='shift-reports-heading'>{SECTION_HEADING}</h2>
      </div>
      <p className='console-supervisor__empty'>Loading leaderboard...</p>
    </section>
  )
}

export function LandingLeaderboard ({
  topEntries,
  dispatchEntries,
  page,
  totalPages,
  totalEntries,
  canPrev,
  canNext,
  onPrev,
  onNext
}: {
  topEntries: LeaderboardEntry[];
  dispatchEntries: LeaderboardEntry[];
  page: number;
  totalPages: number | null;
  totalEntries: number | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const showStart = 4 + page * DISPATCH_PAGE_SIZE
  const showEnd = showStart + dispatchEntries.length - 1

  return (
    <div className='leaderboard-card'>

      <FadeIn className='leaderboard-card__header'>
        <p className='eyebrow'>{SECTION_EYEBROW}</p>
        <h2 className='shift-reports-heading'>{SECTION_HEADING}</h2>
      </FadeIn>

      <div className='line-tiles'>
        {[0, 1, 2].map((i) => (
          <FadeIn key={topEntries[i]?.publicId ?? `slot-${i}`} delay={0.1 + i * 0.1} style={{ flex: 1, minWidth: 0 }}>
            <LineTile entry={topEntries[i]} index={i} />
          </FadeIn>
        ))}
      </div>

      {dispatchEntries.length > 0 && (
        <div className='dispatch-log'>
          <FadeIn delay={0.4} className='dispatch-log__head'>
            <span className='dispatch-log__col--line'>Line</span>
            <span className='dispatch-log__col--callsign'>Callsign</span>
            <span className='dispatch-log__col--class'>Classification</span>
            <span className='dispatch-log__col--spacer' />
            <span className='dispatch-log__col--connected'>Connected</span>
            <span className='dispatch-log__col--efficiency'>Efficiency</span>
          </FadeIn>

          {dispatchEntries.map((entry, i) => {
            const globalIndex = showStart - 1 + i
            const isOff = entry.title === 'off_the_board'
            const pct = Math.round(entry.boardEfficiency * 100)

            return (
              <FadeIn key={entry.publicId} delay={0.55 + Math.min(i, 6) * 0.07}>
                <Link
                  href={`/report/${entry.publicId}`}
                  className={`dispatch-log__row${isOff ? ' dispatch-log__row--muted' : ''}`}
                >
                  <span className='dispatch-log__col--line'>{lineNumber(globalIndex)}</span>
                  <span className='dispatch-log__col--callsign'>{entry.github}</span>
                  <span className='dispatch-log__col--class'>{formatTitle(entry.title)}</span>
                  <span className='dispatch-log__col--spacer' />
                  <span className='dispatch-log__col--connected'>{connectedDisplay(entry)}</span>
                  <div className='dispatch-log__col--efficiency'>
                    <div className='dispatch-log__bar-track'>
                      <div
                        className='dispatch-log__bar-fill'
                        style={{ backgroundColor: isOff ? 'rgba(26,20,16,0.12)' : 'var(--accent-bar)', width: `${pct}%` }}
                      />
                    </div>
                    <span className='dispatch-log__pct'>{formatPercent(entry.boardEfficiency)}</span>
                  </div>
                </Link>
              </FadeIn>
            )
          })}

          <div className='dispatch-log__pagination'>
            <span className='dispatch-log__pagination-info'>
              Showing {showStart}–{showEnd}{totalEntries != null ? ` of ${totalEntries}` : ''}
            </span>
            <div className='dispatch-log__pagination-controls'>
              <button type='button' className='dispatch-log__pagination-btn' disabled={!canPrev} onClick={onPrev}>
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <path d='M8.5 3.5L5 7L8.5 10.5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                </svg>
              </button>
              <span className='dispatch-log__pagination-label'>
                Page {page + 1}{totalPages != null ? ` of ${totalPages}` : ''}
              </span>
              <button type='button' className='dispatch-log__pagination-btn' disabled={!canNext} onClick={onNext}>
                <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                  <path d='M5.5 3.5L9 7L5.5 10.5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
