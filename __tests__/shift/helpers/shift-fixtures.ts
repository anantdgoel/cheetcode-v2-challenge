import type { ProbeSummary } from '@/core/domain/game'
import type { ShiftView } from '@/core/domain/views'
import type { StoredShiftRecord } from '@/features/shift/domain/persistence'

export function createProbeSummary (overrides: Partial<ProbeSummary> = {}): ProbeSummary {
  return {
    probeKind: 'fit',
    deskCondition: 'steady',
    metrics: {
      connectedCalls: 6,
      totalCalls: 10,
      droppedCalls: 1,
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
      collapse_under_pressure: 0.71,
      tempo_lag: 0.62,
      misleading_history: 0.58
    },
    transferWarning: 'likely_final_shift_sensitive',
    recommendedQuestions: [
      'Does the desk change shape once pressure moves from building to hot?',
      'Did the books reward the wrong desks for the live room you actually have?'
    ],
    chiefOperatorNotes: [
      'The borough desks carried neatly until the lamps stacked, then the room began dropping its poise before the callers did.',
      'The room changes pace ahead of the routing; the late board answers a beat behind the first clean read.',
      'The books praised a calmer version of the room than the probe actually found once the live desk started speaking for itself.',
      'One corner of the board was asked to answer too much of the room, and the room noticed before the policy did.',
      'The room did not ask for a new board, only a firmer reading of when the present one stops behaving politely.'
    ],
    counterfactualNotes: [
      'What seemed like a steady answer in the books lost its footing once the room heated up.',
      'What seemed like board law was partly the books talking louder than the live room.'
    ],
    incidents: [],
    ...overrides
  }
}

export function createStoredShiftRecord (
  overrides: Partial<StoredShiftRecord> = {}
): StoredShiftRecord {
  const now = Date.now()
  return {
    id: 'shift_123',
    github: 'operator',
    seed: 'seed-1',
    artifactVersion: 1,
    state: 'active',
    startedAt: now - 1_000,
    phase1EndsAt: now + 60_000,
    expiresAt: now + 120_000,
    latestDraftSource: 'export function connect() { return { lineId: null }; }',
    latestDraftSavedAt: now - 1_000,
    latestValidSource: 'export function connect() { return { lineId: null }; }',
    latestValidSourceHash: 'starter-hash',
    latestValidAt: now - 1_000,
    latestValidationCheckedAt: now - 1_000,
    artifactFetchAt: {},
    runs: [],
    ...overrides
  }
}

export function createShiftView (overrides: Partial<ShiftView> = {}): ShiftView {
  const now = Date.now()
  return {
    id: 'shift_123',
    github: 'operator',
    status: 'active_phase_1',
    startedAt: 1,
    phase1EndsAt: now + 120_000,
    expiresAt: now + 5 * 60_000,
    artifactVersion: 1,
    latestDraftSource: 'export function connect() { return { lineId: null }; }',
    latestDraftSavedAt: 1,
    currentPhase: 'active',
    probesUsed: 0,
    maxProbes: 2,
    remainingProbes: 2,
    nextProbeKind: 'fit',
    canGoLive: false,
    probeEvaluations: [],
    ...overrides
  }
}
