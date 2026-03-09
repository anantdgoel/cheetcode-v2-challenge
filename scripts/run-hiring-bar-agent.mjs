import { buildShiftArtifacts, simulateExchange } from '../src/core/engine/index.ts'
import { runEfficiencyBenchmark } from './benchmark-runner.mjs'
import { BENCHMARK_SEEDS, createHiringBarDecision } from './v3-agent-policies.mjs'

await runEfficiencyBenchmark({
  buildDecision: (seed) => createHiringBarDecision(buildShiftArtifacts(seed)),
  computeExtraSummary: (values, summary) => {
    const variance =
      values.reduce((sum, value) => sum + (value - summary.average) ** 2, 0) / values.length
    return [`variance: ${variance.toFixed(5)}`]
  },
  heading: 'Hiring-bar benchmark',
  seeds: BENCHMARK_SEEDS,
  simulate: (seed, decide) =>
    simulateExchange({
      decide: (input) => Promise.resolve(decide(input)),
      mode: 'final',
      seed
    })
})
