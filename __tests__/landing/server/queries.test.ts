import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    fetchPublicQuery: vi.fn()
  }
})

vi.mock('@/server/convex/client', () => ({
  api: {
    leaderboard: { getPublic: 'leaderboard:getPublic' }
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

  it('logs and returns an empty list when the leaderboard lookup fails', async () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchPublicQuery.mockRejectedValue(new Error('leaderboard unavailable'))

    const { getLandingLeaderboard } = await import('@/features/landing/server/queries')
    const leaderboard = await getLandingLeaderboard()

    expect(leaderboard).toEqual([])
    expect(consoleErrorMock).toHaveBeenCalledWith(
      '[landing] failed to load leaderboard',
      expect.objectContaining({ message: 'leaderboard unavailable' })
    )

    consoleErrorMock.mockRestore()
  })

  it('returns leaderboard rows when the lookup succeeds', async () => {
    const leaderboard = [
      {
        publicId: 'public-1',
        github: 'benchmark-agent',
        title: 'chief_operator',
        boardEfficiency: 0.8,
        hiddenScore: 0.8,
        achievedAt: Date.now(),
        shiftId: 'shift-1',
        connectedCalls: 200,
        totalCalls: 250,
        droppedCalls: 50,
        avgHoldSeconds: 1.2
      }
    ]

    mocks.fetchPublicQuery.mockImplementation(async (ref: string) => {
      if (ref === 'leaderboard:getPublic') return leaderboard
      throw new Error('leaderboard unavailable')
    })

    const { getLandingLeaderboard } = await import('@/features/landing/server/queries')
    const view = await getLandingLeaderboard()

    expect(view).toEqual(leaderboard)
  })
})
