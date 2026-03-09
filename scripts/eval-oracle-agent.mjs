import { createBoard, simulateExchange } from '../src/core/engine/index.ts'
import { BENCHMARK_SEEDS } from './v3-agent-policies.mjs'

function oracleDecisionFactory (snapshot) {
  return async (input) => {
    const hiddenById = new Map(snapshot.lines.map((line) => [line.id, line]))
    const idle = input.lines.filter((line) => line.status === 'idle')
    if (!idle.length) return { lineId: null }
    const ranked = idle
      .map((line) => {
        const hidden = hiddenById.get(line.id)
        const key = `${input.call.routeCode}|${input.call.billingMode}|${input.call.urgency}`
        const score =
          (hidden?.compatibility[key] ?? 0) +
          (hidden?.qualityOffset ?? 0) +
          (hidden?.maintenanceOffset ?? 0) +
          (line.isPremiumTrunk &&
          ((input.call.routeCode === 'intercity' && input.call.billingMode === 'verified') ||
            (input.call.routeCode === 'priority' && input.call.urgency === 'priority'))
            ? hidden?.premiumBoost ?? 0
            : 0) -
          Math.max(0, input.board.load - (hidden?.loadSoftCap ?? 1)) * (hidden?.loadSlope ?? 0)
        return { lineId: line.id, score }
      })
      .sort((a, b) => b.score - a.score)
    return { lineId: ranked[0]?.lineId ?? null }
  }
}

for (const seed of BENCHMARK_SEEDS) {
  const snapshot = createBoard(seed)
  const result = await simulateExchange({
    board: snapshot,
    mode: 'final',
    decide: oracleDecisionFactory(snapshot)
  })
  console.log(`${seed}: ${Math.round(result.metrics.efficiency * 100)}% oracle reference`)
}
