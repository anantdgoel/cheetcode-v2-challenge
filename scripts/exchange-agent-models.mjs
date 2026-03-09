import {
  CALL_KEY_COUNT,
  ROUTE_CODES,
  VISIBLE_FAMILIES,
  callKeyIndex,
  classifyVisibleFamily
} from './exchange-agent-common.mjs'

export const BENCHMARK_SEEDS = [
  'alpha-switch',
  'broadway-night',
  'uptown-rush',
  'vermont-wire',
  'switchyard-7',
  'hotel-desk',
  'relay-room',
  'district-noon',
  'ledger-evening',
  'trunk-surge'
]

/**
 * Observation credibility by operator grade. Senior operators make reliable
 * decisions (weight 1.0); trainees introduce noise and are heavily discounted.
 */
const GRADE_WEIGHTS = {
  senior: 1,
  operator: 0.72,
  trainee: 0.18
}

const PROFILE_NAMES = [
  'switchboard',
  'front-office',
  'night-rush',
  'civic-desk',
  'commuter-belt',
  'storm-watch'
]

/**
 * Reward signal per call outcome. Connected is ideal (+1); held is a mild
 * penalty (-0.18); faults (-0.72) and drops (-0.95) are heavily punished.
 * Used to build per-group and per-family score tables from observation history.
 */
const OUTCOME_SCORES = {
  connected: 1,
  held: -0.18,
  fault: -0.72,
  dropped: -0.95
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parseArtifacts (artifacts) {
  const lines = typeof artifacts.linesJson === 'string' ? JSON.parse(artifacts.linesJson) : artifacts.linesJson
  const observations =
    typeof artifacts.observationsJsonl === 'string'
      ? artifacts.observationsJsonl
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      : artifacts.observationsJsonl
  return { lines, observations }
}

function createBucket () {
  return { weight: 0, total: 0 }
}

function addBucket (bucket, value, weight) {
  bucket.weight += weight
  bucket.total += value * weight
}

function bucketAverage (bucket, fallback = 0) {
  return bucket && bucket.weight > 0 ? bucket.total / bucket.weight : fallback
}

function createKeyBuckets () {
  return Array.from({ length: CALL_KEY_COUNT }, () => createBucket())
}

function ensureKeyBuckets (table, subjectKey) {
  if (!table[subjectKey]) table[subjectKey] = createKeyBuckets()
  return table[subjectKey]
}

function createTraitBuckets () {
  return {
    overall: createBucket(),
    pressure: {
      calm: createBucket(),
      building: createBucket(),
      hot: createBucket()
    },
    load: {
      low: createBucket(),
      medium: createBucket(),
      high: createBucket(),
      peak: createBucket()
    },
    queue: {
      short: createBucket(),
      rising: createBucket(),
      long: createBucket()
    },
    premiumReuse: {
      fresh: createBucket(),
      warm: createBucket(),
      hot: createBucket()
    },
    subscriber: {
      residence: createBucket(),
      business: createBucket(),
      hotel: createBucket(),
      government: createBucket()
    },
    grade: {
      senior: createBucket(),
      operator: createBucket(),
      trainee: createBucket()
    }
  }
}

function ensureTraitBuckets (table, subjectKey) {
  if (!table[subjectKey]) table[subjectKey] = createTraitBuckets()
  return table[subjectKey]
}

function finalizeKeyTable (table, minWeight) {
  return Object.fromEntries(
    Object.entries(table).map(([subjectKey, buckets]) => [
      subjectKey,
      buckets.map((bucket) => (bucket.weight >= minWeight ? Number((bucket.total / bucket.weight).toFixed(3)) : null))
    ])
  )
}

function weightedAverageScoreTables (weightedTables) {
  const aggregate = {}

  for (const { table, weight } of weightedTables) {
    if (!table || weight <= 0) continue
    for (const [subjectKey, rows] of Object.entries(table)) {
      if (!aggregate[subjectKey]) {
        aggregate[subjectKey] = rows.map((entry) =>
          entry == null
            ? null
            : {
                total: entry * weight,
                weight
              }
        )
        continue
      }

      rows.forEach((entry, index) => {
        if (entry == null) return
        if (!aggregate[subjectKey][index]) {
          aggregate[subjectKey][index] = { total: entry * weight, weight }
          return
        }
        aggregate[subjectKey][index].total += entry * weight
        aggregate[subjectKey][index].weight += weight
      })
    }
  }

  return Object.fromEntries(
    Object.entries(aggregate).map(([subjectKey, rows]) => [
      subjectKey,
      rows.map((entry) => (entry && entry.weight > 0 ? Number((entry.total / entry.weight).toFixed(3)) : null))
    ])
  )
}

function weightedAverageTraitTables (weightedTables) {
  const aggregate = {}

  for (const { table, weight } of weightedTables) {
    if (!table || weight <= 0) continue
    for (const [subjectKey, values] of Object.entries(table)) {
      if (!aggregate[subjectKey]) {
        aggregate[subjectKey] = values.map((value) => ({ total: value * weight, weight }))
        continue
      }

      values.forEach((value, index) => {
        aggregate[subjectKey][index].total += value * weight
        aggregate[subjectKey][index].weight += weight
      })
    }
  }

  return Object.fromEntries(
    Object.entries(aggregate).map(([subjectKey, values]) => [
      subjectKey,
      values.map((entry) => Number((entry.total / Math.max(entry.weight, 1)).toFixed(3)))
    ])
  )
}

/**
 * Convert raw trait buckets into the 8-element trait vector used by the runtime.
 * Each trait compares performance across conditions (e.g. calm vs hot pressure)
 * to detect behavioral dimensions like collapse under stress.
 */
function finalizeTraitTable (table) {
  const finalized = {}

  for (const [subjectKey, stats] of Object.entries(table)) {
    const overall = bucketAverage(stats.overall, -0.2)
    // Pressure collapse: blend calm(70%) + building(30%) vs hot
    const calmScore =
      (bucketAverage(stats.pressure.calm, overall) * 0.7 + bucketAverage(stats.pressure.building, overall) * 0.3)
    const hotScore = bucketAverage(stats.pressure.hot, overall)
    // Load collapse: blend low(55%) + medium(45%) vs blend high(55%) + peak(45%)
    const lowLoadScore =
      (bucketAverage(stats.load.low, overall) * 0.55 + bucketAverage(stats.load.medium, overall) * 0.45)
    const highLoadScore =
      (bucketAverage(stats.load.high, overall) * 0.55 + bucketAverage(stats.load.peak, overall) * 0.45)
    const shortQueueScore = bucketAverage(stats.queue.short, overall)
    const longQueueScore = bucketAverage(stats.queue.long, overall)
    const freshPremiumScore = bucketAverage(stats.premiumReuse.fresh, overall)
    const warmPremiumScore = bucketAverage(stats.premiumReuse.warm, freshPremiumScore)
    const hotPremiumScore = bucketAverage(stats.premiumReuse.hot, warmPremiumScore)
    const governmentScore = bucketAverage(stats.subscriber.government, overall)
    const businessScore = bucketAverage(stats.subscriber.business, overall)
    const seniorScore = bucketAverage(stats.grade.senior, overall)
    const operatorScore = bucketAverage(stats.grade.operator, seniorScore)
    const traineeScore = bucketAverage(stats.grade.trainee, operatorScore)
    // Grade spread: how much senior vs operator/trainee diverge (noisier data = lower reliability)
    const gradeSpread =
      Math.abs(seniorScore - operatorScore) * 0.8 + Math.abs(seniorScore - traineeScore) * 0.35
    // Confidence saturates at ~72 weighted observations (roughly one family's share of 4800 rows)
    const sampleConfidence = clamp(stats.overall.weight / 72, 0.18, 1)
    const reliability = clamp(1 - gradeSpread, 0.18, 1) * sampleConfidence

    finalized[subjectKey] = [
      Number(Math.max(0, calmScore - hotScore).toFixed(3)),
      Number(Math.max(0, lowLoadScore - highLoadScore).toFixed(3)),
      Number(Math.max(0, shortQueueScore - longQueueScore).toFixed(3)),
      Number(Math.max(0, freshPremiumScore - hotPremiumScore).toFixed(3)),
      Number(Math.max(0, freshPremiumScore - warmPremiumScore).toFixed(3)),
      Number((governmentScore - overall).toFixed(3)),
      Number((businessScore - overall).toFixed(3)),
      Number(reliability.toFixed(3))
    ]
  }

  return finalized
}

/**
 * Infer a posterior distribution over board profiles from traffic mix statistics.
 * Each profile has characteristic route/billing/subscriber patterns (e.g. civic-desk
 * has high priority + government rates). Rate multipliers scale the evidence strength.
 */
function inferProfilePosterior (observations) {
  const routeCounts = Object.fromEntries(ROUTE_CODES.map((route) => [route, 0]))
  const verifiedShare = { verified: 0, total: 0 }
  const collectShare = { collect: 0, total: 0 }
  const governmentShare = { government: 0, total: 0 }

  for (const observation of observations) {
    routeCounts[observation.call.routeCode] += 1
    verifiedShare.total += 1
    collectShare.total += 1
    governmentShare.total += 1
    if (observation.call.billingMode === 'verified') verifiedShare.verified += 1
    if (observation.call.billingMode === 'collect') collectShare.collect += 1
    if (observation.call.subscriberClass === 'government') governmentShare.government += 1
  }

  const localRate = routeCounts.local / Math.max(observations.length, 1)
  const relayRate = routeCounts.relay / Math.max(observations.length, 1)
  const priorityRate = routeCounts.priority / Math.max(observations.length, 1)
  const verifiedRate = verifiedShare.verified / Math.max(verifiedShare.total, 1)
  const collectRate = collectShare.collect / Math.max(collectShare.total, 1)
  const governmentRate = governmentShare.government / Math.max(governmentShare.total, 1)

  const raw = {
    switchboard: 1 + localRate * 2.2,
    'front-office': 1 + verifiedRate * 2 + priorityRate * 1.6,
    'night-rush': 1 + relayRate * 2.1 + collectRate * 1.2,
    'civic-desk': 1 + priorityRate * 1.6 + governmentRate * 2.4 + verifiedRate * 1.4,
    'commuter-belt': 1 + localRate * 1.6 + collectRate * 1.8,
    'storm-watch': 1 + priorityRate * 1.4 + verifiedRate * 1.2 + relayRate * 0.6
  }
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(
    Object.entries(raw).map(([profile, value]) => [profile, Number((value / total).toFixed(4))])
  )
}

/**
 * Infer the likely number of hidden families (3, 4, or 5) from the visible family
 * diversity and trainee noise rate. More visible families suggest more hidden ones.
 * High trainee rates slightly boost the 5-family hypothesis (more diversity = more noise).
 */
function inferFamilyCountPosterior (lines, observations) {
  const visibleFamilies = new Set(lines.map((line) => classifyVisibleFamily(line)))
  const traineeRate =
    observations.filter((row) => row.operatorGrade === 'trainee').length / Math.max(observations.length, 1)
  const base =
    visibleFamilies.size >= 5
      ? { 3: 0.12, 4: 0.34, 5: 0.54 }
      : visibleFamilies.size === 4
        ? { 3: 0.26, 4: 0.48, 5: 0.26 }
        : { 3: 0.48, 4: 0.38, 5: 0.14 }
  if (traineeRate > 0.22) {
    base[5] += 0.05
    base[3] -= 0.03
  }
  const total = Object.values(base).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(
    Object.entries(base).map(([count, value]) => [count, Number((value / total).toFixed(4))])
  )
}

export function inferHiringBarModelFromArtifacts (artifacts) {
  const { lines, observations } = parseArtifacts(artifacts)
  const visibleFamilyByGroup = Object.fromEntries(lines.map((line) => [line.lineGroupId, classifyVisibleFamily(line)]))
  const rawGroupKeyScores = {}
  const rawFamilyKeyScores = {}
  const rawGroupTraits = {}
  const rawFamilyTraits = {}

  for (const observation of observations) {
    const weight = GRADE_WEIGHTS[observation.operatorGrade] ?? 0.4
    const score = OUTCOME_SCORES[observation.outcome.result] ?? -0.28
    const keyIndex = callKeyIndex(observation.call)
    const groupId = observation.historicalLineGroup
    const visibleFamily = visibleFamilyByGroup[groupId] ?? 'district'
    const groupKeyBuckets = ensureKeyBuckets(rawGroupKeyScores, groupId)
    const familyKeyBuckets = ensureKeyBuckets(rawFamilyKeyScores, visibleFamily)
    const groupTraits = ensureTraitBuckets(rawGroupTraits, groupId)
    const familyTraits = ensureTraitBuckets(rawFamilyTraits, visibleFamily)

    addBucket(groupKeyBuckets[keyIndex], score, weight)
    addBucket(familyKeyBuckets[keyIndex], score, weight)

    for (const traitBuckets of [groupTraits, familyTraits]) {
      addBucket(traitBuckets.overall, score, weight)
      addBucket(traitBuckets.pressure[observation.context.pressureBand], score, weight)
      addBucket(traitBuckets.load[observation.context.loadBand], score, weight)
      addBucket(traitBuckets.queue[observation.context.queueBand], score, weight)
      addBucket(traitBuckets.subscriber[observation.call.subscriberClass], score, weight)
      addBucket(traitBuckets.grade[observation.operatorGrade], score, weight)
      if (observation.decision.usedPremium) {
        addBucket(traitBuckets.premiumReuse[observation.context.premiumReuseBand], score, weight)
      }
    }
  }

  const visibleFamilyTraits = finalizeTraitTable(rawFamilyTraits)

  return {
    visibleFamilyByGroup,
    // Group-level needs fewer observations (1.15) since individual groups are sparse
    groupKeyScores: finalizeKeyTable(rawGroupKeyScores, 1.15),
    // Family-level requires more observations (4) since families aggregate many groups
    visibleFamilyKeyScores: finalizeKeyTable(rawFamilyKeyScores, 4),
    groupTraits: finalizeTraitTable(rawGroupTraits),
    visibleFamilyTraits,
    collapseThresholdEstimates: Object.fromEntries(
      Object.entries(visibleFamilyTraits).map(([family, traits]) => [family, Number(((traits[0] + traits[1]) / 2).toFixed(3))])
    ),
    premiumROISummaries: Object.fromEntries(
      Object.entries(visibleFamilyTraits).map(([family, traits]) => [family, Number((traits[3] - traits[4]).toFixed(3))])
    ),
    operatorGradeWeights: { ...GRADE_WEIGHTS },
    inferredProfilePosterior: inferProfilePosterior(observations),
    familyCountPosterior: inferFamilyCountPosterior(lines, observations)
  }
}

function mergePosteriors (posteriors, keys) {
  const totals = Object.fromEntries(keys.map((key) => [key, 0]))
  for (const posterior of posteriors) {
    for (const key of keys) {
      totals[key] += posterior[key] ?? 0
    }
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, Number((value / total).toFixed(4))])
  )
}

function averageScoreTables (models, key) {
  return weightedAverageScoreTables(models.map((model) => ({ table: model[key], weight: 1 })))
}

function averageTraitTables (models, key) {
  return weightedAverageTraitTables(models.map((model) => ({ table: model[key], weight: 1 })))
}

function buildProfileConditionedScores (models, key) {
  return Object.fromEntries(
    PROFILE_NAMES.map((profile) => [
      profile,
      weightedAverageScoreTables(
        models.map((model) => ({
          table: model[key],
          weight: model.inferredProfilePosterior[profile] ?? 0
        }))
      )
    ])
  )
}

function buildFamilyCountConditionedScores (models, key) {
  return Object.fromEntries(
    ['3', '4', '5'].map((count) => [
      count,
      weightedAverageScoreTables(
        models.map((model) => ({
          table: model[key],
          weight: model.familyCountPosterior[count] ?? 0
        }))
      )
    ])
  )
}

export function buildPriorBoardSummary (artifactsList) {
  const models = artifactsList.map((artifacts) => inferHiringBarModelFromArtifacts(artifacts))
  return {
    profilePosterior: mergePosteriors(models.map((model) => model.inferredProfilePosterior), PROFILE_NAMES),
    familyCountPosterior: mergePosteriors(models.map((model) => model.familyCountPosterior), ['3', '4', '5']),
    visibleFamilyKeyScores: averageScoreTables(models, 'visibleFamilyKeyScores'),
    visibleFamilyTraits: averageTraitTables(models, 'visibleFamilyTraits'),
    profileVisibleFamilyKeyScores: buildProfileConditionedScores(models, 'visibleFamilyKeyScores'),
    familyCountVisibleFamilyKeyScores: buildFamilyCountConditionedScores(models, 'visibleFamilyKeyScores'),
    collapseThresholdEstimates: Object.fromEntries(
      VISIBLE_FAMILIES.map((family) => [
        family,
        Number((((averageTraitTables(models, 'visibleFamilyTraits')[family]?.[0] ?? 0) + (averageTraitTables(models, 'visibleFamilyTraits')[family]?.[1] ?? 0)) / 2).toFixed(3))
      ])
    ),
    operatorGradeWeights: { ...GRADE_WEIGHTS },
    benchmarkSeedCount: artifactsList.length
  }
}
