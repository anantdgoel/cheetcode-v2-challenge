import { describe, expect, it } from 'vitest'
import { hasLiveActiveShift } from '@/features/shift/domain/lifecycle'
import { createStoredShiftRecord } from '../helpers/shift-fixtures'

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
