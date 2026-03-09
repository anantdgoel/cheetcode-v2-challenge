import { describe, expect, it } from 'vitest'
import { toShiftRecord, toClientShiftRecord } from '../convex/records'
import { createProbeSummary } from './shift/helpers/shift-fixtures'

/** Minimal ShiftDoc-shaped plain object for testing */
function createShiftDoc (overrides: Record<string, unknown> = {}) {
  const now = Date.now()
  return {
    _id: 'shift_abc' as unknown,
    _creationTime: now - 5_000,
    github: 'testuser',
    seed: 'test-seed-42',
    artifactVersion: 1,
    state: 'active' as const,
    startedAt: now - 2_000,
    phase1EndsAt: now + 28_000,
    expiresAt: now + 58_000,
    latestDraftSource: 'function connect() { return { lineId: null }; }',
    latestDraftSavedAt: now - 1_000,
    artifactFetchAt: {},
    runs: [] as Array<Record<string, unknown>>,
    ...overrides
  }
}

function createRunDoc (overrides: Record<string, unknown> = {}) {
  return {
    id: 'run_1',
    kind: 'fit' as const,
    trigger: 'manual' as const,
    state: 'completed' as const,
    acceptedAt: Date.now() - 1_000,
    sourceHash: 'hash-abc',
    sourceSnapshot: 'export function connect() {}',
    ...overrides
  }
}

describe('toShiftRecord', () => {
  it('returns null for null input', () => {
    expect(toShiftRecord(null)).toBeNull()
  })

  it('maps _id to id', () => {
    const doc = createShiftDoc()
    const record = toShiftRecord(doc as never)!
    expect(record.id).toBe(doc._id)
  })

  it('normalizes runs recursively', () => {
    const doc = createShiftDoc({
      runs: [
        createRunDoc({ id: 'r1', kind: 'fit', state: 'completed' }),
        createRunDoc({ id: 'r2', kind: 'stress', state: 'accepted' })
      ]
    })
    const record = toShiftRecord(doc as never)!
    expect(record.runs).toHaveLength(2)
    expect(record.runs[0].id).toBe('r1')
    expect(record.runs[0].kind).toBe('fit')
    expect(record.runs[1].id).toBe('r2')
    expect(record.runs[1].state).toBe('accepted')
  })

  it('omits run optional fields when not present', () => {
    const doc = createShiftDoc({ runs: [createRunDoc()] })
    const record = toShiftRecord(doc as never)!
    const r = record.runs[0]
    expect('resolvedAt' in r).toBe(false)
    expect('probeSummary' in r).toBe(false)
    expect('metrics' in r).toBe(false)
    expect('title' in r).toBe(false)
    expect('chiefOperatorNote' in r).toBe(false)
    expect('reportPublicId' in r).toBe(false)
  })

  it('throws for invalid title enum in run', () => {
    const run = createRunDoc({ title: 'grandmaster' })
    const doc = createShiftDoc({ runs: [run] })
    expect(() => toShiftRecord(doc as never)).toThrow('invalid run.title: grandmaster')
  })
})

describe('toClientShiftRecord', () => {
  it('returns null for null input', () => {
    expect(toClientShiftRecord(null)).toBeNull()
  })

  it('strips seed from the record', () => {
    const doc = createShiftDoc()
    const client = toClientShiftRecord(doc as never)!
    expect('seed' in client).toBe(false)
    expect(client.github).toBe('testuser')
  })

  it('strips hiddenScore from run metrics', () => {
    const run = createRunDoc({
      metrics: {
        connectedCalls: 20,
        totalCalls: 25,
        droppedCalls: 2,
        avgHoldSeconds: 1.5,
        totalHoldSeconds: 37.5,
        premiumUsageCount: 3,
        premiumUsageRate: 0.12,
        trunkMisuseCount: 1,
        efficiency: 0.8,
        hiddenScore: 0.75
      }
    })
    const doc = createShiftDoc({ runs: [run] })
    const client = toClientShiftRecord(doc as never)!
    const metrics = client.runs[0].metrics!
    expect(metrics.efficiency).toBe(0.8)
    expect('hiddenScore' in metrics).toBe(false)
  })

  it('passes through runs without metrics unchanged', () => {
    const run = createRunDoc()
    const doc = createShiftDoc({ runs: [run] })
    const client = toClientShiftRecord(doc as never)!
    expect(client.runs[0].id).toBe('run_1')
    expect('metrics' in client.runs[0]).toBe(false)
  })
})

describe('normalizeProbeSummary (via toShiftRecord)', () => {
  it('normalizes a valid probe summary through run normalization', () => {
    const summary = createProbeSummary()
    const run = createRunDoc({ probeSummary: summary })
    const doc = createShiftDoc({ runs: [run] })
    const record = toShiftRecord(doc as never)!
    const normalized = record.runs[0].probeSummary!
    expect(normalized.probeKind).toBe('fit')
    expect(normalized.deskCondition).toBe('steady')
    expect(normalized.recommendedQuestions).toHaveLength(2)
    expect(normalized.chiefOperatorNotes).toHaveLength(5)
    expect(normalized.counterfactualNotes).toHaveLength(2)
  })

  it('throws for wrong number of recommended questions', () => {
    const summary = createProbeSummary({
      recommendedQuestions: ['only one'] as unknown as [string, string]
    })
    const run = createRunDoc({ probeSummary: summary })
    const doc = createShiftDoc({ runs: [run] })
    expect(() => toShiftRecord(doc as never))
      .toThrow('expected recommendedQuestions to have length 2')
  })

  it('throws for wrong number of chief operator notes', () => {
    const summary = createProbeSummary({
      chiefOperatorNotes: ['a', 'b'] as unknown as [string, string, string, string, string]
    })
    const run = createRunDoc({ probeSummary: summary })
    const doc = createShiftDoc({ runs: [run] })
    expect(() => toShiftRecord(doc as never))
      .toThrow('expected chiefOperatorNotes to have length 5')
  })

  it('throws for wrong number of counterfactual notes', () => {
    const summary = createProbeSummary({
      counterfactualNotes: ['only one'] as unknown as [string, string]
    })
    const run = createRunDoc({ probeSummary: summary })
    const doc = createShiftDoc({ runs: [run] })
    expect(() => toShiftRecord(doc as never))
      .toThrow('expected counterfactualNotes to have length 2')
  })
})
