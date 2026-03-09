/**
 * exchange-agent-runtimes.mjs — Runtime decision logic and policy source generation
 *
 * INTENTIONAL DUPLICATION NOTICE
 * ──────────────────────────────
 * This file re-declares constants and utility functions that also exist in
 * exchange-agent-common.mjs (ROUTE_CODES, BILLING_MODES, URGENCIES,
 * FAMILY_MARKS, FAMILY_TAGS, premiumEligible, classifyVisibleFamily,
 * familyRouteBias, routeIndexFor, billingIndexFor, urgencyIndexFor,
 * callKeyIndex).
 *
 * This is intentional. buildPolicySource() serializes helper functions via
 * Function.prototype.toString() to generate self-contained JavaScript that
 * runs inside a QuickJS sandbox. Those helpers must be declared as plain
 * functions in this file's scope — imports would serialize as binding
 * references, not function bodies.
 *
 * If you change any shared constants or functions, update BOTH files.
 * exchange-agent-common.mjs is the import-friendly version; this file is
 * the serialization-friendly version.
 *
 * Public API: import from v3-agent-policies.mjs instead of this file directly.
 */
const ROUTE_CODES = ['local', 'intercity', 'relay', 'priority']
const BILLING_MODES = ['standard', 'verified', 'collect']
const URGENCIES = ['routine', 'priority']

const FAMILY_MARKS = {
  district: ['D-4', 'N-2', 'B-3', 'C-9'],
  relay: ['L-5', 'H-6'],
  trunk: ['T-1', 'P-7', 'M-4'],
  exchange: ['P-7', 'H-6', 'C-9'],
  suburban: ['D-4', 'L-5', 'B-3']
}

const FAMILY_TAGS = {
  district: ['residential', 'street', 'borough', 'meter', 'ledger'],
  relay: ['transit', 'junction', 'hotel'],
  trunk: ['continental', 'commercial', 'trunk'],
  exchange: ['government', 'desk', 'junction', 'continental', 'ledger'],
  suburban: ['street', 'borough', 'junction', 'commercial', 'meter']
}

/**
 * Per-group/family trait vector. Each index encodes a behavioral dimension
 * inferred from the observation history:
 *
 *  [0] pressureCollapse   — performance drop under high pressure (0.16)
 *  [1] loadCollapse       — performance drop under high load (0.11)
 *  [2] queueSensitivity   — performance drop under long queues (0.09)
 *  [3] premiumFragility   — degradation on repeated premium trunk reuse (0.12)
 *  [4] premiumWarmDecay   — early premium degradation before full heat (0.05)
 *  [5] governmentAffinity — performance delta for government calls (0)
 *  [6] businessAffinity   — performance delta for business calls (0)
 *  [7] reliability        — confidence weight, clamped to [0.18, 1.0] (0.42)
 *
 * Defaults approximate a neutral line group with moderate reliability.
 */
const DEFAULT_TRAITS = [0.16, 0.11, 0.09, 0.12, 0.05, 0, 0, 0.42]

/**
 * Runtime tuning knobs that scale specific scoring components.
 * These are the values an LLM rewrite can adjust based on probe feedback.
 * All caution/priority values default to 1.0 (neutral). Safe range: [0.4, 1.8].
 *
 *  holdBias          — shifts the hold-vs-connect threshold (-1 to 1, 0 = neutral)
 *  premiumCaution    — scales premium trunk heat penalties
 *  stressCaution     — scales pressure and load stress penalties
 *  queueCaution      — scales queue-depth penalties
 *  tempoCaution      — scales tempo-based adjustments (surging/cooling)
 *  faultCaution      — scales fault-feedback penalties
 *  governmentPriority — scales government subscriber affinity bonus
 *  businessPriority   — scales business subscriber affinity bonus
 */
const DEFAULT_TUNING = {
  holdBias: 0,
  premiumCaution: 1,
  stressCaution: 1,
  queueCaution: 1,
  tempoCaution: 1,
  faultCaution: 1,
  governmentPriority: 1,
  businessPriority: 1
}

function renderConst (name, value) {
  return `const ${name} = ${JSON.stringify(value)};`
}

function buildPolicySource ({ bindings = [], helpers = [], connectSource }) {
  return [...bindings, ...helpers.map((helper) => helper.toString()), connectSource]
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}()[\],;:+*/<>=%\-&|!?])\s*/g, '$1'))
    .join('\n')
}

function premiumEligible (call) {
  return (
    (call.routeCode === 'intercity' && call.billingMode === 'verified') ||
    (call.routeCode === 'priority' && call.urgency === 'priority')
  )
}

function routeIndexFor (routeCode) {
  return ROUTE_CODES.indexOf(routeCode)
}

function billingIndexFor (billingMode) {
  return BILLING_MODES.indexOf(billingMode)
}

function urgencyIndexFor (urgency) {
  return URGENCIES.indexOf(urgency)
}

function callKeyIndex (call) {
  const routeIndex = routeIndexFor(call.routeCode)
  const billingIndex = billingIndexFor(call.billingMode)
  const urgencyIndex = urgencyIndexFor(call.urgency)
  if (routeIndex < 0 || billingIndex < 0 || urgencyIndex < 0) return 0
  return routeIndex * (BILLING_MODES.length * URGENCIES.length) + billingIndex * URGENCIES.length + urgencyIndex
}

function classifyVisibleFamily (line) {
  const scores = {}
  for (const family of Object.keys(FAMILY_MARKS)) {
    const tagMatches = line.classTags.filter((tag) => FAMILY_TAGS[family].includes(tag)).length
    const markMatch = FAMILY_MARKS[family].includes(line.switchMark) ? 1.6 : 0
    scores[family] = tagMatches * 1.05 + markMatch + (line.isPremiumTrunk && family === 'trunk' ? 0.25 : 0)
  }
  return Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'district'
}

function familyRouteBias (hiddenFamily, call) {
  if (hiddenFamily === 'district') {
    if (call.routeCode === 'local') return 0.68
    if (call.routeCode === 'priority') return 0.08
    return -0.28
  }
  if (hiddenFamily === 'relay') {
    if (call.routeCode === 'relay') return 0.64
    if (call.billingMode === 'collect') return 0.18
    if (call.routeCode === 'priority') return 0.16
    return -0.12
  }
  if (hiddenFamily === 'trunk') {
    if (call.routeCode === 'intercity') return call.billingMode === 'verified' ? 0.8 : 0.44
    if (call.routeCode === 'priority') return call.urgency === 'priority' ? 0.6 : 0.22
    return -0.22
  }
  if (hiddenFamily === 'exchange') {
    if (call.routeCode === 'priority') return call.billingMode === 'verified' ? 0.82 : 0.62
    if (call.billingMode === 'verified') return 0.24
    if (call.subscriberClass === 'government') return 0.22
    return -0.1
  }
  if (call.routeCode === 'local') return call.billingMode === 'collect' ? 0.54 : 0.46
  if (call.routeCode === 'relay') return 0.36
  if (call.routeCode === 'intercity' && call.urgency === 'routine') return 0.22
  return -0.08
}

function chooseSnapshotLineId (input) {
  const idle = input.lines.filter((line) => line.status === 'idle')
  if (!idle.length) return null

  if (
    input.call.routeCode === 'priority' ||
    (input.call.routeCode === 'intercity' && input.call.billingMode === 'verified')
  ) {
    const premium = idle.find((line) => line.isPremiumTrunk)
    return premium ? premium.id : idle[0].id
  }

  return null
}

function scoreOldHeuristicLine (call, line) {
  const visibleFamily = classifyVisibleFamily(line)
  let score = familyRouteBias(visibleFamily, call)

  if (line.maintenanceBand === 'recently_serviced') score += 0.16
  if (line.maintenanceBand === 'temperamental') score -= 0.24
  if (line.isPremiumTrunk) score += premiumEligible(call) ? 0.55 : -0.5
  if (!line.isPremiumTrunk && premiumEligible(call)) score -= 0.08
  if (call.subscriberClass === 'government' && visibleFamily === 'exchange') score += 0.18
  if (call.routeCode === 'local' && visibleFamily === 'suburban') score += 0.14

  return score
}

function chooseOldHeuristicLineId (input) {
  const idle = input.lines.filter((line) => line.status === 'idle')
  if (!idle.length) return null

  const ranked = idle
    .map((line) => ({ lineId: line.id, score: scoreOldHeuristicLine(input.call, line) }))
    .sort((left, right) => right.score - left.score)

  const best = ranked[0]
  if (!best) return null
  if (input.board.load > 0.95 && input.call.routeCode === 'local' && input.call.urgency === 'routine') {
    return null
  }
  return best.lineId
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lookupKeyScore (table, subjectKey, call) {
  const row = table?.[subjectKey]
  if (!row) return null
  return row[callKeyIndex(call)] ?? null
}

function lookupTraits (table, subjectKey) {
  return table?.[subjectKey] ?? DEFAULT_TRAITS
}

function decayMap (map, amount) {
  for (const key of Object.keys(map)) {
    const next = map[key] - Math.sign(map[key]) * amount
    map[key] = Math.abs(next) < amount ? 0 : next
    if (Math.abs(map[key]) < 0.005) delete map[key]
  }
}

function nudgeMap (map, key, delta, min, max) {
  map[key] = clamp((map[key] ?? 0) + delta, min, max)
}

function createAgentState () {
  return {
    lastSecond: -1,
    premiumHeatByGroup: {},
    pendingByLine: {},
    groupAdjustments: {},
    groupFaults: {},
    roomStress: 0
  }
}

function normalizeTuning (tuning) {
  return { ...DEFAULT_TUNING, ...(tuning || {}) }
}

function advanceAgentState (state, input) {
  const second = input.clock.second
  const elapsed = state.lastSecond < 0 ? 0 : Math.max(0, second - state.lastSecond)
  if (elapsed > 0) {
    // Premium heat decays at 0.07/s — a line cools from hot to neutral in ~12-15s
    for (const groupId of Object.keys(state.premiumHeatByGroup)) {
      state.premiumHeatByGroup[groupId] = Math.max(0, state.premiumHeatByGroup[groupId] - elapsed * 0.07)
      if (state.premiumHeatByGroup[groupId] < 0.02) delete state.premiumHeatByGroup[groupId]
    }
    // Group adjustment scores decay at 0.018/s — slow fade gives ~40s of feedback memory
    decayMap(state.groupAdjustments, elapsed * 0.018)
    // Group fault reputation decays at 0.03/s — faults fade in ~20-30s
    decayMap(state.groupFaults, elapsed * 0.03)
    // Room-wide stress decays at 0.045/s — aggregate stress recovers in ~15-20s
    state.roomStress = Math.max(0, state.roomStress - elapsed * 0.045)
  }

  const linesById = Object.fromEntries(input.lines.map((line) => [line.id, line]))
  for (const [lineId, pending] of Object.entries(state.pendingByLine)) {
    const current = linesById[lineId]
    if (!current) {
      delete state.pendingByLine[lineId]
      continue
    }
    if (current.status === 'fault') {
      // Fault: punish group score (-0.2), accumulate fault reputation (+0.18), spike stress (+0.24)
      nudgeMap(state.groupAdjustments, pending.groupId, -0.2, -0.75, 0.25)
      nudgeMap(state.groupFaults, pending.groupId, 0.18, 0, 1.2)
      state.roomStress = Math.min(1.8, state.roomStress + 0.24)
      delete state.pendingByLine[lineId]
      continue
    }
    if (current.status === 'busy') {
      // Success: small reward (+0.04), reduce fault reputation (-0.06), mild stress relief (-0.03)
      nudgeMap(state.groupAdjustments, pending.groupId, 0.04, -0.75, 0.25)
      nudgeMap(state.groupFaults, pending.groupId, -0.06, 0, 1.2)
      state.roomStress = Math.max(0, state.roomStress - 0.03)
      delete state.pendingByLine[lineId]
      continue
    }
    if (second - pending.second >= 3) {
      delete state.pendingByLine[lineId]
    }
  }

  state.lastSecond = second
}

/** Record a line selection: track pending outcome and accumulate premium heat. */
function recordSelection (state, line, input, traits) {
  state.pendingByLine[line.id] = {
    groupId: line.lineGroupId,
    second: input.clock.second
  }
  if (!line.isPremiumTrunk) return

  // Premium heat delta: base 0.88 + misuse penalty (0.5 if not eligible) + fragility scaling
  const premiumPenalty = premiumEligible(input.call) ? 0 : 0.5
  const fragility = (traits?.[3] ?? DEFAULT_TRAITS[3]) + (traits?.[4] ?? DEFAULT_TRAITS[4]) * 0.5
  const delta = 0.88 + premiumPenalty + fragility * 0.75
  state.premiumHeatByGroup[line.lineGroupId] = (state.premiumHeatByGroup[line.lineGroupId] ?? 0) + delta
}

function blendLookupScores (weightedTables, visibleFamily, call) {
  let total = 0
  let weightTotal = 0

  for (const [weight, table] of weightedTables) {
    if (!table || weight <= 0) continue
    const score = lookupKeyScore(table, visibleFamily, call)
    if (score == null) continue
    total += score * weight
    weightTotal += weight
  }

  return weightTotal > 0 ? total / weightTotal : null
}

function getPriorFamilyScore (model, priorSummary, visibleFamily, call) {
  if (!priorSummary) return null
  return lookupKeyScore(priorSummary.priorFamilyKeyScores, visibleFamily, call)
}

/**
 * Score a candidate line for a given call. This is the core routing decision.
 *
 * The score is built in phases:
 *  1. Confidence-weighted blend of group-specific vs family-level scores
 *  2. Prior-board integration (warm-start only, dampened when prior diverges)
 *  3. Stress factors from pressure, load, queue, and room stress
 *  4. Primary score = group(1.48) + family(0.82) + bias(0.2) - stress penalties
 *  5. Subscriber class bonuses (government/business affinity)
 *  6. Maintenance band adjustments
 *  7. Premium trunk heat: +0.52 bonus if eligible, -0.86 penalty if not
 *  8. Tempo adjustments and live fault/adjustment feedback
 */
function scoreLine (model, priorSummary, state, tuning, input, line) {
  const visibleFamily = model.visibleFamilyByGroup[line.lineGroupId] || 'district'
  const groupScore = lookupKeyScore(model.groupKeyScores, line.lineGroupId, input.call)
  const familyScore = lookupKeyScore(model.visibleFamilyKeyScores, visibleFamily, input.call)
  const priorFamilyScore = getPriorFamilyScore(model, priorSummary, visibleFamily, input.call)
  const groupTraits = lookupTraits(model.groupTraits, line.lineGroupId)
  const familyTraits = lookupTraits(model.visibleFamilyTraits, visibleFamily)

  // Phase 1: Confidence-weighted blend of group vs family scores
  // Higher confidence (trait[7]) trusts group-level data more; lower falls back to family
  const confidence = clamp(groupTraits[7] ?? DEFAULT_TRAITS[7], 0.18, 1)
  const fallbackFamilyScore =
    familyScore ?? priorFamilyScore ?? familyRouteBias(visibleFamily, input.call) * 0.62
  const blendedGroup =
    groupScore == null ? fallbackFamilyScore : groupScore * confidence + fallbackFamilyScore * (1 - confidence)

  // Phase 2: Prior-board integration (warm-start only)
  // Prior weight shrinks with confidence (0.28 base, -0.2 per confidence point, clamped [0.03, 0.18])
  // If prior and current data diverge by >0.26, dampen prior to 45% to avoid overfitting
  let priorWeight = priorSummary ? clamp(0.28 - confidence * 0.2, 0.03, 0.18) : 0
  if (priorFamilyScore != null && familyScore != null && Math.abs(priorFamilyScore - familyScore) > 0.26) {
    priorWeight *= 0.45
  }
  const blendedFamily =
    priorFamilyScore == null
      ? fallbackFamilyScore
      : fallbackFamilyScore * (1 - priorWeight) + priorFamilyScore * priorWeight

  // Phase 3: Stress factors — each converts a board metric into a 0-1+ penalty multiplier
  // Pressure kicks in above 0.52 (normalized over 0.34 range); surging tempo adds flat +0.18
  const pressureFactor =
    clamp((input.board.pressure - 0.52) / 0.34, 0, 1.35) + (input.board.tempo === 'surging' ? 0.18 : 0)
  // Load kicks in above 0.46 (normalized over 0.38 range); queue depth adds extra
  const loadFactor =
    clamp((input.board.load - 0.46) / 0.38, 0, 1.3) + clamp((input.board.queueDepth - 2) / 7, 0, 0.25)
  // Queue factor blends call wait time + board queue depth
  const queueFactor = clamp((input.call.queuedForSeconds + input.board.queueDepth * 0.9) / 16, 0, 1.3)
  // Live stress is the real-time composite: pressure + queue + tempo + accumulated room stress
  const liveStress =
    clamp((input.board.pressure - 0.58) / 0.24, 0, 1.2) +
    clamp((input.board.queueDepth - 3) / 5, 0, 0.4) +
    (input.board.tempo === 'surging' ? 0.18 : 0) +
    state.roomStress
  const liveFaultPenalty = input.lines.filter((candidate) => candidate.lineGroupId === line.lineGroupId && candidate.status === 'fault').length * 0.05

  // Phase 4: Primary score blend — group(1.48) + family(0.82) + heuristic bias(0.2)
  let score = blendedGroup * 1.48 + blendedFamily * 0.82 + familyRouteBias(visibleFamily, input.call) * 0.2
  // Trait-scaled stress penalties: pressureCollapse(trait[0]) and loadCollapse(trait[1])
  score -=
    (groupTraits[0] * 0.9 + familyTraits[0] * 0.4) *
    (pressureFactor + liveStress * 0.22) *
    tuning.stressCaution
  score -=
    (groupTraits[1] * 0.86 + familyTraits[1] * 0.3) *
    (loadFactor + liveStress * 0.18) *
    tuning.stressCaution
  // Queue sensitivity penalty (trait[2])
  score -= (groupTraits[2] * 0.55 + familyTraits[2] * 0.22) * queueFactor * tuning.queueCaution
  score -= liveFaultPenalty

  // Phase 5: Subscriber class affinity bonuses (traits[5] = gov, traits[6] = business)
  if (input.call.subscriberClass === 'government') {
    score += (groupTraits[5] * 0.72 + familyTraits[5] * 0.28) * tuning.governmentPriority
  } else if (input.call.subscriberClass === 'business') {
    score += (groupTraits[6] * 0.7 + familyTraits[6] * 0.3) * tuning.businessPriority
  }

  // Phase 6: Maintenance band adjustments
  if (line.maintenanceBand === 'recently_serviced') score += 0.12
  if (line.maintenanceBand === 'temperamental') {
    score -=
      (input.board.tempo === 'surging' ? 0.28 + liveStress * 0.08 : 0.2 + liveStress * 0.05) *
      tuning.tempoCaution
  }

  // Phase 7: Premium trunk scoring
  // Eligible calls get +0.52 bonus minus heat penalty; ineligible get -0.86 base penalty
  // Heat penalty scales with premiumFragility(trait[3]) and premiumWarmDecay(trait[4])
  if (line.isPremiumTrunk) {
    const heat = state.premiumHeatByGroup[line.lineGroupId] ?? 0
    const heatPenalty =
      heat *
      (0.11 + groupTraits[3] * 0.12 + groupTraits[4] * 0.05 + liveStress * 0.03) *
      tuning.premiumCaution
    score += premiumEligible(input.call)
      ? 0.52 - heatPenalty
      : -0.86 - heatPenalty * 1.25 - liveStress * 0.08 * tuning.premiumCaution
  } else if (premiumEligible(input.call)) {
    score -= 0.16 * tuning.premiumCaution
  } else {
    score += 0.03
  }

  // Phase 8: Tempo and live feedback adjustments
  if (input.board.tempo === 'surging' && (visibleFamily === 'exchange' || visibleFamily === 'suburban')) {
    score -= 0.08 * tuning.tempoCaution
  }
  if (input.board.tempo === 'cooling' && visibleFamily === 'exchange') {
    score += 0.04
  }

  score += state.groupAdjustments[line.lineGroupId] ?? 0
  score -= (state.groupFaults[line.lineGroupId] ?? 0) * (0.08 + liveStress * 0.03) * tuning.faultCaution

  return { lineId: line.id, line, score, traits: groupTraits }
}

function chooseDeferredHold (tuning, input, ranked, wantsPremium) {
  const best = ranked[0]
  if (!best) return false

  const quickRelease = input.lines
    .filter((line) => line.status !== 'idle')
    .map((line) => ({
      line,
      clearsIn:
        line.status === 'busy' ? line.secondsUntilBusyClears : line.secondsUntilFaultClears
    }))
    .filter((entry) => entry.clearsIn > 0 && entry.clearsIn <= 2)
    .sort((left, right) => left.clearsIn - right.clearsIn)

  const soonUseful = quickRelease.some(({ line }) =>
    wantsPremium ? line.isPremiumTrunk : !line.isPremiumTrunk
  )

  if (!soonUseful) return false
  if (input.call.attempt > 1 || input.call.queuedForSeconds > 2) return false
  if (best.score > (wantsPremium ? 0.08 : 0.02) + tuning.holdBias * 0.08) return false
  return true
}

function chooseAgentLineId (model, priorSummary, tuning, state, input) {
  advanceAgentState(state, input)

  const idle = input.lines.filter((line) => line.status === 'idle')
  if (!idle.length) return null

  const wantsPremium = premiumEligible(input.call)
  const ranked = idle
    .map((line) => scoreLine(model, priorSummary, state, tuning, input, line))
    .sort((left, right) => right.score - left.score)

  const best = ranked[0]
  if (!best) return null

  if (chooseDeferredHold(tuning, input, ranked, wantsPremium)) {
    return null
  }
  if (
    input.call.routeCode === 'local' &&
    input.call.urgency === 'routine' &&
    input.board.load > 0.84 &&
    best.score < 0.12 + tuning.holdBias * 0.08
  ) {
    return null
  }
  if (
    state.roomStress > 0.7 &&
    input.call.queuedForSeconds < 2 &&
    input.call.attempt < 2 &&
    input.call.urgency !== 'priority' &&
    best.score < 0.18 + tuning.holdBias * 0.08
  ) {
    return null
  }
  if (input.board.pressure > 0.8 && input.board.queueDepth > 3 && best.score < -0.03 && input.call.attempt < 3) {
    return null
  }

  recordSelection(state, best.line, input, best.traits)
  return best.lineId
}

const COMMON_BINDINGS = [
  renderConst('ROUTE_CODES', ROUTE_CODES),
  renderConst('BILLING_MODES', BILLING_MODES),
  renderConst('URGENCIES', URGENCIES),
  renderConst('FAMILY_MARKS', FAMILY_MARKS),
  renderConst('FAMILY_TAGS', FAMILY_TAGS),
  renderConst('DEFAULT_TRAITS', DEFAULT_TRAITS)
]

const AGENT_BINDINGS = [
  renderConst('ROUTE_CODES', ROUTE_CODES),
  renderConst('BILLING_MODES', BILLING_MODES),
  renderConst('URGENCIES', URGENCIES),
  renderConst('DEFAULT_TRAITS', DEFAULT_TRAITS),
  renderConst('DEFAULT_TUNING', DEFAULT_TUNING)
]

function roundNumber (value) {
  return value == null ? null : Number(value.toFixed(1))
}

function compactScoreTable (table) {
  return Object.fromEntries(
    Object.entries(table || {}).map(([subjectKey, values]) => [subjectKey, values.map((value) => roundNumber(value))])
  )
}

function compactTraitTable (table) {
  return Object.fromEntries(
    Object.entries(table || {}).map(([subjectKey, values]) => [subjectKey, values.map((value) => roundNumber(value))])
  )
}

function compactSourceModel (model) {
  return {
    visibleFamilyByGroup: model.visibleFamilyByGroup,
    groupKeyScores: compactScoreTable(model.groupKeyScores),
    visibleFamilyKeyScores: compactScoreTable(model.visibleFamilyKeyScores),
    groupTraits: compactTraitTable(model.groupTraits),
    visibleFamilyTraits: compactTraitTable(model.visibleFamilyTraits)
  }
}

/**
 * Build a weighted prior score table blending three evidence sources:
 *   16% global average + 49% profile-conditioned + 35% family-count-conditioned
 * This gives the warm-start agent a Bayesian-flavored starting point from prior boards.
 */
function compactWeightedPriorTable (model, priorSummary) {
  if (!priorSummary) return {}
  const weightedTable = {}
  for (const family of Object.keys(priorSummary.visibleFamilyKeyScores || {})) {
    weightedTable[family] = (priorSummary.visibleFamilyKeyScores[family] || []).map((_, keyIndex) => {
      const routeCode = ROUTE_CODES[Math.floor(keyIndex / (BILLING_MODES.length * URGENCIES.length))]
      const remainder = keyIndex % (BILLING_MODES.length * URGENCIES.length)
      const billingMode = BILLING_MODES[Math.floor(remainder / URGENCIES.length)]
      const urgency = URGENCIES[remainder % URGENCIES.length]
      const call = { routeCode, billingMode, urgency }
      const profileTables = Object.entries(model.inferredProfilePosterior || {}).map(([profile, weight]) => [
        weight,
        priorSummary.profileVisibleFamilyKeyScores?.[profile]
      ])
      const familyCountTables = Object.entries(model.familyCountPosterior || {}).map(([count, weight]) => [
        weight,
        priorSummary.familyCountVisibleFamilyKeyScores?.[count]
      ])
      const globalScore = lookupKeyScore(priorSummary.visibleFamilyKeyScores, family, call)
      const profileScore = blendLookupScores(profileTables, family, call)
      const familyCountScore = blendLookupScores(familyCountTables, family, call)
      const resolvedGlobal = globalScore ?? profileScore ?? familyCountScore
      const resolvedProfile = profileScore ?? resolvedGlobal
      const resolvedFamilyCount = familyCountScore ?? resolvedGlobal
      if (resolvedGlobal == null) return null
      return roundNumber(resolvedGlobal * 0.16 + resolvedProfile * 0.49 + resolvedFamilyCount * 0.35)
    })
  }
  return weightedTable
}

function compactSourcePrior (model, priorSummary) {
  return {
    priorFamilyKeyScores: compactScoreTable(compactWeightedPriorTable(model, priorSummary))
  }
}

export function snapshotDecision (input) {
  return { lineId: chooseSnapshotLineId(input) }
}

export function oldHeuristicDecision (input) {
  return { lineId: chooseOldHeuristicLineId(input) }
}

export function createHiringBarDecisionFromModel (model) {
  const runtimeModel = compactSourceModel(model)
  const runtimeTuning = normalizeTuning()
  const state = createAgentState()
  return (input) => ({ lineId: chooseAgentLineId(runtimeModel, null, runtimeTuning, state, input) })
}

export function createWarmStartDecisionFromModel (model, priorSummary, tuning) {
  const runtimeModel = compactSourceModel(model)
  const runtimePrior = compactSourcePrior(model, priorSummary)
  const runtimeTuning = normalizeTuning(tuning)
  const state = createAgentState()
  return (input) => ({
    lineId: chooseAgentLineId(runtimeModel, runtimePrior, runtimeTuning, state, input)
  })
}

export function buildSnapshotPolicySource () {
  return buildPolicySource({
    bindings: COMMON_BINDINGS,
    helpers: [premiumEligible, chooseSnapshotLineId],
    connectSource: `function connect(input) {
  return { lineId: chooseSnapshotLineId(input) };
}`
  })
}

export function buildOldHeuristicPolicySource () {
  return buildPolicySource({
    bindings: COMMON_BINDINGS,
    helpers: [premiumEligible, classifyVisibleFamily, familyRouteBias, scoreOldHeuristicLine, chooseOldHeuristicLineId],
    connectSource: `function connect(input) {
  return { lineId: chooseOldHeuristicLineId(input) };
}`
  })
}

const AGENT_HELPERS = [
  routeIndexFor,
  billingIndexFor,
  urgencyIndexFor,
  callKeyIndex,
  premiumEligible,
  familyRouteBias,
  clamp,
  lookupKeyScore,
  lookupTraits,
  decayMap,
  nudgeMap,
  createAgentState,
  advanceAgentState,
  recordSelection,
  getPriorFamilyScore,
  scoreLine,
  chooseDeferredHold,
  chooseAgentLineId
]

export function buildHiringBarPolicySourceFromModel (model) {
  return buildPolicySource({
    bindings: [
      ...AGENT_BINDINGS,
      renderConst('__MODEL__', compactSourceModel(model)),
      renderConst('__TUNING__', normalizeTuning())
    ],
    helpers: AGENT_HELPERS,
    connectSource: `let __STATE__ = createAgentState();
function init() {
__STATE__ = createAgentState();
}
function connect(input) {
  return { lineId: chooseAgentLineId(__MODEL__, null, __TUNING__, __STATE__, input) };
}`
  })
}

export function buildWarmStartPolicySourceFromModel (model, priorSummary, tuning) {
  return buildPolicySource({
    bindings: [
      ...AGENT_BINDINGS,
      renderConst('__MODEL__', compactSourceModel(model)),
      renderConst('__PRIOR__', compactSourcePrior(model, priorSummary)),
      renderConst('__TUNING__', normalizeTuning(tuning))
    ],
    helpers: AGENT_HELPERS,
    connectSource: `let __STATE__ = createAgentState();
function init() {
__STATE__ = createAgentState();
}
function connect(input) {
  return { lineId: chooseAgentLineId(__MODEL__, __PRIOR__, __TUNING__, __STATE__, input) };
}`
  })
}
