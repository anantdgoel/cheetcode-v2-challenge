import { simulateExchange } from '../src/core/engine/index.ts'
import { runEfficiencyBenchmark } from './benchmark-runner.mjs'
import { BENCHMARK_SEEDS, snapshotDecision } from './v3-agent-policies.mjs'

await runEfficiencyBenchmark({
  buildDecision: () => snapshotDecision,
  heading: 'Snapshot baseline benchmark',
  seeds: BENCHMARK_SEEDS,
  simulate: (seed, decide) =>
    simulateExchange({
      decide: (input) => Promise.resolve(decide(input)),
      mode: 'final',
      seed
    })
})
