import { describe, expect, it } from 'vitest'
import { buildShiftArtifacts, createBoard, runFinal, simulateExchange } from '../src/lib/engine/index'
import {
  BENCHMARK_SEEDS,
  buildHiringBarPolicySource,
  buildPriorBoardSummary,
  buildWarmStartPolicySource,
  createHiringBarDecision,
  createWarmStartDecision,
  inferHiringBarModelFromArtifacts
} from '../scripts/v3-agent-policies.mjs'

function average (values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

async function expectPolicyParity (seed: string, kind: 'artifact' | 'warm-start') {
  const board = createBoard(seed)
  const artifacts = buildShiftArtifacts(board)
  const priorArtifacts = BENCHMARK_SEEDS.filter((candidate) => candidate !== seed).map((candidate) => buildShiftArtifacts(candidate))
  const source =
    kind === 'artifact'
      ? buildHiringBarPolicySource(artifacts)
      : buildWarmStartPolicySource(artifacts, priorArtifacts)
  const decide =
    kind === 'artifact'
      ? createHiringBarDecision(artifacts)
      : createWarmStartDecision(artifacts, priorArtifacts)

  const generated = await runFinal({
    source,
    board
  })
  const local = await simulateExchange({
    board,
    mode: 'final',
    decide: (input) => Promise.resolve(decide(input))
  })

  expect(local.metrics).toEqual(generated.metrics)
  expect(local.title).toBe(generated.title)
}

describe('artifact-driven hiring-bar agent', () => {
  it('builds board-specific policy sources under the 16 KB limit', () => {
    for (const seed of BENCHMARK_SEEDS) {
      const source = buildHiringBarPolicySource(buildShiftArtifacts(seed))
      expect(source).toContain('function connect(input)')
      expect(source).toContain('__MODEL__')
      expect(new TextEncoder().encode(source).length).toBeLessThan(16_000)
    }
  })

  it('treats visible family classification as a weak prior instead of a solved rotation', () => {
    const artifacts = buildShiftArtifacts('alpha-switch')
    const inferred = inferHiringBarModelFromArtifacts(artifacts)

    expect(Object.keys(inferred.visibleFamilyByGroup).length).toBeGreaterThan(5)
    expect(Object.keys(inferred.familyCountPosterior)).toEqual(['3', '4', '5'])
    expect(Math.max(...Object.values(inferred.familyCountPosterior))).toBeLessThan(0.7)
  })

  it('builds a reusable prior-board summary for warm starts', () => {
    const priorSummary = buildPriorBoardSummary(BENCHMARK_SEEDS.slice(0, 4).map((seed) => buildShiftArtifacts(seed)))

    expect(priorSummary.benchmarkSeedCount).toBe(4)
    expect(priorSummary.profilePosterior.switchboard).toBeGreaterThan(0)
    expect(priorSummary.familyCountPosterior['5']).toBeGreaterThan(0)
  })

  it('matches generated-source behavior for the artifact-only policy', async () => {
    await expectPolicyParity('alpha-switch', 'artifact')
  })

  it('matches generated-source behavior for the warm-start policy', async () => {
    await expectPolicyParity('broadway-night', 'warm-start')
  })

  it('uses priors without materially regressing on holdout boards', async () => {
    const artifactEfficiencies: number[] = []
    const warmStartEfficiencies: number[] = []

    for (const seed of BENCHMARK_SEEDS.slice(4)) {
      const artifacts = buildShiftArtifacts(seed)
      const priorArtifacts = BENCHMARK_SEEDS.filter((candidate) => candidate !== seed).map((candidate) => buildShiftArtifacts(candidate))
      const artifactOnly = createHiringBarDecision(artifacts)
      const warmStart = createWarmStartDecision(artifacts, priorArtifacts)

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

      artifactEfficiencies.push(artifactResult.metrics.efficiency)
      warmStartEfficiencies.push(warmStartResult.metrics.efficiency)
    }

    expect(average(warmStartEfficiencies)).toBeGreaterThanOrEqual(average(artifactEfficiencies) - 0.03)
  })
})
