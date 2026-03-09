import { describe, expect, it } from 'vitest'
import { expectLiteralValue, normalizeReportRecord, normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import { TITLES } from '@/core/domain/game'

describe('expectLiteralValue', () => {
  it('returns the value when it matches an allowed literal', () => {
    expect(expectLiteralValue('operator', TITLES, 'title')).toBe('operator')
    expect(expectLiteralValue('chief_operator', TITLES, 'title')).toBe('chief_operator')
  })

  it('throws with a descriptive message for invalid values', () => {
    expect(() => expectLiteralValue('invalid_rank', TITLES, 'title'))
      .toThrow('invalid title: invalid_rank')
  })

  it('throws for empty string', () => {
    expect(() => expectLiteralValue('', TITLES, 'title'))
      .toThrow('invalid title: ')
  })
})

describe('normalizeReportRecord', () => {
  const validReport = {
    publicId: 'pub-1',
    shiftId: 'shift-1',
    github: 'testuser',
    title: 'operator' as string,
    boardEfficiency: 0.72,
    connectedCalls: 18,
    totalCalls: 25,
    droppedCalls: 3,
    avgHoldSeconds: 2.1,
    premiumTrunkUsage: 4,
    chiefOperatorNote: 'Good work on the board.',
    achievedAt: 1700000000000,
    hiddenScore: 0.65,
    kind: 'final' as const
  }

  it('validates title and returns typed result', () => {
    const result = normalizeReportRecord(validReport)
    expect(result.title).toBe('operator')
  })

  it('throws for invalid title', () => {
    expect(() => normalizeReportRecord({ ...validReport, title: 'grandmaster' }))
      .toThrow('invalid report.title: grandmaster')
  })

  it('accepts all valid titles', () => {
    for (const title of TITLES) {
      const result = normalizeReportRecord({ ...validReport, title })
      expect(result.title).toBe(title)
    }
  })
})

describe('normalizeLeaderboardRecord', () => {
  const validEntry = {
    github: 'testuser',
    title: 'senior_operator' as string,
    boardEfficiency: 0.85,
    achievedAt: 1700000000000,
    shiftId: 'shift-1',
    publicId: 'pub-1'
  }

  it('normalizes a valid entry with hiddenScore defaulting to 0', () => {
    const result = normalizeLeaderboardRecord(validEntry)
    expect(result.title).toBe('senior_operator')
    expect(result.hiddenScore).toBe(0)
    expect(result.boardEfficiency).toBe(0.85)
  })

  it('preserves explicit hiddenScore', () => {
    const result = normalizeLeaderboardRecord({ ...validEntry, hiddenScore: 0.92 })
    expect(result.hiddenScore).toBe(0.92)
  })

  it('throws for invalid title', () => {
    expect(() => normalizeLeaderboardRecord({ ...validEntry, title: 'master' }))
      .toThrow('invalid leaderboard.title: master')
  })
})
