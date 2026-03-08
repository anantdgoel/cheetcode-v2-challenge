import type { BoardModel, PressureCurve, TrafficEvent } from "./models";
import { GAME_BALANCE } from "./config/balance";
import {
  PROFILE_BILLING_WEIGHTS,
  PROFILE_ROUTE_WEIGHTS,
  PROFILE_URGENCY_WEIGHTS,
  ROUTE_CODES,
  SUBSCRIBER_CLASSES,
} from "./config/constants";
import { clamp, createRng, pick, weightedPick, type SimulationMode } from "./shared";
import type { SubscriberClass } from "@/lib/domain/game";
import { getShiftFactor } from "./final-phase";

export function createPressureCurve(board: BoardModel, kind: SimulationMode): PressureCurve {
  const rng = createRng(`${board.seed}:${kind}:curve`);
  const duration = GAME_BALANCE.trafficShape.pressure.durationByMode[kind];
  const baseline =
    GAME_BALANCE.trafficShape.pressure.baselineByMode[kind] +
    (kind === "fit" || kind === "stress" ? board.hiddenTraits.pressureCollapse * 0.03 : board.hiddenTraits.finalShiftSensitivity * 0.04);
  const points = Array.from({ length: duration + 1 }, (_, second) => {
    const wave =
      Math.sin(second / GAME_BALANCE.trafficShape.pressure.wave.primaryDivisor) * GAME_BALANCE.trafficShape.pressure.wave.primaryAmplitude +
      Math.cos(second / GAME_BALANCE.trafficShape.pressure.wave.secondaryDivisor) * GAME_BALANCE.trafficShape.pressure.wave.secondaryAmplitude;
    const shiftLoad =
      kind === "final"
        ? board.finalPhaseChanges.reduce(
            (sum, change) =>
              sum + change.loadDelta * getShiftFactor(second, change) * (1 + board.hiddenTraits.finalShiftSensitivity * 0.6),
            0,
          )
        : 0;
    return clamp(
      baseline + wave + shiftLoad,
      GAME_BALANCE.trafficShape.pressure.curveClamp.min,
      GAME_BALANCE.trafficShape.pressure.curveClamp.max,
    );
  });

  const burstCount = GAME_BALANCE.trafficShape.pressure.burstCountByMode[kind];
  for (let burst = 0; burst < burstCount; burst += 1) {
    const center = Math.floor(rng() * duration);
    const width = GAME_BALANCE.trafficShape.pressure.burstWidth.base + Math.floor(rng() * GAME_BALANCE.trafficShape.pressure.burstWidth.variance);
    const height =
      (GAME_BALANCE.trafficShape.pressure.burstHeight[kind].base +
        rng() * GAME_BALANCE.trafficShape.pressure.burstHeight[kind].variance) *
      (1 + board.hiddenTraits.pressureCollapse * 0.4 + (kind === "final" ? board.hiddenTraits.tempoLag * 0.2 : 0));
    for (let second = Math.max(0, center - width); second <= Math.min(duration, center + width); second += 1) {
      const distance = Math.abs(second - center) / width;
      points[second] = clamp(
        points[second]! + height * (1 - distance),
        GAME_BALANCE.trafficShape.pressure.burstClamp.min,
        GAME_BALANCE.trafficShape.pressure.burstClamp.max,
      );
    }
  }

  return { duration, points };
}

function getTrafficWeights(board: BoardModel, kind: SimulationMode, second: number) {
  const routeWeights = { ...PROFILE_ROUTE_WEIGHTS[board.boardProfile] };
  const billingWeights = { ...PROFILE_BILLING_WEIGHTS[board.boardProfile] };
  const urgencyWeights = { ...PROFILE_URGENCY_WEIGHTS[board.boardProfile] };

  if (kind !== "fit") {
    for (const routeCode of ROUTE_CODES) {
      routeWeights[routeCode] *= GAME_BALANCE.trafficShape.arrivals.routeWeightMultipliers[kind][routeCode];
    }
  }

  if (kind === "final") {
    for (const change of board.finalPhaseChanges) {
      const factor = getShiftFactor(second, change);
      for (const routeCode of ROUTE_CODES) {
        routeWeights[routeCode] += (change.trafficDelta[routeCode] ?? 0) * factor;
      }
    }
    routeWeights.priority *= 1 + board.hiddenTraits.tempoLag * 0.1;
    routeWeights.intercity *= 1 + board.hiddenTraits.finalShiftSensitivity * 0.06;
  }

  for (const routeCode of ROUTE_CODES) {
    routeWeights[routeCode] = Math.max(routeWeights[routeCode], 0.05);
  }

  return { routeWeights, billingWeights, urgencyWeights };
}

export function createTraffic(board: BoardModel, kind: SimulationMode): TrafficEvent[] {
  const rng = createRng(`${board.seed}:${kind}:traffic`);
  const pressureCurve = createPressureCurve(board, kind);
  const duration = pressureCurve.duration;
  const count = GAME_BALANCE.trafficShape.arrivals.countByMode[kind];
  const schedule: TrafficEvent[] = [];
  let second = 0;

  for (let index = 0; index < count; index += 1) {
    const load = pressureCurve.points[Math.min(second, duration)] ?? GAME_BALANCE.runtimePenalties.defaultCurveLoad;
    const { routeWeights, billingWeights, urgencyWeights } = getTrafficWeights(board, kind, second);
    const routeCode = weightedPick(rng, routeWeights);
    let billingMode = weightedPick(rng, billingWeights);
    let urgency = weightedPick(rng, urgencyWeights);
    let subscriberClass = pick(rng, SUBSCRIBER_CLASSES);
    if (routeCode === "priority" && rng() < GAME_BALANCE.trafficShape.arrivals.priorityUrgencyChance) urgency = "priority";
    if (routeCode === "intercity" && rng() < GAME_BALANCE.trafficShape.arrivals.intercityVerifiedChance) billingMode = "verified";
    if (routeCode === "relay" && rng() < GAME_BALANCE.trafficShape.arrivals.relaySpecialSubscriberChance) {
      subscriberClass = pick(rng, ["hotel", "government"] as SubscriberClass[]);
    }
    if (board.boardProfile === "civic-desk" && rng() < 0.32) subscriberClass = "government";
    if (board.boardProfile === "commuter-belt" && routeCode === "local" && rng() < 0.34) billingMode = "collect";

    schedule.push({
      id: `${kind}-call-${String(index + 1).padStart(3, "0")}`,
      atSecond: second,
      routeCode,
      subscriberClass,
      billingMode,
      urgency,
    });

    const spacingBase = duration / count;
    const loadPenalty =
      kind === "stress"
        ? GAME_BALANCE.trafficShape.arrivals.stressLoadPenalty
        : GAME_BALANCE.trafficShape.arrivals.defaultLoadPenalty;
    const gap = Math.max(
      0,
      Math.floor(
        spacingBase *
          (GAME_BALANCE.trafficShape.arrivals.gapFactor.base +
            rng() * GAME_BALANCE.trafficShape.arrivals.gapFactor.variance -
            load * loadPenalty),
      ),
    );
    second = Math.min(duration, second + gap);
  }

  return schedule;
}
