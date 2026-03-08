import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShiftServiceError } from '@/features/shift/domain/errors'
import { createProbeSummary, createStoredShiftRecord } from '../helpers/shift-fixtures'

const mutationMock = vi.fn()
const queryMock = vi.fn()
const actionMock = vi.fn()
const validatePolicyMock = vi.fn()

vi.mock('@/server/convex/client', () => ({
  internal: {
    sessions: {
      getOwnedShift: 'sessions:getOwnedShift',
      getCurrentOwned: 'sessions:getCurrentOwned',
      saveDraft: 'sessions:saveDraft',
      storeValidation: 'sessions:storeValidation',
      acceptRun: 'sessions:acceptRun',
      completeProbeRun: 'sessions:completeProbeRun',
      completeFinalRun: 'sessions:completeFinalRun',
      recordArtifactFetch: 'sessions:recordArtifactFetch',
      markExpiredNoResult: 'sessions:markExpiredNoResult',
      start: 'sessions:start'
    },
    leaderboard: {
      getPublic: 'leaderboard:getPublic',
      getForGithub: 'leaderboard:getForGithub',
      upsertBest: 'leaderboard:upsertBest'
    },
    reports: {
      getReportByPublicId: 'reports:getReportByPublicId',
      upsertReport: 'reports:upsertReport',
      adminLookup: 'reports:adminLookup'
    },
    shiftResolver: {
      resolveShift: 'shiftResolver:resolveShift'
    },
    shiftRuntime: {
      runProbe: 'shiftRuntime:runProbe',
      runFinal: 'shiftRuntime:runFinal'
    }
  },
  asShiftId: (value: string) => value,
  fetchInternalAction: actionMock,
  fetchInternalMutation: mutationMock,
  fetchInternalQuery: queryMock
}))

vi.mock('@/core/engine', async () => {
  const actual = await vi.importActual<typeof import('@/core/engine')>('@/core/engine')
  return {
    ...actual,
    validatePolicy: validatePolicyMock
  }
})

const now = Date.now()
const baseShift = createStoredShiftRecord({
  startedAt: now - 1_000,
  phase1EndsAt: now + 60_000,
  expiresAt: now + 120_000,
  latestDraftSavedAt: now - 1_000,
  latestValidAt: now - 1_000,
  latestValidationCheckedAt: now - 1_000
})

describe('shift service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('reloads owned shifts and shapes the current DTO', async () => {
    actionMock.mockResolvedValue(baseShift)

    const { getOwnedShiftForGithub } = await import('@/features/shift/server')
    const shift = await getOwnedShiftForGithub('operator', 'shift_123')

    expect(actionMock).toHaveBeenCalledWith(
      'shiftResolver:resolveShift',
      {
        github: 'operator',
        shiftId: 'shift_123'
      }
    )
    expect(shift?.id).toBe('shift_123')
    expect(shift?.status).toBe('active_phase_1')
    expect(shift?.nextProbeKind).toBe('fit')
  })

  it('hides the next probe once the trial window closes', async () => {
    actionMock.mockResolvedValue({
      ...baseShift,
      phase1EndsAt: now - 1
    })

    const { getOwnedShiftForGithub } = await import('@/features/shift/server')
    const shift = await getOwnedShiftForGithub('operator', 'shift_123')

    expect(shift?.status).toBe('active_phase_2')
    expect(shift?.nextProbeKind).toBeUndefined()
  })

  it('stores successful validations with normalized source and refreshed shift', async () => {
    validatePolicyMock.mockResolvedValue({
      ok: true,
      normalizedSource: 'normalized',
      sourceHash: 'hash-1'
    })
    actionMock
      .mockResolvedValueOnce(baseShift)
      .mockResolvedValueOnce({
        ...baseShift,
        latestDraftSource: 'normalized',
        latestValidSource: 'normalized',
        latestValidSourceHash: 'hash-1',
        latestValidAt: now
      })
    mutationMock.mockResolvedValue(undefined)

    const { validateDraftForGithub } = await import('@/features/shift/server')
    const result = await validateDraftForGithub({
      github: 'operator',
      shiftId: 'shift_123',
      source: 'raw source'
    })

    expect(mutationMock).toHaveBeenCalledWith(
      'sessions:storeValidation',
      {
        github: 'operator',
        shiftId: 'shift_123',
        source: 'normalized',
        validation: {
          ok: true,
          normalizedSource: 'normalized',
          sourceHash: 'hash-1'
        },
        checkedAt: expect.any(Number)
      }
    )
    expect(result.validation).toEqual({
      ok: true,
      normalizedSource: 'normalized',
      sourceHash: 'hash-1'
    })
    expect(result.shift?.latestValidAt).toBe(now)
  })

  it('records invalid validation errors without normalization', async () => {
    validatePolicyMock.mockResolvedValue({
      ok: false,
      error: 'Validation failed'
    })
    actionMock
      .mockResolvedValueOnce(baseShift)
      .mockResolvedValueOnce(baseShift)
    mutationMock.mockResolvedValue(undefined)

    const { validateDraftForGithub } = await import('@/features/shift/server')
    const result = await validateDraftForGithub({
      github: 'operator',
      shiftId: 'shift_123',
      source: ' raw source '
    })

    expect(mutationMock).toHaveBeenCalledWith(
      'sessions:storeValidation',
      {
        github: 'operator',
        shiftId: 'shift_123',
        source: 'raw source',
        validation: {
          ok: false,
          error: 'Validation failed'
        },
        checkedAt: expect.any(Number)
      }
    )
    expect(result.validation).toEqual({
      ok: false,
      error: 'Validation failed'
    })
  })

  it('submits probe runs and returns the completed summary', async () => {
    actionMock.mockResolvedValue({
      probeKind: 'fit',
      summary: createProbeSummary({
        metrics: {
          connectedCalls: 5,
          totalCalls: 10,
          droppedCalls: 1,
          avgHoldSeconds: 1,
          premiumUsageRate: 0.1,
          efficiency: 0.5
        }
      }),
      shift: {
        id: 'shift_123',
        status: 'active_phase_1'
      }
    })

    const { runProbeForGithub } = await import('@/features/shift/server')
    const result = await runProbeForGithub({
      github: 'operator',
      shiftId: 'shift_123'
    })

    expect(actionMock).toHaveBeenCalledWith(
      'shiftRuntime:runProbe',
      {
        github: 'operator',
        shiftId: 'shift_123'
      }
    )
    expect(result.probeKind).toBe('fit')
    expect(result.summary.metrics.efficiency).toBe(0.5)
  })

  it('rejects probe runs after the trial window closes', async () => {
    actionMock.mockRejectedValue(new Error('trial window closed'))

    const { runProbeForGithub } = await import('@/features/shift/server')

    await expect(
      runProbeForGithub({
        github: 'operator',
        shiftId: 'shift_123'
      })
    ).rejects.toThrow('trial window closed')

    expect(mutationMock).not.toHaveBeenCalled()
  })

  it('raises a typed duplicate-start error from the mutation contract', async () => {
    validatePolicyMock.mockResolvedValue({
      ok: true,
      normalizedSource: 'normalized',
      sourceHash: 'hash-1'
    })
    queryMock.mockResolvedValueOnce(null)
    mutationMock.mockResolvedValue({
      activeShiftId: 'shift_existing',
      kind: 'active_shift_exists'
    })

    const { startShiftForGithub } = await import('@/features/shift/server')

    await expect(startShiftForGithub('operator')).rejects.toMatchObject({
      activeShiftId: 'shift_existing',
      code: 'active_shift_exists'
    } satisfies Partial<ShiftServiceError>)
  })

  it('submits final runs and returns the completed shift', async () => {
    actionMock.mockResolvedValue({
      shift: {
        id: 'shift_123',
        status: 'completed'
      }
    })

    const { goLiveForGithub } = await import('@/features/shift/server')
    const result = await goLiveForGithub({
      github: 'operator',
      shiftId: 'shift_123'
    })

    expect(actionMock).toHaveBeenCalledWith(
      'shiftRuntime:runFinal',
      {
        github: 'operator',
        shiftId: 'shift_123'
      }
    )
    expect(result.shift.status).toBe('completed')
  })
})
