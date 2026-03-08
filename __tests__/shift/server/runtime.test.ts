import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNextProbeKind } from '@/features/shift/domain/lifecycle'
import type { StoredRunRecord, StoredShiftRecord } from '@/features/shift/domain/persistence'
import { resolveShift } from '../../../convex/shiftResolver'
import { runFinal, runProbe } from '../../../convex/shiftRuntime'

const policyVmMocks = vi.hoisted(() => ({
  buildFinalReport: vi.fn(),
  runFinal: vi.fn(),
  runProbe: vi.fn()
}))

vi.mock('@/core/engine/policy-vm', () => policyVmMocks)

const now = Date.now()

const baseShift: StoredShiftRecord = {
  id: 'shift_123',
  github: 'operator',
  seed: 'seed-1',
  artifactVersion: 1,
  state: 'active',
  startedAt: now - 1_000,
  phase1EndsAt: now + 30_000,
  expiresAt: now + 60_000,
  latestDraftSource: 'draft',
  latestDraftSavedAt: now - 1_000,
  latestValidSource: 'valid draft',
  latestValidSourceHash: 'hash-1',
  latestValidAt: now - 1_000,
  latestValidationCheckedAt: now - 1_000,
  artifactFetchAt: {},
  runs: []
}

function buildProbeRun (state: StoredRunRecord['state']): StoredRunRecord {
  return {
    id: 'run_probe_1',
    kind: 'fit',
    trigger: 'manual',
    state,
    acceptedAt: now - 500,
    sourceHash: 'hash-1',
    sourceSnapshot: 'valid draft',
    ...(state === 'completed'
      ? {
          resolvedAt: now - 100,
          probeSummary: {
            probeKind: 'fit',
            deskCondition: 'steady',
            metrics: {
              connectedCalls: 12,
              totalCalls: 20,
              droppedCalls: 2,
              avgHoldSeconds: 1.5,
              premiumUsageRate: 0.2,
              efficiency: 0.6
            },
            callBucketTable: [],
            loadBandTable: [],
            lineGroupTable: [],
            failureBuckets: [],
            failureModes: ['collapse_under_pressure', 'tempo_lag', 'misleading_history'],
            modeConfidence: {
              collapse_under_pressure: 0.7,
              tempo_lag: 0.6,
              misleading_history: 0.5
            },
            transferWarning: 'likely_final_shift_sensitive',
            recommendedQuestions: ['q1', 'q2'],
            chiefOperatorNotes: ['n1', 'n2', 'n3', 'n4', 'n5'],
            counterfactualNotes: ['c1', 'c2'],
            incidents: []
          }
        }
      : {})
  }
}

function buildFinalRun (state: StoredRunRecord['state']): StoredRunRecord {
  return {
    id: 'run_final_1',
    kind: 'final',
    trigger: 'manual',
    state,
    acceptedAt: now - 500,
    sourceHash: 'hash-1',
    sourceSnapshot: 'valid draft',
    ...(state === 'completed'
      ? {
          resolvedAt: now - 100,
          reportPublicId: 'report-1',
          title: 'chief_operator',
          metrics: {
            connectedCalls: 12,
            totalCalls: 20,
            droppedCalls: 2,
            avgHoldSeconds: 1.5,
            totalHoldSeconds: 30,
            premiumUsageCount: 4,
            premiumUsageRate: 0.2,
            trunkMisuseCount: 1,
            efficiency: 0.6,
            hiddenScore: 0.7
          },
          chiefOperatorNote: 'steady room'
        }
      : {})
  }
}

function createCtx (params: {
  queryResults: Array<StoredShiftRecord | null>;
  onMutation: (ref: unknown, args: unknown) => Promise<unknown>;
}) {
  const queryResults = [...params.queryResults]
  return {
    runMutation: vi.fn(async (ref: unknown, args: unknown) => params.onMutation(ref, args)),
    runQuery: vi.fn(async () => queryResults.shift() ?? null)
  }
}

function getHandler<TArgs extends object, TResult> (action: unknown) {
  return (action as { _handler: (ctx: unknown, args: TArgs) => Promise<TResult> })._handler
}

describe('shift runtime helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('advances through the two v3 probes', () => {
    expect(getNextProbeKind([])).toBe('fit')
    expect(getNextProbeKind([{ kind: 'fit', state: 'completed' }])).toBe('stress')
    expect(
      getNextProbeKind([
        { kind: 'fit', state: 'completed' },
        { kind: 'stress', state: 'completed' }
      ])
    ).toBeUndefined()
  })

  it('lets resolveShift wait for a concurrently claimed probe instead of evaluating it twice', async () => {
    const processingShift = { ...baseShift, runs: [buildProbeRun('processing')] }
    const completedShift = { ...baseShift, runs: [buildProbeRun('completed')] }
    let mutationCount = 0
    const ctx = createCtx({
      queryResults: [
        { ...baseShift, runs: [buildProbeRun('accepted')] },
        completedShift
      ],
      onMutation: async () => {
        mutationCount += 1
        if (mutationCount === 1) {
          return { kind: 'busy', shift: processingShift }
        }
        throw new Error('unexpected mutation')
      }
    })

    const result = await getHandler<{ github: string; shiftId: string }, StoredShiftRecord | null>(resolveShift)(ctx, {
      github: 'operator',
      shiftId: 'shift_123'
    })

    expect(result?.runs[0]?.state).toBe('completed')
    expect(policyVmMocks.runProbe).not.toHaveBeenCalled()
  })

  it('lets runProbe return the completed summary when another resolver claims the run first', async () => {
    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('run_probe_1')
    const processingShift = { ...baseShift, runs: [buildProbeRun('processing')] }
    const completedShift = { ...baseShift, runs: [buildProbeRun('completed')] }
    let mutationCount = 0
    const ctx = createCtx({
      queryResults: [
        baseShift,
        { ...baseShift, runs: [buildProbeRun('accepted')] },
        completedShift
      ],
      onMutation: async () => {
        mutationCount += 1
        if (mutationCount === 1) {
          return undefined
        }
        if (mutationCount === 2) {
          return { kind: 'busy', shift: processingShift }
        }
        throw new Error('unexpected mutation')
      }
    })

    const result = await getHandler<{ github: string; shiftId: string }, { summary: StoredRunRecord['probeSummary'] }>(runProbe)(ctx, {
      github: 'operator',
      shiftId: 'shift_123'
    })

    expect(result.summary?.metrics.efficiency).toBe(0.6)
    expect(policyVmMocks.runProbe).not.toHaveBeenCalled()
    randomUuidMock.mockRestore()
  })

  it('lets runFinal return the completed shift when another resolver claims the final run first', async () => {
    const randomUuidMock = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('run_final_1')
    const processingShift = { ...baseShift, runs: [buildFinalRun('processing')] }
    const completedShift = {
      ...baseShift,
      state: 'completed' as const,
      completedAt: now - 100,
      reportPublicId: 'report-1',
      runs: [buildFinalRun('completed')]
    }
    let mutationCount = 0
    const ctx = createCtx({
      queryResults: [
        baseShift,
        { ...baseShift, runs: [buildFinalRun('accepted')] },
        completedShift
      ],
      onMutation: async () => {
        mutationCount += 1
        if (mutationCount === 1) {
          return undefined
        }
        if (mutationCount === 2) {
          return { kind: 'busy', shift: processingShift }
        }
        throw new Error('unexpected mutation')
      }
    })

    const result = await getHandler<{ github: string; shiftId: string }, { shift: { status: string } }>(runFinal)(ctx, {
      github: 'operator',
      shiftId: 'shift_123'
    })

    expect(result.shift.status).toBe('completed')
    expect(policyVmMocks.runFinal).not.toHaveBeenCalled()
    randomUuidMock.mockRestore()
  })
})
