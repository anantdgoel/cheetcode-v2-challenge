import type { BoardTempo, RuntimeLineView } from '@/lib/domain/game'
import { GAME_BALANCE } from './config/balance'
import { clamp, createRng, premiumEligible, type Rng, type SimulationMode } from './shared'
import { getShiftFactor } from './final-phase'
import { getCallKey } from './routing-math'
import type { BoardModel, LineModel, TrafficEvent } from './models'

export type MutableLineState = {
  line: LineModel;
  busyUntil: number;
  faultUntil: number;
};

export type RuntimeContext = {
  board: BoardModel;
  mode: SimulationMode;
  curve: {
    duration: number;
    points: number[];
  };
  rng: Rng;
  premiumHeatByGroup: Map<string, number>;
};

export function getCurrentLoad (curve: RuntimeContext['curve'], second: number, queueDepth: number) {
  const base = curve.points[Math.min(second, curve.points.length - 1)] ?? GAME_BALANCE.runtimePenalties.defaultCurveLoad
  return clamp(
    base + Math.min(queueDepth, GAME_BALANCE.runtimePenalties.queueLoadCap) * GAME_BALANCE.runtimePenalties.queueLoadFactorPerCall,
    GAME_BALANCE.runtimePenalties.liveLoadClamp.min,
    GAME_BALANCE.runtimePenalties.liveLoadClamp.max
  )
}

export function getBoardTempo (board: BoardModel, mode: SimulationMode, second: number): BoardTempo {
  if (mode !== 'final' || board.finalPhaseChanges.length === 0) return 'steady'
  const activeChange = board.finalPhaseChanges.find((change) => {
    const start = change.shiftPoint - GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds
    const end = change.shiftPoint + change.durationSeconds
    return second >= start && second <= end
  })
  if (!activeChange) return 'steady'
  if (activeChange.loadDelta < 0 || activeChange.capDelta < 0) return 'cooling'
  return 'surging'
}

function jitterPressure (rng: Rng, pressure: number, spread: number) {
  return clamp(
    pressure + (rng() * spread * 2 - spread),
    GAME_BALANCE.trafficShape.pressure.publicNoise.min,
    GAME_BALANCE.trafficShape.pressure.publicNoise.max
  )
}

export function getPublicPressure (runtime: RuntimeContext, second: number, load: number) {
  return jitterPressure(
    createRng(`${runtime.board.seed}:${runtime.mode}:pressure:${second}`),
    load,
    GAME_BALANCE.trafficShape.pressure.publicNoise.spread
  )
}

function collapsePenaltyForLoad (board: BoardModel, load: number, scale: number) {
  if (load <= GAME_BALANCE.runtimePenalties.hiddenTraitEffects.collapseLoadThreshold) return 0
  return (
    (load - GAME_BALANCE.runtimePenalties.hiddenTraitEffects.collapseLoadThreshold) *
    board.hiddenTraits.pressureCollapse *
    scale
  )
}

function finalShiftCapDelta (board: BoardModel, second: number, line: LineModel) {
  if (board.finalPhaseChanges.length === 0) return 0
  return board.finalPhaseChanges.reduce((sum, change) => {
    if (change.kind !== 'cap_swing' || change.targetFamily !== line.family) return sum
    return sum + change.capDelta * getShiftFactor(second, change) * (1 + board.hiddenTraits.finalShiftSensitivity * 0.65)
  }, 0)
}

function finalShiftCompatibilityPenalty (board: BoardModel, second: number, line: LineModel) {
  if (board.finalPhaseChanges.length === 0) return 0
  const shiftPenalty = board.finalPhaseChanges.reduce((sum, change) => {
    const factor = getShiftFactor(second, change)
    if (factor <= 0) return sum
    return sum + factor * (change.targetFamily === line.family ? 1.25 : 0.7)
  }, 0)
  return (
    shiftPenalty *
    board.hiddenTraits.finalShiftSensitivity *
    GAME_BALANCE.runtimePenalties.hiddenTraitEffects.finalShiftPenaltyScale
  )
}

function premiumHeatMultiplier (board: BoardModel) {
  return 1 + board.hiddenTraits.premiumFragility * GAME_BALANCE.runtimePenalties.hiddenTraitEffects.premiumHeatFragilityScale
}

export function getEffectiveSoftCap (
  board: BoardModel,
  mode: SimulationMode,
  second: number,
  line: LineModel,
  load: number
) {
  const collapsePenalty = collapsePenaltyForLoad(
    board,
    load,
    GAME_BALANCE.runtimePenalties.hiddenTraitEffects.collapseSoftCapScale
  )
  const delta = mode === 'final' ? finalShiftCapDelta(board, second, line) : 0
  return clamp(
    line.loadSoftCap + delta - collapsePenalty,
    GAME_BALANCE.trafficShape.finalPhaseChange.effectiveSoftCapClamp.min,
    GAME_BALANCE.trafficShape.finalPhaseChange.effectiveSoftCapClamp.max
  )
}

export function getAdjustedLine (
  board: BoardModel,
  mode: SimulationMode,
  second: number,
  line: LineModel,
  call: Pick<TrafficEvent, 'routeCode' | 'billingMode' | 'urgency'>,
  queuedForSeconds: number,
  load: number
) {
  const key = getCallKey(call)
  let compatibility = line.compatibility[key] ?? 0.4
  compatibility -= collapsePenaltyForLoad(
    board,
    load,
    GAME_BALANCE.runtimePenalties.hiddenTraitEffects.collapsePenaltyScale
  )
  if (
    line.family === 'suburban' &&
    load > GAME_BALANCE.runtimePenalties.suburbanLoadPenalty.loadThreshold &&
    queuedForSeconds > GAME_BALANCE.runtimePenalties.suburbanLoadPenalty.queueThreshold
  ) {
    compatibility -= GAME_BALANCE.runtimePenalties.suburbanLoadPenalty.penalty
  }
  if (mode === 'final' && board.finalPhaseChanges.length > 0) {
    compatibility -= finalShiftCompatibilityPenalty(board, second, line)
    if (getBoardTempo(board, mode, second) === 'surging') {
      compatibility -=
        board.hiddenTraits.tempoLag *
        GAME_BALANCE.runtimePenalties.hiddenTraitEffects.tempoLagPenaltyScale
    }
  }
  return {
    ...line,
    compatibility: {
      ...line.compatibility,
      [key]: clamp(compatibility, 0.03, 0.99)
    }
  }
}

function getPremiumDecay (runtime: RuntimeContext) {
  return (
    GAME_BALANCE.runtimePenalties.premiumHeat.decayPerSecond *
    (1 - runtime.board.hiddenTraits.premiumFragility * GAME_BALANCE.runtimePenalties.hiddenTraitEffects.premiumHeatDecayReliefScale)
  )
}

export function decayPremiumHeat (runtime: RuntimeContext) {
  const decay = getPremiumDecay(runtime)
  for (const [groupId, heat] of runtime.premiumHeatByGroup.entries()) {
    runtime.premiumHeatByGroup.set(groupId, Math.max(0, heat - decay))
  }
}

export function getPremiumHeat (runtime: RuntimeContext, line: LineModel) {
  if (!line.isPremiumTrunk) return 0
  return runtime.premiumHeatByGroup.get(line.lineGroupId) ?? 0
}

export function applyPremiumHeat (
  runtime: RuntimeContext,
  line: LineModel,
  call: Pick<TrafficEvent, 'routeCode' | 'billingMode' | 'urgency'>
) {
  if (!line.isPremiumTrunk) return
  const current = runtime.premiumHeatByGroup.get(line.lineGroupId) ?? 0
  const next =
    current +
    (GAME_BALANCE.runtimePenalties.premiumHeat.useHeat +
      (premiumEligible(call) ? 0 : GAME_BALANCE.runtimePenalties.premiumHeat.misuseHeat)) *
      premiumHeatMultiplier(runtime.board)
  runtime.premiumHeatByGroup.set(line.lineGroupId, next)
}

export function toRuntimeLineViews (lines: MutableLineState[], second: number): RuntimeLineView[] {
  return lines.map((state) => {
    const busySeconds = Math.max(0, Math.ceil(state.busyUntil - second))
    const faultSeconds = Math.max(0, Math.ceil(state.faultUntil - second))
    const status = faultSeconds > 0 ? 'fault' : busySeconds > 0 ? 'busy' : 'idle'
    return {
      id: state.line.id,
      label: state.line.label,
      switchMark: state.line.switchMark,
      classTags: state.line.classTags,
      lineGroupId: state.line.lineGroupId,
      isPremiumTrunk: state.line.isPremiumTrunk,
      maintenanceBand: state.line.maintenanceBand,
      status,
      secondsUntilBusyClears: busySeconds,
      secondsUntilFaultClears: faultSeconds
    }
  })
}

export function getServiceDuration (call: Pick<TrafficEvent, 'routeCode' | 'urgency'>, rng: Rng) {
  const base = GAME_BALANCE.runtimePenalties.serviceDurationBaseByRoute[call.routeCode]
  return (
    base +
    (call.urgency === 'priority' ? GAME_BALANCE.runtimePenalties.urgencyServiceBonus : 0) +
    Math.floor(rng() * GAME_BALANCE.runtimePenalties.serviceDurationVariance)
  )
}

export function idleNonPremiumExists (lines: MutableLineState[], second: number) {
  return lines.some((line) => !line.line.isPremiumTrunk && line.busyUntil <= second && line.faultUntil <= second)
}
