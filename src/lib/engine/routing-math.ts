import type { TrafficEvent } from "./types";
import type { LineModel } from "./types";
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
) {
  const compatibility = line.compatibility[getCallKey(call)] ?? 0.4;
  const loadPenalty =
    load <= effectiveSoftCap
      ? 0
      : (load - effectiveSoftCap) * (line.loadSlope * GAME_BALANCE.runtimePenalties.loadPenaltyMultiplier);
  const premiumValue =
    line.isPremiumTrunk && premiumEligible(call)
      ? line.premiumBoost
      : line.isPremiumTrunk
        ? GAME_BALANCE.runtimePenalties.premiumMisusePenalty
        : 0;
  const subscriberBias =
    call.subscriberClass === "government" && line.family === "relay"
      ? GAME_BALANCE.runtimePenalties.governmentRelayBias
      : call.subscriberClass === "business" && line.family === "trunk"
        ? GAME_BALANCE.runtimePenalties.businessTrunkBias
        : 0;
  return compatibility + line.qualityOffset + line.maintenanceOffset + premiumValue + subscriberBias - loadPenalty;
}

export function connectProbability(
  line: LineModel,
  call: RoutedCall,
  load: number,
  queuedForSeconds: number,
  effectiveSoftCap = line.loadSoftCap,
) {
  const score = lineScore(line, call, load, effectiveSoftCap);
  const queuePressure = clamp(queuedForSeconds / DROP_THRESHOLDS[call.routeCode], 0, 1);
  return clamp(
    GAME_BALANCE.runtimePenalties.connectionBase +
      score * GAME_BALANCE.runtimePenalties.connectionScoreFactor +
      queuePressure * GAME_BALANCE.runtimePenalties.queuePressureFactor,
    GAME_BALANCE.runtimePenalties.connectionClamp.min,
    GAME_BALANCE.runtimePenalties.connectionClamp.max,
  );
}
