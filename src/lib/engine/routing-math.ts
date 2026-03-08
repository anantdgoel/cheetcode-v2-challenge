import type { TrafficEvent } from "./models";
import type { LineModel } from "./models";
import { DROP_THRESHOLDS } from "./config/constants";
import { GAME_BALANCE } from "./config/balance";
import { clamp, premiumEligible } from "./shared";

type RoutedCall = Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency" | "subscriberClass">;

export function getCallKey(call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">) {
  return `${call.routeCode}|${call.billingMode}|${call.urgency}`;
}

/** Score a line for the current call and live load before converting it to a probability. */
export function lineScore(
  line: LineModel,
  call: RoutedCall,
  load: number,
  effectiveSoftCap = line.loadSoftCap,
  premiumHeat = 0,
) {
  const compatibility = line.compatibility[getCallKey(call)] ?? 0.4;
  const loadPenalty =
    load <= effectiveSoftCap
      ? 0
      : (load - effectiveSoftCap) * (line.loadSlope * GAME_BALANCE.runtimePenalties.loadPenaltyMultiplier);
  const premiumHeatPenalty = line.isPremiumTrunk
    ? GAME_BALANCE.runtimePenalties.premiumHeat.linearPenalty * premiumHeat
    : 0;
  const premiumValue =
    line.isPremiumTrunk && premiumEligible(call)
      ? line.premiumBoost + GAME_BALANCE.runtimePenalties.premiumHeat.baseBoost - premiumHeatPenalty
      : line.isPremiumTrunk
        ? GAME_BALANCE.runtimePenalties.premiumMisusePenalty +
          GAME_BALANCE.runtimePenalties.premiumHeat.ineligiblePenalty -
          premiumHeatPenalty
        : 0;
  const subscriberBias =
    call.subscriberClass === "government" && line.family === "relay"
      ? GAME_BALANCE.runtimePenalties.governmentRelayBias
      : call.subscriberClass === "government" && line.family === "exchange"
        ? GAME_BALANCE.runtimePenalties.governmentExchangeBias
      : call.subscriberClass === "business" && line.family === "trunk"
        ? GAME_BALANCE.runtimePenalties.businessTrunkBias
        : call.urgency === "routine" && line.family === "suburban"
          ? GAME_BALANCE.runtimePenalties.suburbanRoutineBias
        : 0;
  const suburbanPenalty =
    line.family === "suburban" &&
    load > GAME_BALANCE.runtimePenalties.suburbanLoadPenalty.loadThreshold &&
    call.routeCode !== "local"
      ? GAME_BALANCE.runtimePenalties.suburbanLoadPenalty.penalty
      : 0;
  return (
    compatibility +
    line.qualityOffset +
    line.maintenanceOffset +
    premiumValue +
    subscriberBias -
    loadPenalty -
    suburbanPenalty
  );
}

export function connectProbability(
  line: LineModel,
  call: RoutedCall,
  load: number,
  queuedForSeconds: number,
  effectiveSoftCap = line.loadSoftCap,
  premiumHeat = 0,
) {
  const score = lineScore(line, call, load, effectiveSoftCap, premiumHeat);
  const queuePressure = clamp(queuedForSeconds / DROP_THRESHOLDS[call.routeCode], 0, 1);
  return clamp(
    GAME_BALANCE.runtimePenalties.connectionBase +
      score * GAME_BALANCE.runtimePenalties.connectionScoreFactor +
      queuePressure * GAME_BALANCE.runtimePenalties.queuePressureFactor,
    GAME_BALANCE.runtimePenalties.connectionClamp.min,
    GAME_BALANCE.runtimePenalties.connectionClamp.max,
  );
}
