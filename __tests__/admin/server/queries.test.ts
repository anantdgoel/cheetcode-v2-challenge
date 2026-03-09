import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    fetchInternalQuery: vi.fn(),
    fetchInternalAction: vi.fn()
  }
})

vi.mock('@/server/convex/client', () => ({
  api: {},
  internal: {
    admin: {
      getCandidates: 'admin:getCandidates',
      getCandidateDetail: 'admin:getCandidateDetail'
    },
    adminAgent: {
      generateSummary: 'adminAgent:generateSummary'
    },
    reports: {
      adminLookup: 'reports:adminLookup'
    }
  },
  asShiftId: (value: string) => value,
  fetchInternalQuery: mocks.fetchInternalQuery,
  fetchInternalAction: mocks.fetchInternalAction,
  fetchInternalMutation: vi.fn(),
  fetchPublicQuery: vi.fn()
}))

const makeCandidateRow = (github: string, score = 50) => ({
  github,
  title: 'operator' as const,
  hiddenScore: score,
  boardEfficiency: 0.65,
  achievedAt: Date.now(),
  publicId: `pub_${github}`,
  shiftCount: 2,
  hasContact: false,
  lastActive: Date.now()
})

describe('admin server queries', () => {
  beforeEach(() => {
    mocks.fetchInternalQuery.mockReset()
    mocks.fetchInternalAction.mockReset()
  })

  describe('getCandidates', () => {
    it('passes cursor and pageSize to internal query', async () => {
      const mockPage = {
        rows: [makeCandidateRow('alice', 80), makeCandidateRow('bob', 60)],
        totalEntries: 2,
        nextCursor: null,
        isDone: true
      }
      mocks.fetchInternalQuery.mockResolvedValue(mockPage)

      const { getCandidates } = await import('@/features/admin/server/queries')
      const result = await getCandidates(null, 0)

      expect(mocks.fetchInternalQuery).toHaveBeenCalledWith(
        'admin:getCandidates',
        { pageSize: 25 }
      )
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].github).toBe('alice')
      expect(result.totalEntries).toBe(2)
      expect(result.startRank).toBe(0)
    })

    it('passes cursor for subsequent pages', async () => {
      mocks.fetchInternalQuery.mockResolvedValue({
        rows: [],
        totalEntries: 50,
        nextCursor: null,
        isDone: true
      })

      const { getCandidates } = await import('@/features/admin/server/queries')
      await getCandidates('cursor_abc', 25)

      expect(mocks.fetchInternalQuery).toHaveBeenCalledWith(
        'admin:getCandidates',
        { cursor: 'cursor_abc', pageSize: 25 }
      )
    })
  })

  describe('getCandidateDetail', () => {
    it('queries with github username', async () => {
      const mockDetail = {
        github: 'alice',
        leaderboardRow: null,
        shifts: [],
        contact: null,
        summary: null
      }
      mocks.fetchInternalQuery.mockResolvedValue(mockDetail)

      const { getCandidateDetail } = await import('@/features/admin/server/queries')
      const result = await getCandidateDetail('alice')

      expect(mocks.fetchInternalQuery).toHaveBeenCalledWith(
        'admin:getCandidateDetail',
        { github: 'alice' }
      )
      expect(result.github).toBe('alice')
    })

    it('returns full detail shape with shifts and summary', async () => {
      const mockDetail = {
        github: 'bob',
        leaderboardRow: {
          github: 'bob',
          title: 'senior_operator',
          boardEfficiency: 0.78,
          hiddenScore: 72,
          achievedAt: Date.now(),
          publicId: 'pub_bob',
          shiftId: 'shift_1'
        },
        shifts: [{
          id: 'shift_1',
          state: 'completed',
          startedAt: Date.now() - 86400000,
          completedAt: Date.now() - 82800000,
          expiresAt: Date.now() - 79200000,
          runs: [{
            id: 'run_1',
            kind: 'fit',
            trigger: 'manual',
            state: 'completed',
            acceptedAt: Date.now() - 85000000,
            sourceSnapshot: 'function route() { return lines[0]; }',
            metrics: {
              connectedCalls: 100,
              totalCalls: 120,
              droppedCalls: 20,
              avgHoldSeconds: 2.1,
              totalHoldSeconds: 210,
              premiumUsageCount: 5,
              premiumUsageRate: 0.04,
              trunkMisuseCount: 1,
              efficiency: 0.78,
              hiddenScore: 72
            }
          }]
        }],
        contact: { name: 'Bob', email: 'bob@example.com', submittedAt: Date.now() },
        summary: { summary: 'SIGNAL: HIRE', generatedAt: Date.now() }
      }
      mocks.fetchInternalQuery.mockResolvedValue(mockDetail)

      const { getCandidateDetail } = await import('@/features/admin/server/queries')
      const result = await getCandidateDetail('bob')

      expect(result.leaderboardRow).not.toBeNull()
      expect(result.shifts).toHaveLength(1)
      expect(result.shifts[0].runs).toHaveLength(1)
      expect(result.contact?.email).toBe('bob@example.com')
      expect(result.summary?.summary).toBe('SIGNAL: HIRE')
    })
  })

  describe('triggerSummaryGeneration', () => {
    it('calls internal action with github', async () => {
      mocks.fetchInternalAction.mockResolvedValue({
        throttled: false,
        summary: 'SIGNAL: LEAN HIRE'
      })

      const { triggerSummaryGeneration } = await import('@/features/admin/server/queries')
      const result = await triggerSummaryGeneration('alice')

      expect(mocks.fetchInternalAction).toHaveBeenCalledWith(
        'adminAgent:generateSummary',
        { github: 'alice' }
      )
      expect(result.summary).toBe('SIGNAL: LEAN HIRE')
    })

    it('propagates errors from the action', async () => {
      mocks.fetchInternalAction.mockRejectedValue(new Error('API key missing'))

      const { triggerSummaryGeneration } = await import('@/features/admin/server/queries')

      await expect(triggerSummaryGeneration('alice')).rejects.toThrow('API key missing')
    })
  })
})
