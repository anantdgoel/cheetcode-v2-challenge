import { describe, expect, it } from 'vitest'
import { toPublicLeaderboard } from '../convex/leaderboard'

describe('public leaderboard ordering', () => {
  it('keeps the earliest achievers when a tie group is larger than 100', () => {
    const entries = Array.from({ length: 120 }, (_, index) => ({
      github: `operator-${index}`,
      title: 'chief_operator' as const,
      hiddenScore: 0.9,
      boardEfficiency: 0.8,
      achievedAt: 1_000 + index,
      shiftId: `shift-${index}`,
      publicId: `report-${index}`
    }))

    const leaderboard = toPublicLeaderboard(entries)

    expect(leaderboard).toHaveLength(100)
    expect(leaderboard[0]?.github).toBe('operator-0')
    expect(leaderboard[99]?.github).toBe('operator-99')
    expect(leaderboard.some((entry) => entry.github === 'operator-119')).toBe(false)
  })

  it('still prioritizes score and board efficiency before the achievedAt tie breaker', () => {
    const leaderboard = toPublicLeaderboard([
      {
        github: 'late-winner',
        title: 'chief_operator' as const,
        hiddenScore: 0.95,
        boardEfficiency: 0.75,
        achievedAt: 2_000,
        shiftId: 'shift-1',
        publicId: 'report-1'
      },
      {
        github: 'better-efficiency',
        title: 'chief_operator' as const,
        hiddenScore: 0.95,
        boardEfficiency: 0.8,
        achievedAt: 3_000,
        shiftId: 'shift-2',
        publicId: 'report-2'
      },
      {
        github: 'earlier-tie',
        title: 'chief_operator' as const,
        hiddenScore: 0.9,
        boardEfficiency: 0.8,
        achievedAt: 1_000,
        shiftId: 'shift-3',
        publicId: 'report-3'
      }
    ])

    expect(leaderboard.map((entry) => entry.github)).toEqual([
      'better-efficiency',
      'late-winner',
      'earlier-tie'
    ])
  })
})
