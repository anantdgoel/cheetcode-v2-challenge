import { describe, expect, it } from 'vitest'
import { shapeShiftView } from '@/features/shift/domain/view'
import type { ClientShiftRecord, StoredRunRecord } from '@/features/shift/domain/persistence'
import type { SimulationMetrics } from '@/core/domain/game'
import { createStoredShiftRecord } from '../helpers/shift-fixtures'

/** Strip seed from a StoredShiftRecord to create a ClientShiftRecord */
function toClient (shift: ReturnType<typeof createStoredShiftRecord>): ClientShiftRecord {
  const { seed: _, ...rest } = shift
  return rest
}

function makeRun (overrides: Partial<StoredRunRecord> = {}): StoredRunRecord {
  return {
    id: 'run_1',
    kind: 'fit',
    trigger: 'manual',
    state: 'completed',
    acceptedAt: Date.now() - 1_000,
    sourceHash: 'hash',
    sourceSnapshot: 'snapshot',
    ...overrides
  }
}

function makeMetrics (overrides: Partial<SimulationMetrics> = {}): SimulationMetrics {
  return {
    connectedCalls: 20,
    totalCalls: 25,
    droppedCalls: 2,
    avgHoldSeconds: 1.5,
    totalHoldSeconds: 37.5,
    premiumUsageCount: 3,
    premiumUsageRate: 0.12,
    trunkMisuseCount: 1,
    efficiency: 0.8,
    hiddenScore: 0.75,
    ...overrides
  }
}

describe('shapeShiftView', () => {
  describe('hiddenScore stripping', () => {
    it('strips hiddenScore from run metrics', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'completed',
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        completedAt: now - 500,
        runs: [makeRun({
          kind: 'final',
          state: 'completed',
          metrics: makeMetrics({ hiddenScore: 0.92 })
        })]
      }))

      const view = shapeShiftView(shift, now)
      const finalMetrics = view.finalEvaluation?.metrics
      expect(finalMetrics).toBeDefined()
      expect(finalMetrics!.efficiency).toBe(0.8)
      expect('hiddenScore' in finalMetrics!).toBe(false)
    })

    it('strips hiddenScore from probe metrics too', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: [makeRun({
          kind: 'fit',
          state: 'completed',
          metrics: makeMetrics({ hiddenScore: 0.55 })
        })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.probeEvaluations).toHaveLength(1)
      expect('hiddenScore' in view.probeEvaluations[0].metrics!).toBe(false)
    })
  })

  describe('run classification', () => {
    it('separates final runs from probe runs', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'completed',
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        runs: [
          makeRun({ id: 'probe_1', kind: 'fit', state: 'completed' }),
          makeRun({ id: 'probe_2', kind: 'stress', state: 'completed' }),
          makeRun({ id: 'final_1', kind: 'final', state: 'completed' })
        ]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.probeEvaluations).toHaveLength(2)
      expect(view.probeEvaluations[0].id).toBe('probe_1')
      expect(view.probeEvaluations[1].id).toBe('probe_2')
      expect(view.finalEvaluation?.id).toBe('final_1')
    })

    it('maps processing state to accepted in view', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: [makeRun({ state: 'processing' })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.probeEvaluations[0].state).toBe('accepted')
    })

    it('maps auto_expire trigger on final to auto_final kind', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'completed',
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        runs: [makeRun({ kind: 'final', trigger: 'auto_expire', state: 'completed' })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.finalEvaluation?.kind).toBe('auto_final')
    })
  })

  describe('phase detection', () => {
    it('provides nextProbeKind during phase 1', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.nextProbeKind).toBe('fit')
      expect(view.status).toBe('active_phase_1')
    })

    it('omits nextProbeKind during phase 2', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now - 1_000,
        expiresAt: now + 30_000,
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.nextProbeKind).toBeUndefined()
      expect(view.status).toBe('active_phase_2')
    })

    it('advances nextProbeKind after fit probe completes', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: [makeRun({ kind: 'fit', state: 'completed' })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.nextProbeKind).toBe('stress')
    })

    it('has no nextProbeKind when all probes are completed', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: [
          makeRun({ id: 'r1', kind: 'fit', state: 'completed' }),
          makeRun({ id: 'r2', kind: 'stress', state: 'completed' })
        ]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.nextProbeKind).toBeUndefined()
    })
  })

  describe('canGoLive', () => {
    it('is true when active, not expired, has valid source, no accepted run, no final', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now - 1_000,
        expiresAt: now + 30_000,
        latestValidSource: 'function connect() {}',
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.canGoLive).toBe(true)
    })

    it('is false when no valid source', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        expiresAt: now + 30_000,
        latestValidSource: undefined,
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.canGoLive).toBe(false)
    })

    it('is false when a run is accepted', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        expiresAt: now + 30_000,
        latestValidSource: 'function connect() {}',
        runs: [makeRun({ state: 'accepted' })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.canGoLive).toBe(false)
    })

    it('is false when a final evaluation exists', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        expiresAt: now + 30_000,
        latestValidSource: 'function connect() {}',
        runs: [makeRun({ kind: 'final', state: 'completed' })]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.canGoLive).toBe(false)
    })

    it('is false when past expiry', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        expiresAt: now - 1_000,
        latestValidSource: 'function connect() {}',
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.canGoLive).toBe(false)
    })
  })

  describe('probesUsed counting', () => {
    it('counts only completed probes', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: [
          makeRun({ id: 'r1', kind: 'fit', state: 'completed' }),
          makeRun({ id: 'r2', kind: 'stress', state: 'processing' })
        ]
      }))

      const view = shapeShiftView(shift, now)
      expect(view.probesUsed).toBe(1)
      expect(view.remainingProbes).toBe(1)
    })

    it('reports zero when no probes used', () => {
      const now = Date.now()
      const shift = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))

      const view = shapeShiftView(shift, now)
      expect(view.probesUsed).toBe(0)
      expect(view.remainingProbes).toBe(2)
      expect(view.maxProbes).toBe(2)
    })
  })

  describe('optional field pass-through', () => {
    it('includes completedAt only when present', () => {
      const now = Date.now()
      const withCompleted = toClient(createStoredShiftRecord({
        state: 'completed',
        completedAt: now,
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        runs: []
      }))
      const without = toClient(createStoredShiftRecord({
        state: 'active',
        completedAt: undefined,
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))

      expect(shapeShiftView(withCompleted, now).completedAt).toBe(now)
      expect('completedAt' in shapeShiftView(without, now)).toBe(false)
    })

    it('includes reportPublicId only when present', () => {
      const now = Date.now()
      const withId = toClient(createStoredShiftRecord({
        state: 'completed',
        reportPublicId: 'pub-123',
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        runs: []
      }))
      const without = toClient(createStoredShiftRecord({
        state: 'active',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))

      expect(shapeShiftView(withId, now).reportPublicId).toBe('pub-123')
      expect('reportPublicId' in shapeShiftView(without, now)).toBe(false)
    })

    it('includes latestValidSource only when present', () => {
      const now = Date.now()
      const withSource = toClient(createStoredShiftRecord({
        state: 'active',
        latestValidSource: 'function connect() {}',
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))
      const without = toClient(createStoredShiftRecord({
        state: 'active',
        latestValidSource: undefined,
        phase1EndsAt: now + 10_000,
        expiresAt: now + 60_000,
        runs: []
      }))

      expect(shapeShiftView(withSource, now).latestValidSource).toBe('function connect() {}')
      expect('latestValidSource' in shapeShiftView(without, now)).toBe(false)
    })
  })
})
