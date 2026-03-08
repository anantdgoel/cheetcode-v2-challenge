import type {
  LineFamily,
  LoadBand,
  OperatorGrade,
  PremiumReuseBand,
  PressureBand,
  QueueBand,
  TrafficRegime
} from '@/core/domain/game'
import {
  PROFILE_BILLING_WEIGHTS,
  PROFILE_ROUTE_WEIGHTS,
  PROFILE_URGENCY_WEIGHTS,
  SUBSCRIBER_CLASSES,
  TRAFFIC_REGIME_ORDER
} from './config/constants'
import { GAME_BALANCE } from './config/balance'
import { clamp, createRng, pick, premiumEligible, weightedPick, type Rng } from './shared'
import type { BoardModel, LineModel, ObservationRow, TrafficEvent } from './models'
import { connectProbability } from './routing-math'
import { createPressureCurve } from './traffic-generation'

function chooseObservationBiasFamily (call: Pick<TrafficEvent, 'routeCode' | 'billingMode' | 'urgency'>): LineFamily {
  if (call.routeCode === 'local') return 'district'
  if (call.routeCode === 'relay' || call.billingMode === 'collect') return 'relay'
  if (call.routeCode === 'priority' && call.billingMode === 'verified') return 'exchange'
  if (call.routeCode === 'intercity' || call.urgency === 'priority') return 'trunk'
  return 'suburban'
}

function getObservationFamilyWeights (
  call: Pick<TrafficEvent, 'routeCode' | 'billingMode' | 'urgency'>,
  activeFamilies: LineFamily[]
): Record<LineFamily, number> {
  const preferredFamily = chooseObservationBiasFamily(call)
  return activeFamilies.reduce(
    (acc, family) => {
      const weights = GAME_BALANCE.trafficShape.observations.familyWeights[family]
      acc[family] = family === preferredFamily ? weights.preferred : weights.fallback
      return acc
    },
    {} as Record<LineFamily, number>
  )
}

function pickLineForObservation (
  rng: Rng,
  board: BoardModel,
  lines: LineModel[],
  activeFamilies: LineFamily[],
  call: Pick<TrafficEvent, 'routeCode' | 'billingMode' | 'urgency'>
) {
  const familyWeights = getObservationFamilyWeights(call, activeFamilies)
  const distortion = 1 - board.hiddenTraits.historyReliability
  const weightedLines = lines.map((line) => ({
    line,
    weight:
      (familyWeights[line.family] * (1 - distortion * GAME_BALANCE.trafficShape.observations.historyDistortion.visibleFamilyBiasRateMax) +
        familyWeights[line.visibleFamily] * distortion * GAME_BALANCE.trafficShape.observations.historyDistortion.visibleFamilyBiasRateMax) *
      (line.isPremiumTrunk && premiumEligible(call) ? GAME_BALANCE.trafficShape.observations.premiumEligibleWeight : 1)
  }))
  const totalWeight = weightedLines.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = rng() * totalWeight
  for (const entry of weightedLines) {
    roll -= entry.weight
    if (roll <= 0) return entry.line
  }
  return weightedLines[0]?.line ?? lines[0]
}

function getRepresentativeLoad (loadBand: LoadBand) {
  return GAME_BALANCE.trafficShape.observations.representativeLoadByBand[loadBand]
}

function getRepresentativeQueueSeconds (queueBand: QueueBand) {
  return GAME_BALANCE.trafficShape.observations.representativeQueueSecondsByBand[queueBand]
}

function getPressureBand (pressure: number): PressureBand {
  if (pressure >= GAME_BALANCE.runtimePenalties.pressureBandThresholds.hot) return 'hot'
  if (pressure >= GAME_BALANCE.runtimePenalties.pressureBandThresholds.building) return 'building'
  return 'calm'
}

function premiumReuseHeatForBand (band: PremiumReuseBand) {
  if (band === 'hot') return 2.2
  if (band === 'warm') return 1.2
  return 0.3
}

function choosePremiumReuseBand (rng: Rng, loadBand: LoadBand, selected: LineModel): PremiumReuseBand {
  if (!selected.isPremiumTrunk) return 'fresh'
  if (loadBand === 'peak') return rng() < 0.55 ? 'hot' : 'warm'
  if (loadBand === 'high') return rng() < 0.3 ? 'hot' : 'warm'
  return rng() < 0.25 ? 'warm' : 'fresh'
}

function chooseOperatorGrade (rng: Rng): OperatorGrade {
  return weightedPick(rng, GAME_BALANCE.trafficShape.observations.operatorGradeWeights)
}

function trafficRegimeFor (index: number): TrafficRegime {
  return TRAFFIC_REGIME_ORDER[index % TRAFFIC_REGIME_ORDER.length]
}

function flipOutcome (rng: Rng, result: ObservationRow['outcome']['result']) {
  if (result === 'connected') return pick(rng, ['held', 'fault'] as ObservationRow['outcome']['result'][])
  if (result === 'held') return pick(rng, ['connected', 'fault'] as ObservationRow['outcome']['result'][])
  if (result === 'fault') return pick(rng, ['held', 'connected'] as ObservationRow['outcome']['result'][])
  return pick(rng, ['held', 'connected'] as ObservationRow['outcome']['result'][])
}

function isSeededNoiseRow (board: BoardModel, index: number) {
  const distortion = 1 - board.hiddenTraits.historyReliability
  const noiseRate =
    GAME_BALANCE.trafficShape.observations.seededNoiseRate +
    distortion * GAME_BALANCE.trafficShape.observations.historyDistortion.extraNoiseRateMax
  return createRng(`${board.seed}:observations:noise:${index}`)() < noiseRate
}

export function createObservations (board: BoardModel): ObservationRow[] {
  const rng = createRng(`${board.seed}:observations`)
  const rows: ObservationRow[] = []
  const pressureCurve = createPressureCurve(board, 'final')
  const distortion = 1 - board.hiddenTraits.historyReliability

  for (let index = 0; index < GAME_BALANCE.trafficShape.observations.rowCount; index += 1) {
    const routeCode = weightedPick(rng, PROFILE_ROUTE_WEIGHTS[board.boardProfile])
    const billingMode = weightedPick(rng, PROFILE_BILLING_WEIGHTS[board.boardProfile])
    const urgency = weightedPick(rng, PROFILE_URGENCY_WEIGHTS[board.boardProfile])
    const subscriberClass =
      board.boardProfile === 'civic-desk' && rng() < 0.3 ? 'government' : pick(rng, SUBSCRIBER_CLASSES)
    const loadBand = pick(rng, ['low', 'medium', 'high', 'peak'] as LoadBand[])
    const queueBand = pick(rng, ['short', 'rising', 'long'] as QueueBand[])
    const operatorGrade = chooseOperatorGrade(rng)
    const selected = pickLineForObservation(rng, board, board.lines, board.activeFamilies, { routeCode, billingMode, urgency })
    const baseLoad = getRepresentativeLoad(loadBand)
    const loadRelief =
      (loadBand === 'high' || loadBand === 'peak'
        ? distortion * board.hiddenTraits.pressureCollapse * GAME_BALANCE.trafficShape.observations.historyDistortion.loadReliefMax
        : 0) +
      distortion * board.hiddenTraits.tempoLag * 0.04
    const load = clamp(baseLoad - loadRelief, 0.08, 0.95)
    const pressure = pressureCurve.points[index % pressureCurve.points.length] ?? load
    const historicalPressure = clamp(pressure - loadRelief * 0.8, 0.08, 0.98)
    const pressureBand = getPressureBand(historicalPressure)
    const premiumReuseBand = choosePremiumReuseBand(rng, loadBand, selected)
    const queuedForSeconds = getRepresentativeQueueSeconds(queueBand)
    const premiumHeat = Math.max(
      0,
      premiumReuseHeatForBand(premiumReuseBand) -
        distortion *
          board.hiddenTraits.premiumFragility *
          GAME_BALANCE.trafficShape.observations.historyDistortion.premiumHeatReliefMax
    )

    const resultRoll = connectProbability(
      selected,
      { routeCode, subscriberClass, billingMode, urgency },
      load,
      queuedForSeconds,
      selected.loadSoftCap,
      premiumHeat
    )
    const usedPremium = selected.isPremiumTrunk && premiumEligible({ routeCode, billingMode, urgency })
    let result: ObservationRow['outcome']['result']

    if (isSeededNoiseRow(board, index)) {
      result = pick(rng, ['connected', 'held', 'fault', 'dropped'] as ObservationRow['outcome']['result'][])
    } else if (rng() < resultRoll) {
      result = 'connected'
    } else {
      const faultWeight = clamp(
        load + (1 - selected.loadSoftCap) + GAME_BALANCE.trafficShape.observations.faultWeight.additive,
        GAME_BALANCE.trafficShape.observations.faultWeight.min,
        GAME_BALANCE.trafficShape.observations.faultWeight.max
      )
      const dropWeight = clamp(
        queuedForSeconds / 18 + (queueBand === 'long' ? GAME_BALANCE.trafficShape.observations.dropWeight.longQueueBonus : 0),
        GAME_BALANCE.trafficShape.observations.dropWeight.min,
        GAME_BALANCE.trafficShape.observations.dropWeight.max
      )
      const heldWeight = clamp(
        1 -
          faultWeight * GAME_BALANCE.trafficShape.observations.heldWeight.faultFactor -
          dropWeight * GAME_BALANCE.trafficShape.observations.heldWeight.dropFactor,
        GAME_BALANCE.trafficShape.observations.heldWeight.min,
        GAME_BALANCE.trafficShape.observations.heldWeight.max
      )
      const failureRoll = rng() * (faultWeight + dropWeight + heldWeight)
      result =
        failureRoll <= heldWeight
          ? 'held'
          : failureRoll <= heldWeight + faultWeight
            ? 'fault'
            : 'dropped'
    }

    if (
      operatorGrade === 'trainee' &&
      resultRoll >= GAME_BALANCE.trafficShape.observations.traineeAdversarial.borderlineMin &&
      resultRoll <= GAME_BALANCE.trafficShape.observations.traineeAdversarial.borderlineMax &&
      rng() < GAME_BALANCE.trafficShape.observations.traineeAdversarial.outcomeFlipRate
    ) {
      result = flipOutcome(rng, result)
    }

    rows.push({
      logId: `obs-${String(index + 1).padStart(5, '0')}`,
      shiftBucket: `bucket-${Math.floor(index / GAME_BALANCE.trafficShape.observations.shiftBucketSize)}`,
      trafficRegime: trafficRegimeFor(index),
      operatorGrade,
      historicalLineAlias: selected.historicalAlias,
      historicalLineGroup: selected.lineGroupId,
      call: { routeCode, subscriberClass, billingMode, urgency },
      context: {
        loadBand,
        pressureBand,
        queueBand,
        premiumReuseBand,
        recentIncidentsNearLine: Math.floor(rng() * GAME_BALANCE.trafficShape.observations.recentIncidentsMaxExclusive)
      },
      decision: {
        action: result === 'held' ? 'hold' : 'route',
        usedPremium
      },
      outcome: {
        result,
        ...(result === 'held' || result === 'dropped'
          ? { holdBand: queueBand === 'short' ? 'brief' : queueBand === 'rising' ? 'moderate' : 'long' }
          : {})
      }
    })
  }

  return rows
}
