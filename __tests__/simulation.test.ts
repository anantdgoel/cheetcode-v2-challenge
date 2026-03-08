import { describe, expect, it } from 'vitest'
import { buildShiftArtifacts, buildStarterPolicy, simulateExchange, summarizeProbe, validatePolicy } from '../src/lib/engine/index'
import {
  BENCHMARK_SEEDS,
  createHiringBarDecision,
  createWarmStartDecision,
  oldHeuristicDecision,
  snapshotDecision
} from '../scripts/v3-agent-policies.mjs'

function average (values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

describe('simulation signal', () => {
  it('returns structured probe summaries without hidden score leakage', async () => {
    const result = await simulateExchange({
      seed: 'trial-seed',
      mode: 'fit',
      decide: (input) => Promise.resolve(snapshotDecision(input))
    })

    const summary = summarizeProbe(result, 'fit')
    expect(summary.deskCondition).toMatch(/steady|strained|overrun/)
    expect('hiddenScore' in summary.metrics).toBe(false)
    expect(summary.callBucketTable.length).toBeGreaterThan(0)
    expect(summary.failureModes).toHaveLength(3)
    expect(summary.recommendedQuestions).toHaveLength(2)
    expect(summary.chiefOperatorNotes).toHaveLength(5)
    expect(summary.counterfactualNotes).toHaveLength(2)
    expect(summary.incidents.length).toBeLessThanOrEqual(8)
  })

  it('keeps the shipped starter under ten percent on the fixed benchmark suite', async () => {
    expect((await validatePolicy(buildStarterPolicy())).ok).toBe(true)
    const efficiencies: number[] = []
    for (const seed of BENCHMARK_SEEDS) {
      const result = await simulateExchange({
        seed,
        mode: 'final',
        decide: () => Promise.resolve({ lineId: null })
      })
      efficiencies.push(result.metrics.efficiency)
    }
    expect(average(efficiencies)).toBeLessThan(0.1)
  })

  it('keeps the snapshot vanilla policy as a weak baseline', async () => {
    const efficiencies: number[] = []
    for (const seed of BENCHMARK_SEEDS) {
      const result = await simulateExchange({
        seed,
        mode: 'final',
        decide: (input) => Promise.resolve(snapshotDecision(input))
      })
      efficiencies.push(result.metrics.efficiency)
    }
    const avg = average(efficiencies)
    expect(avg).toBeGreaterThan(0.12)
    expect(avg).toBeLessThan(0.3)
  })

  it('separates static, artifact-only, and warm-start agents', async () => {
    const oldEfficiencies: number[] = []
    const artifactEfficiencies: number[] = []
    const warmStartEfficiencies: number[] = []

    for (const seed of BENCHMARK_SEEDS) {
      const artifacts = buildShiftArtifacts(seed)
      const priorArtifacts = BENCHMARK_SEEDS.filter((candidate) => candidate !== seed)
        .slice(0, 4)
        .map((candidate) => buildShiftArtifacts(candidate))
      const artifactOnly = createHiringBarDecision(artifacts)
      const warmStart = createWarmStartDecision(artifacts, priorArtifacts)
      const oldResult = await simulateExchange({
        seed,
        mode: 'final',
        decide: (input) => Promise.resolve(oldHeuristicDecision(input))
      })
      const artifactResult = await simulateExchange({
        seed,
        mode: 'final',
        decide: (input) => Promise.resolve(artifactOnly(input))
      })
      const warmStartResult = await simulateExchange({
        seed,
        mode: 'final',
        decide: (input) => Promise.resolve(warmStart(input))
      })

      oldEfficiencies.push(oldResult.metrics.efficiency)
      artifactEfficiencies.push(artifactResult.metrics.efficiency)
      warmStartEfficiencies.push(warmStartResult.metrics.efficiency)
    }

    expect(average(oldEfficiencies)).toBeLessThanOrEqual(0.58)
    expect(average(artifactEfficiencies)).toBeGreaterThan(average(oldEfficiencies))
    expect(average(warmStartEfficiencies)).toBeGreaterThanOrEqual(average(artifactEfficiencies) - 0.02)
  })
})
