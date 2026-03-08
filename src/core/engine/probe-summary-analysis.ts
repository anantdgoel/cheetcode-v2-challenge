import type {
  BillingMode,
  LoadBand,
  ProbeSummary,
  RouteCode,
  Urgency
} from '@/core/domain/game'
import { GAME_BALANCE } from './config/balance'
import { clamp, divideAndRound, loadBandForSimulationLoad } from './shared'
import type { BoardModel, FailureEvent, SimulationResult, SimulationTraceEvent } from './models'

const LOAD_BAND_ORDER: LoadBand[] = ['low', 'medium', 'high', 'peak']

type ProbeBucketAccumulator = {
  routeCode: RouteCode;
  billingMode: BillingMode;
  urgency: Urgency;
  attempts: number;
  connected: number;
  dropped: number;
  holdSeconds: number;
  premium: number;
}

type LoadBucketAccumulator = {
  attempts: number;
  connected: number;
  dropped: number;
  holdSeconds: number;
  premium: number;
}

type LineGroupAccumulator = {
  usageCount: number;
  connected: number;
  faults: number;
  premium: number;
}

export type SummarySignals = {
  hotConnectRate: number;
  calmConnectRate: number;
  hotDropRate: number;
  calmDropRate: number;
  secondHalfDropRate: number;
  firstHalfDropRate: number;
  secondHalfConnectRate: number;
  firstHalfConnectRate: number;
  premiumUsageRate: number;
  premiumFaultRate: number;
  premiumMisuseRate: number;
  holdFailureRate: number;
  droppedOnHoldRate: number;
  lowMarginFaultRate: number;
  failureRouteBreadth: number;
  lineGroupOverreach: number;
  lineGroupFaultPeak: number;
  historyUnreliability: number;
  finalShiftSensitivity: number;
  tempoLag: number;
  pressureCollapse: number;
  premiumFragility: number;
}

function getFailureBucketReason (
  event: FailureEvent
): ProbeSummary['failureBuckets'][number]['dominantReason'] {
  if (event.reason === 'dropped_on_hold') return 'hold_too_long'
  if (event.reason === 'low_margin_fault') return 'fault_under_load'
  if (event.reason === 'policy_hold' || event.reason === 'invalid_line' || event.reason === 'busy_line') {
    return 'low_margin_routing'
  }
  return 'premium_misuse'
}

function dominantReason (events: FailureEvent[]) {
  const counts = new Map<ProbeSummary['failureBuckets'][number]['dominantReason'], number>()
  for (const event of events) {
    const reason = getFailureBucketReason(event)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'low_margin_routing'
}

function toProbeTableRow (row: ProbeBucketAccumulator) {
  return {
    bucketId: `${row.routeCode}|${row.billingMode}|${row.urgency}`,
    routeCode: row.routeCode,
    billingMode: row.billingMode,
    urgency: row.urgency,
    attempts: row.attempts,
    connectRate: divideAndRound(row.connected, row.attempts, 3),
    dropRate: divideAndRound(row.dropped, row.attempts, 3),
    avgHoldSeconds: divideAndRound(row.holdSeconds, row.attempts, 2),
    premiumUsageRate: divideAndRound(row.premium, row.attempts, 3)
  }
}

function toLoadBandRow (loadBand: LoadBand, row: LoadBucketAccumulator) {
  return {
    loadBand,
    bucketId: loadBand,
    attempts: row.attempts,
    connectRate: divideAndRound(row.connected, row.attempts, 3),
    dropRate: divideAndRound(row.dropped, row.attempts, 3),
    avgHoldSeconds: divideAndRound(row.holdSeconds, row.attempts, 2),
    premiumUsageRate: divideAndRound(row.premium, row.attempts, 3)
  }
}

function toLineGroupRow ([lineGroupId, row]: [string, LineGroupAccumulator]) {
  return {
    lineGroupId,
    usageCount: row.usageCount,
    connectRate: divideAndRound(row.connected, row.usageCount, 3),
    faultRate: divideAndRound(row.faults, row.usageCount, 3),
    premiumUsageRate: divideAndRound(row.premium, row.usageCount, 3)
  }
}

function summarizeTraceRate (trace: SimulationTraceEvent[], predicate: (event: SimulationTraceEvent) => boolean) {
  if (!trace.length) return 0
  let matches = 0
  for (const event of trace) {
    if (predicate(event)) {
      matches += 1
    }
  }
  return matches / trace.length
}

function computePhaseRates (trace: SimulationTraceEvent[]) {
  const midpoint = trace.length ? trace[Math.floor(trace.length / 2)]?.atSecond ?? 0 : 0
  let firstHalfCount = 0
  let firstHalfDropped = 0
  let firstHalfConnected = 0
  let secondHalfCount = 0
  let secondHalfDropped = 0
  let secondHalfConnected = 0

  for (const event of trace) {
    const inFirstHalf = event.atSecond <= midpoint
    if (inFirstHalf) {
      firstHalfCount += 1
      if (event.outcome === 'connected') firstHalfConnected += 1
      if (event.outcome === 'fault' || event.outcome === 'dropped') firstHalfDropped += 1
      continue
    }

    secondHalfCount += 1
    if (event.outcome === 'connected') secondHalfConnected += 1
    if (event.outcome === 'fault' || event.outcome === 'dropped') secondHalfDropped += 1
  }

  return {
    secondHalfDropRate: secondHalfCount ? secondHalfDropped / secondHalfCount : 0,
    firstHalfDropRate: firstHalfCount ? firstHalfDropped / firstHalfCount : 0,
    secondHalfConnectRate: secondHalfCount ? secondHalfConnected / secondHalfCount : 0,
    firstHalfConnectRate: firstHalfCount ? firstHalfConnected / firstHalfCount : 0
  }
}

function computePressureRates (trace: SimulationTraceEvent[], loadBandTable: ProbeSummary['loadBandTable']) {
  const hotTrace = trace.filter((event) => event.boardPressure >= GAME_BALANCE.runtimePenalties.pressureBandThresholds.hot)
  const calmTrace = trace.filter((event) => event.boardPressure < GAME_BALANCE.runtimePenalties.pressureBandThresholds.building)
  const hotBand = loadBandTable.find((row) => row.loadBand === 'high' || row.loadBand === 'peak')
  const calmBand = loadBandTable.find((row) => row.loadBand === 'low') ?? loadBandTable.find((row) => row.loadBand === 'medium')
  return {
    hotConnectRate: hotTrace.length ? summarizeTraceRate(hotTrace, (event) => event.outcome === 'connected') : hotBand?.connectRate ?? 0,
    calmConnectRate: calmTrace.length ? summarizeTraceRate(calmTrace, (event) => event.outcome === 'connected') : calmBand?.connectRate ?? 0,
    hotDropRate: hotTrace.length ? summarizeTraceRate(hotTrace, (event) => event.outcome === 'fault' || event.outcome === 'dropped') : hotBand?.dropRate ?? 0,
    calmDropRate: calmTrace.length ? summarizeTraceRate(calmTrace, (event) => event.outcome === 'fault' || event.outcome === 'dropped') : calmBand?.dropRate ?? 0
  }
}

export function buildProbeTables (result: SimulationResult) {
  const callBuckets = new Map<string, ProbeBucketAccumulator>()
  const loadBuckets = new Map<LoadBand, LoadBucketAccumulator>()
  const lineGroups = new Map<string, LineGroupAccumulator>()
  const failureBucketCounts = new Map<string, number>()
  const failureBucketEvents = new Map<string, FailureEvent[]>()

  for (const event of result.trace) {
    const bucketId = `${event.routeCode}|${event.billingMode}|${event.urgency}`
    const callBucket = callBuckets.get(bucketId) ?? {
      routeCode: event.routeCode,
      billingMode: event.billingMode,
      urgency: event.urgency,
      attempts: 0,
      connected: 0,
      dropped: 0,
      holdSeconds: 0,
      premium: 0
    }
    callBucket.attempts += 1
    if (event.outcome === 'connected') callBucket.connected += 1
    if (event.outcome === 'dropped' || event.outcome === 'fault') callBucket.dropped += 1
    callBucket.holdSeconds += event.queuedForSeconds
    if (event.selectedLinePremium) callBucket.premium += 1
    callBuckets.set(bucketId, callBucket)

    const loadBand = loadBandForSimulationLoad(event.boardLoad)
    const loadBucket = loadBuckets.get(loadBand) ?? {
      attempts: 0,
      connected: 0,
      dropped: 0,
      holdSeconds: 0,
      premium: 0
    }
    loadBucket.attempts += 1
    if (event.outcome === 'connected') loadBucket.connected += 1
    if (event.outcome === 'dropped' || event.outcome === 'fault') loadBucket.dropped += 1
    loadBucket.holdSeconds += event.queuedForSeconds
    if (event.selectedLinePremium) loadBucket.premium += 1
    loadBuckets.set(loadBand, loadBucket)

    if (event.selectedLineGroupId) {
      const lineGroup = lineGroups.get(event.selectedLineGroupId) ?? {
        usageCount: 0,
        connected: 0,
        faults: 0,
        premium: 0
      }
      lineGroup.usageCount += 1
      if (event.outcome === 'connected') lineGroup.connected += 1
      if (event.outcome === 'fault') lineGroup.faults += 1
      if (event.selectedLinePremium) lineGroup.premium += 1
      lineGroups.set(event.selectedLineGroupId, lineGroup)
    }
  }

  for (const failure of result.failures) {
    const bucketId = `${failure.routeCode}|${failure.billingMode}|${failure.urgency}`
    failureBucketCounts.set(bucketId, (failureBucketCounts.get(bucketId) ?? 0) + 1)
    const bucketEvents = failureBucketEvents.get(bucketId)
    if (bucketEvents) {
      bucketEvents.push(failure)
    } else {
      failureBucketEvents.set(bucketId, [failure])
    }
  }

  const loadBandTable = LOAD_BAND_ORDER.map((loadBand) =>
    toLoadBandRow(loadBand, loadBuckets.get(loadBand) ?? {
      attempts: 0,
      connected: 0,
      dropped: 0,
      holdSeconds: 0,
      premium: 0
    })
  )

  return {
    callBucketTable: [...callBuckets.values()].map(toProbeTableRow).sort((left, right) => right.attempts - left.attempts),
    loadBandTable,
    lineGroupTable: [...lineGroups.entries()].map(toLineGroupRow).sort((left, right) => right.usageCount - left.usageCount),
    failureBuckets: [...failureBucketCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([bucketId, count]) => {
        const events = failureBucketEvents.get(bucketId) ?? []
        return {
          bucketId,
          count,
          dominantReason: dominantReason(events),
          confidence: Number(
            clamp(
              count / Math.max(result.metrics.totalCalls * GAME_BALANCE.probePresentation.confidenceTrafficFactor, 1),
              GAME_BALANCE.probePresentation.confidenceFloor,
              GAME_BALANCE.probePresentation.confidenceCeiling
            ).toFixed(2)
          )
        }
      })
  }
}

export function computeSignals (
  result: SimulationResult,
  loadBandTable: ProbeSummary['loadBandTable'],
  lineGroupTable: ProbeSummary['lineGroupTable'],
  board?: BoardModel
): SummarySignals {
  const premiumTrace = result.trace.filter((event) => event.selectedLinePremium)
  const holdFailures = result.failures.filter((event) => event.reason === 'policy_hold')
  const droppedOnHold = result.failures.filter((event) => event.reason === 'dropped_on_hold')
  const lowMarginFaults = result.failures.filter((event) => event.reason === 'low_margin_fault')
  const failureRoutes = new Set(result.failures.map((event) => event.routeCode))
  const peakLineGroupUsage = lineGroupTable[0]?.usageCount ?? 0

  return {
    ...computePressureRates(result.trace, loadBandTable),
    ...computePhaseRates(result.trace),
    premiumUsageRate: result.metrics.premiumUsageRate,
    premiumFaultRate: premiumTrace.length
      ? summarizeTraceRate(premiumTrace, (event) => event.outcome === 'fault' || event.outcome === 'dropped')
      : 0,
    premiumMisuseRate: divideAndRound(result.metrics.trunkMisuseCount, Math.max(result.metrics.totalCalls, 1), 3),
    holdFailureRate: divideAndRound(holdFailures.length, Math.max(result.metrics.totalCalls, 1), 3),
    droppedOnHoldRate: divideAndRound(droppedOnHold.length, Math.max(result.metrics.totalCalls, 1), 3),
    lowMarginFaultRate: divideAndRound(lowMarginFaults.length, Math.max(result.metrics.totalCalls, 1), 3),
    failureRouteBreadth: divideAndRound(failureRoutes.size, Object.keys(GAME_BALANCE.runtimePenalties.serviceDurationBaseByRoute).length, 3),
    lineGroupOverreach: divideAndRound(peakLineGroupUsage, Math.max(result.trace.length, 1), 3),
    lineGroupFaultPeak: lineGroupTable[0]?.faultRate ?? 0,
    historyUnreliability: 1 - (board?.hiddenTraits.historyReliability ?? 0.65),
    finalShiftSensitivity: board?.hiddenTraits.finalShiftSensitivity ?? 0.4,
    tempoLag: board?.hiddenTraits.tempoLag ?? 0.35,
    pressureCollapse: board?.hiddenTraits.pressureCollapse ?? 0.45,
    premiumFragility: board?.hiddenTraits.premiumFragility ?? 0.4
  }
}
