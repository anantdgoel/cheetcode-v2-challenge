function summarize (values) {
  const sorted = [...values].sort((a, b) => a - b)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    average,
    max: sorted.at(-1),
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0]
  }
}

export async function runEfficiencyBenchmark ({
  buildDecision,
  computeExtraSummary,
  heading,
  seeds,
  simulate
}) {
  const efficiencies = []

  for (const seed of seeds) {
    const result = await simulate(seed, buildDecision(seed))
    efficiencies.push(result.metrics.efficiency)
    console.log(`${seed}: ${Math.round(result.metrics.efficiency * 100)}%`)
  }

  const summary = summarize(efficiencies)
  console.log(`\n${heading}`)
  console.log(`average: ${Math.round(summary.average * 100)}%`)
  console.log(`median: ${Math.round(summary.median * 100)}%`)
  console.log(`min/max: ${Math.round(summary.min * 100)}% / ${Math.round(summary.max * 100)}%`)

  if (computeExtraSummary) {
    const extraSummary = computeExtraSummary(efficiencies, summary)
    for (const line of extraSummary) {
      console.log(line)
    }
  }
}
