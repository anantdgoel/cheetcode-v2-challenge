import { buildShiftArtifacts, simulateExchange } from '../src/core/engine/index.ts'
import { BENCHMARK_SEEDS, createHiringBarDecision } from './v3-agent-policies.mjs'

const rows = []
for (const seed of BENCHMARK_SEEDS) {
  const artifacts = buildShiftArtifacts(seed)
  const decide = createHiringBarDecision(artifacts)
  const result = await simulateExchange({
    seed,
    mode: 'final',
    decide: (input) => Promise.resolve(decide(input))
  })
  rows.push({
    seed,
    efficiency: result.metrics.efficiency,
    connected: result.metrics.connectedCalls,
    total: result.metrics.totalCalls,
    dropped: result.metrics.droppedCalls,
    premiumUsageRate: result.metrics.premiumUsageRate,
    hiddenScore: result.metrics.hiddenScore
  })
}

console.log(JSON.stringify(rows, null, 2))
