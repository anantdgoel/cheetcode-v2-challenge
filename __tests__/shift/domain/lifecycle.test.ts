import { describe, expect, it } from 'vitest'
import {
  hasLiveActiveShift,
  getViewStatus,
  getCurrentPhase,
  toViewRunKind,
  canEditShift,
  shouldAutoFinalize,
  shouldExpireWithoutResult
} from '@/features/shift/domain/lifecycle'
import type { StoredRunRecord } from '@/features/shift/domain/persistence'
import { createStoredShiftRecord } from '../helpers/shift-fixtures'

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

describe('hasLiveActiveShift', () => {
  it('does not block a new shift for an expired stale active record', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: []
    })

    expect(hasLiveActiveShift(shift, now)).toBe(false)
  })

  it('blocks a new shift while the active timer is still open', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now + 1_000
    })

    expect(hasLiveActiveShift(shift, now)).toBe(true)
  })

  it('blocks a new shift while an expired shift is still evaluating', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: [{
        id: 'run_final',
        kind: 'final',
        trigger: 'auto_expire',
        state: 'processing',
        acceptedAt: now - 500,
        sourceHash: 'hash-1',
        sourceSnapshot: 'snapshot'
      }]
    })

    expect(hasLiveActiveShift(shift, now)).toBe(true)
  })
})

describe('getViewStatus', () => {
  it('returns active_phase_1 when in phase 1 window', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now + 10_000,
      expiresAt: now + 60_000,
      runs: []
    })
    expect(getViewStatus(shift, now)).toBe('active_phase_1')
  })

  it('returns active_phase_2 when past phase 1 but before expiry', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 1_000,
      expiresAt: now + 30_000,
      runs: []
    })
    expect(getViewStatus(shift, now)).toBe('active_phase_2')
  })

  it('returns evaluating when a run is accepted, even if expired', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: [makeRun({ state: 'accepted' })]
    })
    expect(getViewStatus(shift, now)).toBe('evaluating')
  })

  it('returns evaluating when a run is processing', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now + 10_000,
      expiresAt: now + 60_000,
      runs: [makeRun({ state: 'processing' })]
    })
    expect(getViewStatus(shift, now)).toBe('evaluating')
  })

  it('returns completed when shift state is completed', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'completed',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: [makeRun({ kind: 'final', state: 'completed' })]
    })
    expect(getViewStatus(shift, now)).toBe('completed')
  })

  it('returns expired_no_result when past expiry with no accepted run', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: []
    })
    expect(getViewStatus(shift, now)).toBe('expired_no_result')
  })

  it('returns expired_no_result for explicitly expired state', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'expired',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: []
    })
    expect(getViewStatus(shift, now)).toBe('expired_no_result')
  })
})

describe('getCurrentPhase', () => {
  it('maps active_phase_1 to active', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now + 10_000,
      expiresAt: now + 60_000,
      runs: []
    })
    expect(getCurrentPhase(shift, now)).toBe('active')
  })

  it('maps active_phase_2 to active', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      phase1EndsAt: now - 1_000,
      expiresAt: now + 30_000,
      runs: []
    })
    expect(getCurrentPhase(shift, now)).toBe('active')
  })

  it('maps evaluating status to evaluating phase', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      runs: [makeRun({ state: 'processing' })]
    })
    expect(getCurrentPhase(shift, now)).toBe('evaluating')
  })

  it('maps completed status to completed phase', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'completed',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: []
    })
    expect(getCurrentPhase(shift, now)).toBe('completed')
  })

  it('maps expired_no_result to expired phase', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'expired',
      phase1EndsAt: now - 30_000,
      expiresAt: now - 1_000,
      runs: []
    })
    expect(getCurrentPhase(shift, now)).toBe('expired')
  })
})

describe('toViewRunKind', () => {
  it('returns auto_final for final run with auto_expire trigger', () => {
    const run = makeRun({ kind: 'final', trigger: 'auto_expire' })
    expect(toViewRunKind(run)).toBe('auto_final')
  })

  it('returns final for final run with manual trigger', () => {
    const run = makeRun({ kind: 'final', trigger: 'manual' })
    expect(toViewRunKind(run)).toBe('final')
  })

  it('passes through probe kind for fit', () => {
    const run = makeRun({ kind: 'fit' })
    expect(toViewRunKind(run)).toBe('fit')
  })

  it('passes through probe kind for stress', () => {
    const run = makeRun({ kind: 'stress' })
    expect(toViewRunKind(run)).toBe('stress')
  })
})

describe('canEditShift', () => {
  it('returns true when active and not expired and no accepted run', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now + 30_000,
      runs: []
    })
    expect(canEditShift(shift, now)).toBe(true)
  })

  it('returns false when state is completed', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'completed',
      expiresAt: now + 30_000,
      runs: []
    })
    expect(canEditShift(shift, now)).toBe(false)
  })

  it('returns false when past expiry', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      runs: []
    })
    expect(canEditShift(shift, now)).toBe(false)
  })

  it('returns false when a run is accepted', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now + 30_000,
      runs: [makeRun({ state: 'accepted' })]
    })
    expect(canEditShift(shift, now)).toBe(false)
  })
})

describe('shouldAutoFinalize', () => {
  it('returns true when expired with valid source and no final run', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      latestValidSource: 'function connect() {}',
      runs: []
    })
    expect(shouldAutoFinalize(shift, now)).toBe(true)
  })

  it('returns false when not expired yet', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now + 30_000,
      latestValidSource: 'function connect() {}',
      runs: []
    })
    expect(shouldAutoFinalize(shift, now)).toBe(false)
  })

  it('returns false when no valid source', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      latestValidSource: undefined,
      runs: []
    })
    expect(shouldAutoFinalize(shift, now)).toBe(false)
  })

  it('returns false when a final run already exists', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      latestValidSource: 'function connect() {}',
      runs: [makeRun({ kind: 'final' })]
    })
    expect(shouldAutoFinalize(shift, now)).toBe(false)
  })

  it('returns false when state is completed', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'completed',
      expiresAt: now - 1_000,
      latestValidSource: 'function connect() {}',
      runs: []
    })
    expect(shouldAutoFinalize(shift, now)).toBe(false)
  })
})

describe('shouldExpireWithoutResult', () => {
  it('returns true when expired with no valid source', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      latestValidSource: undefined,
      runs: []
    })
    expect(shouldExpireWithoutResult(shift, now)).toBe(true)
  })

  it('returns false when valid source exists', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now - 1_000,
      latestValidSource: 'function connect() {}',
      runs: []
    })
    expect(shouldExpireWithoutResult(shift, now)).toBe(false)
  })

  it('returns false when not expired yet', () => {
    const now = Date.now()
    const shift = createStoredShiftRecord({
      state: 'active',
      expiresAt: now + 30_000,
      latestValidSource: undefined,
      runs: []
    })
    expect(shouldExpireWithoutResult(shift, now)).toBe(false)
  })
})
