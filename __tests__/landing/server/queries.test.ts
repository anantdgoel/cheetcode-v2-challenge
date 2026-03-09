import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    fetchPublicQuery: vi.fn()
  }
})

vi.mock('@/server/convex/client', () => ({
  api: {
    leaderboard: { list: 'leaderboard:list' }
  },
  internal: {
    shiftRuntime: {
      runFinal: 'shiftRuntime:runFinal',
      runProbe: 'shiftRuntime:runProbe'
    }
  },
  asShiftId: (value: string) => value,
  fetchInternalAction: vi.fn(),
  fetchInternalMutation: vi.fn(),
  fetchInternalQuery: vi.fn(),
  fetchPublicQuery: mocks.fetchPublicQuery
}))

describe('getLandingLeaderboard', () => {
  beforeEach(() => {
    mocks.fetchPublicQuery.mockReset()
  })

  it('logs and returns empty array when the leaderboard lookup fails', async () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchPublicQuery.mockRejectedValue(new Error('leaderboard unavailable'))

    const { getLandingLeaderboard } = await import('@/features/landing/server/queries')
    const result = await getLandingLeaderboard()

    expect(result).toEqual([])
    expect(consoleErrorMock).toHaveBeenCalledWith(
      '[landing] failed to load leaderboard',
      expect.objectContaining({ message: 'leaderboard unavailable' })
    )

    consoleErrorMock.mockRestore()
  })

  it('returns normalized leaderboard entries when the lookup succeeds', async () => {
    const entry = {
      publicId: 'public-1',
      github: 'benchmark-agent',
      title: 'chief_operator',
      boardEfficiency: 0.8,
      achievedAt: Date.now(),
      shiftId: 'shift-1',
      connectedCalls: 200,
      totalCalls: 250,
      droppedCalls: 50,
      avgHoldSeconds: 1.2
    }

    mocks.fetchPublicQuery.mockImplementation(async (ref: string) => {
      if (ref === 'leaderboard:list') {
        return {
          page: [entry],
          isDone: true,
          continueCursor: 'cursor_end'
        }
      }
      throw new Error('leaderboard unavailable')
    })

    const { getLandingLeaderboard } = await import('@/features/landing/server/queries')
    const result = await getLandingLeaderboard()

    expect(result).toHaveLength(1)
    expect(result[0].github).toBe('benchmark-agent')
    expect(result[0].title).toBe('chief_operator')
    expect(result[0].boardEfficiency).toBe(0.8)
    expect(result[0].hiddenScore).toBe(0) // normalized from missing field
  })
})
