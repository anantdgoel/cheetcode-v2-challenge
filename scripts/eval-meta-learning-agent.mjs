import { buildShiftArtifacts, simulateExchange } from '../src/core/engine/index.ts'
import { createHiringBarDecision, createWarmStartDecision } from './v3-agent-policies.mjs'

const TRAINING_STAGE_COUNTS = [0, 5, 10, 20]
const TRAINING_SEEDS = Array.from({ length: 20 }, (_, index) => `meta-train-${String(index + 1).padStart(2, '0')}`)
const HOLDOUT_SEEDS = Array.from({ length: 40 }, (_, index) => `meta-holdout-${String(index + 1).padStart(2, '0')}`)

function average (values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percent (value) {
  return `${(value * 100).toFixed(1)}%`
}

function emptyBucket () {
  return {
    artifactEfficiencies: [],
    metaEfficiencies: [],
    deltas: [],
    wins: 0,
    count: 0
  }
}

async function runDecision (seed, decide) {
  const result = await simulateExchange({
    seed,
    mode: 'final',
    decide: (input) => Promise.resolve(decide(input))
  })
  return result.metrics.efficiency
}

function bucketLabel (board) {
  return `${board.activeFamilies.length}-family`
}

function formatBucketSummary (label, bucket) {
  return [
    `  ${label}:`,
    `artifact ${percent(average(bucket.artifactEfficiencies))}`,
    `meta ${percent(average(bucket.metaEfficiencies))}`,
    `delta ${(average(bucket.deltas) * 100).toFixed(2)} pts`,
    `win rate ${percent(bucket.count ? bucket.wins / bucket.count : 0)}`
  ].join(' | ')
}

async function evaluateStage (trainingCount) {
  const priorArtifacts = TRAINING_SEEDS.slice(0, trainingCount).map((seed) => buildShiftArtifacts(seed))
  const bucketStats = new Map()
  const artifactEfficiencies = []
  const metaEfficiencies = []
  const deltas = []
  let wins = 0
  let improvedByTwoPoints = 0

  for (const seed of HOLDOUT_SEEDS) {
    const artifacts = buildShiftArtifacts(seed)
    const artifactDecision = createHiringBarDecision(artifacts)
    const metaDecision =
      priorArtifacts.length > 0 ? createWarmStartDecision(artifacts, priorArtifacts) : createHiringBarDecision(artifacts)

    const artifactEfficiency = await runDecision(seed, artifactDecision)
    const metaEfficiency = await runDecision(seed, metaDecision)
    const delta = metaEfficiency - artifactEfficiency
    const label = bucketLabel(artifacts.board)

    artifactEfficiencies.push(artifactEfficiency)
    metaEfficiencies.push(metaEfficiency)
    deltas.push(delta)

    if (delta > 0) wins += 1
    if (delta >= 0.02) improvedByTwoPoints += 1

    if (!bucketStats.has(label)) bucketStats.set(label, emptyBucket())
    const bucket = bucketStats.get(label)
    bucket.artifactEfficiencies.push(artifactEfficiency)
    bucket.metaEfficiencies.push(metaEfficiency)
    bucket.deltas.push(delta)
    bucket.count += 1
    if (delta > 0) bucket.wins += 1
  }

  return {
    trainingCount,
    artifactAverage: average(artifactEfficiencies),
    metaAverage: average(metaEfficiencies),
    meanDelta: average(deltas),
    winRate: wins / HOLDOUT_SEEDS.length,
    improvedByTwoPoints,
    bucketStats
  }
}

console.log('Meta-learning benchmark')
console.log(`training seeds: ${TRAINING_SEEDS.length}`)
console.log(`holdout seeds: ${HOLDOUT_SEEDS.length}`)
console.log(`stages: ${TRAINING_STAGE_COUNTS.join(', ')}`)

for (const trainingCount of TRAINING_STAGE_COUNTS) {
  const summary = await evaluateStage(trainingCount)
  console.log(`\nstage ${trainingCount}`)
  console.log(`artifact-only average: ${percent(summary.artifactAverage)}`)
  console.log(`meta-agent average:    ${percent(summary.metaAverage)}`)
  console.log(`mean uplift:           ${(summary.meanDelta * 100).toFixed(2)} pts`)
  console.log(`win rate:              ${percent(summary.winRate)}`)
  console.log(`boards improved >=2pts: ${summary.improvedByTwoPoints}/${HOLDOUT_SEEDS.length}`)
  console.log('family-count buckets:')
  for (const label of ['3-family', '4-family', '5-family']) {
    const bucket = summary.bucketStats.get(label)
    if (!bucket) continue
    console.log(formatBucketSummary(label, bucket))
  }
}
