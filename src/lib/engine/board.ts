import type {
  BillingMode,
  BoardProfile,
  LineFamily,
  LoadBand,
  ProbeKind,
  QueueBand,
  RouteCode,
  SubscriberClass,
  TrafficRegime,
  Urgency,
} from "@/lib/contracts/game";
import {
  BILLING_MODES,
  BOARD_PROFILES,
  GENERIC_LABELS,
  LINE_FAMILIES,
  MAINTENANCE_BANDS,
  PROFILE_BILLING_WEIGHTS,
  PROFILE_FAMILY_WEIGHTS,
  PROFILE_ROUTE_WEIGHTS,
  PROFILE_URGENCY_WEIGHTS,
  ROUTE_CODES,
  SHARED_SWITCH_MARKS,
  SUBSCRIBER_CLASSES,
  TRAFFIC_REGIME_ORDER,
  URGENCIES,
} from "./config/constants";
import { GAME_BALANCE } from "./config/balance";
import { FAMILY_COMPATIBILITY_BASE, FAMILY_SWITCH_MARK_WEIGHTS, FAMILY_TAG_WEIGHTS } from "./config/profiles";
import type { BoardModel, FinalPhaseChange, LineModel, ObservationRow, PressureCurve, TrafficEvent } from "./types";
import { connectProbability, getCallKey } from "./routing-math";
import { clamp, createRng, jitter, pick, premiumEligible, shuffle, stableHash, weightedPick, type Rng, type SimulationMode } from "./shared";
import { DROP_THRESHOLDS } from "./config/constants";

function getBoardProfile(seed: string) {
  return BOARD_PROFILES[Math.floor(createRng(`${seed}:profile`)() * BOARD_PROFILES.length)]!;
}

function generateVisibleFamilyPermutation(rng: Rng): Record<LineFamily, LineFamily> {
  while (true) {
    const shuffled = shuffle(rng, [...LINE_FAMILIES]);
    const permutation = LINE_FAMILIES.reduce(
      (acc, family, index) => {
        acc[family] = shuffled[index]!;
        return acc;
      },
      {} as Record<LineFamily, LineFamily>,
    );
    if (LINE_FAMILIES.every((family) => permutation[family] !== family)) {
      return permutation;
    }
  }
}

function buildFinalPhaseChange(seed: string, boardProfile: BoardProfile): FinalPhaseChange {
  const rng = createRng(`${seed}:final-phase`);
  const alternatives = BOARD_PROFILES.filter((profile) => profile !== boardProfile);
  return {
    shiftPoint:
      GAME_BALANCE.trafficShape.finalPhaseChange.shiftPointMin +
      Math.floor(rng() * GAME_BALANCE.trafficShape.finalPhaseChange.shiftPointRange),
    loadDelta: jitter(
      rng,
      rng() > 0.5
        ? GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.base
        : -GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.base,
      GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.spread,
      GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.min,
      GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.max,
    ),
    routeProfileAfterShift: pick(rng, alternatives),
    shiftedFamily: pick(rng, LINE_FAMILIES),
    capDelta: jitter(
      rng,
      rng() > 0.5
        ? GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.base
        : -GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.base,
      GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.spread,
      GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.min,
      GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.max,
    ),
  };
}

function buildLineGroupId(line: Pick<LineModel, "switchMark" | "classTags" | "isPremiumTrunk">) {
  const [firstTag = "misc"] = line.classTags;
  return `${line.switchMark.toLowerCase()}-${firstTag.slice(0, 3)}${line.isPremiumTrunk ? "-p" : ""}`;
}

function buildCompatibility(rng: Rng, family: LineFamily) {
  const compatibility: Record<string, number> = {};

  for (const routeCode of ROUTE_CODES) {
    for (const billingMode of BILLING_MODES) {
      for (const urgency of URGENCIES) {
        const key = getCallKey({ routeCode, billingMode, urgency });
        const baseline =
          FAMILY_COMPATIBILITY_BASE[family][key] ??
          (family === "district"
            ? routeCode === "local"
              ? billingMode === "standard"
                ? GAME_BALANCE.visibleSignal.districtFallback.localStandard
                : GAME_BALANCE.visibleSignal.districtFallback.localOther
              : routeCode === "priority"
                ? GAME_BALANCE.visibleSignal.districtFallback.priority
                : GAME_BALANCE.visibleSignal.districtFallback.offFamily
            : family === "relay"
              ? routeCode === "relay"
                ? billingMode === "collect"
                  ? GAME_BALANCE.visibleSignal.relayFallback.relayCollect
                  : GAME_BALANCE.visibleSignal.relayFallback.relayOther
                : routeCode === "priority"
                  ? GAME_BALANCE.visibleSignal.relayFallback.priority
                  : GAME_BALANCE.visibleSignal.relayFallback.offFamily
              : routeCode === "intercity"
                ? billingMode === "verified"
                  ? GAME_BALANCE.visibleSignal.trunkFallback.intercityVerified
                  : GAME_BALANCE.visibleSignal.trunkFallback.intercityOther
                : routeCode === "priority"
                  ? urgency === "priority"
                    ? GAME_BALANCE.visibleSignal.trunkFallback.priorityUrgent
                    : GAME_BALANCE.visibleSignal.trunkFallback.priorityRoutine
                  : GAME_BALANCE.visibleSignal.trunkFallback.offFamily);
        compatibility[key] = jitter(
          rng,
          baseline,
          GAME_BALANCE.visibleSignal.compatibilityJitter.spread,
          GAME_BALANCE.visibleSignal.compatibilityJitter.min,
          GAME_BALANCE.visibleSignal.compatibilityJitter.max,
        );
      }
    }
  }

  return compatibility;
}

function buildLines(
  seed: string,
  boardProfile: BoardProfile,
  visibleFamilyPermutation: Record<LineFamily, LineFamily>,
  visibleNoiseRate: number,
): LineModel[] {
  const rng = createRng(`${seed}:lines`);
  const totalLines =
    GAME_BALANCE.boardGeneration.minLines + Math.floor(rng() * GAME_BALANCE.boardGeneration.lineVariance);
  const premiumCount = GAME_BALANCE.boardGeneration.premiumCountByProfile[boardProfile];
  const families = Array.from({ length: totalLines }, () => weightedPick(rng, PROFILE_FAMILY_WEIGHTS[boardProfile]));
  families[0] = "district";
  families[1] = "relay";
  families[2] = "trunk";

  return shuffle(rng, families).map((family, index) => {
    const defaultVisibleFamily = visibleFamilyPermutation[family];
    const visibleFamily =
      rng() < visibleNoiseRate
        ? pick(
            rng,
            LINE_FAMILIES.filter((candidate) => candidate !== defaultVisibleFamily),
          )
        : defaultVisibleFamily;
    const switchMark = weightedPick(rng, FAMILY_SWITCH_MARK_WEIGHTS[visibleFamily]);
    const tagWeights = FAMILY_TAG_WEIGHTS[visibleFamily];
    const tags = shuffle(
      rng,
      Array.from(new Set([weightedPick(rng, tagWeights), weightedPick(rng, tagWeights), weightedPick(rng, tagWeights)])),
    ).slice(0, 3);
    const isPremiumTrunk = index >= totalLines - premiumCount;
    const line: LineModel = {
      id: `line-${String(index + 1).padStart(2, "0")}`,
      label: `${pick(rng, GENERIC_LABELS)} ${String(index + 1).padStart(2, "0")}`,
      switchMark,
      classTags: tags,
      lineGroupId: "",
      isPremiumTrunk,
      maintenanceBand: pick(rng, MAINTENANCE_BANDS),
      historicalAlias: "",
      family,
      qualityOffset: jitter(
        rng,
        GAME_BALANCE.boardGeneration.qualityOffset.base,
        GAME_BALANCE.boardGeneration.qualityOffset.spread,
        GAME_BALANCE.boardGeneration.qualityOffset.min,
        GAME_BALANCE.boardGeneration.qualityOffset.max,
      ),
      loadSoftCap: jitter(
        rng,
        GAME_BALANCE.boardGeneration.loadSoftCap[family].base,
        GAME_BALANCE.boardGeneration.loadSoftCap[family].spread,
        GAME_BALANCE.boardGeneration.loadSoftCap[family].min,
        GAME_BALANCE.boardGeneration.loadSoftCap[family].max,
      ),
      loadSlope: jitter(
        rng,
        GAME_BALANCE.boardGeneration.loadSlope[family].base,
        GAME_BALANCE.boardGeneration.loadSlope[family].spread,
        GAME_BALANCE.boardGeneration.loadSlope[family].min,
        GAME_BALANCE.boardGeneration.loadSlope[family].max,
      ),
      premiumBoost: isPremiumTrunk
        ? jitter(
            rng,
            GAME_BALANCE.boardGeneration.premiumBoost.base,
            GAME_BALANCE.boardGeneration.premiumBoost.spread,
            GAME_BALANCE.boardGeneration.premiumBoost.min,
            GAME_BALANCE.boardGeneration.premiumBoost.max,
          )
        : 0,
      maintenanceOffset: 0,
      compatibility: buildCompatibility(rng, family),
    };
    line.lineGroupId = buildLineGroupId(line);
    line.historicalAlias = `${line.switchMark.replace("-", "")}-${line.label.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X")}-${stableHash(`${seed}:${index}`).slice(0, 4)}`;
    line.maintenanceOffset = GAME_BALANCE.boardGeneration.maintenanceOffsetByBand[line.maintenanceBand];
    return line;
  });
}

function getRepresentativeLoad(loadBand: LoadBand) {
  return GAME_BALANCE.trafficShape.observations.representativeLoadByBand[loadBand];
}

function getRepresentativeQueueSeconds(queueBand: QueueBand) {
  return GAME_BALANCE.trafficShape.observations.representativeQueueSecondsByBand[queueBand];
}

function getObservationFamilyWeights(call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">): Record<LineFamily, number> {
  return {
    district:
      call.routeCode === "local"
        ? GAME_BALANCE.trafficShape.observations.familyWeights.district.preferred
        : GAME_BALANCE.trafficShape.observations.familyWeights.district.fallback,
    relay:
      call.routeCode === "relay" || call.billingMode === "collect"
        ? GAME_BALANCE.trafficShape.observations.familyWeights.relay.preferred
        : GAME_BALANCE.trafficShape.observations.familyWeights.relay.fallback,
    trunk:
      call.routeCode === "intercity" || call.urgency === "priority"
        ? GAME_BALANCE.trafficShape.observations.familyWeights.trunk.preferred
        : GAME_BALANCE.trafficShape.observations.familyWeights.trunk.fallback,
  };
}

function pickLineForObservation(
  rng: Rng,
  lines: LineModel[],
  call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">,
) {
  const familyWeights = getObservationFamilyWeights(call);
  const weightedLines = lines.map((line) => ({
    line,
    weight:
      familyWeights[line.family] *
      (line.isPremiumTrunk && premiumEligible(call) ? GAME_BALANCE.trafficShape.observations.premiumEligibleWeight : 1),
  }));
  const totalWeight = weightedLines.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of weightedLines) {
    roll -= entry.weight;
    if (roll <= 0) return entry.line;
  }
  return weightedLines[0]?.line ?? lines[0]!;
}

/** Build only the hidden board facts. Traffic, observations, and artifacts are derived on demand. */
export function createBoard(seed: string): BoardModel {
  const boardProfile = getBoardProfile(seed);
  const visibleFamilyPermutation = generateVisibleFamilyPermutation(createRng(`${seed}:permutation`));
  const visibleNoiseRate = jitter(
    createRng(`${seed}:visible-noise`),
    GAME_BALANCE.visibleSignal.visibleNoise.base,
    GAME_BALANCE.visibleSignal.visibleNoise.spread,
    GAME_BALANCE.visibleSignal.visibleNoise.min,
    GAME_BALANCE.visibleSignal.visibleNoise.max,
  );
  return {
    seed,
    boardProfile,
    lines: buildLines(seed, boardProfile, visibleFamilyPermutation, visibleNoiseRate),
    visibleFamilyPermutation,
    visibleNoiseRate,
    finalPhaseChange: buildFinalPhaseChange(seed, boardProfile),
  };
}

export function createPressureCurve(board: BoardModel, kind: SimulationMode): PressureCurve {
  const rng = createRng(`${board.seed}:${kind}:curve`);
  const duration = GAME_BALANCE.trafficShape.pressure.durationByMode[kind];
  const baseline = GAME_BALANCE.trafficShape.pressure.baselineByMode[kind];
  const points = Array.from({ length: duration + 1 }, (_, second) => {
    const wave =
      Math.sin(second / GAME_BALANCE.trafficShape.pressure.wave.primaryDivisor) * GAME_BALANCE.trafficShape.pressure.wave.primaryAmplitude +
      Math.cos(second / GAME_BALANCE.trafficShape.pressure.wave.secondaryDivisor) * GAME_BALANCE.trafficShape.pressure.wave.secondaryAmplitude;
    if (kind !== "final") {
      return clamp(baseline + wave, GAME_BALANCE.trafficShape.pressure.curveClamp.min, GAME_BALANCE.trafficShape.pressure.curveClamp.max);
    }
    const transitionStart = board.finalPhaseChange.shiftPoint - GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds;
    const transitionEnd = board.finalPhaseChange.shiftPoint + GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds;
    const shiftFactor =
      second <= transitionStart
        ? 0
        : second >= transitionEnd
          ? 1
          : (second - transitionStart) / Math.max(transitionEnd - transitionStart, 1);
    return clamp(
      baseline + wave + board.finalPhaseChange.loadDelta * shiftFactor,
      GAME_BALANCE.trafficShape.pressure.curveClamp.min,
      GAME_BALANCE.trafficShape.pressure.curveClamp.max,
    );
  });

  const burstCount = GAME_BALANCE.trafficShape.pressure.burstCountByMode[kind];
  for (let burst = 0; burst < burstCount; burst += 1) {
    const center = Math.floor(rng() * duration);
    const width = GAME_BALANCE.trafficShape.pressure.burstWidth.base + Math.floor(rng() * GAME_BALANCE.trafficShape.pressure.burstWidth.variance);
    const height =
      GAME_BALANCE.trafficShape.pressure.burstHeight[kind].base + rng() * GAME_BALANCE.trafficShape.pressure.burstHeight[kind].variance;
    for (let second = Math.max(0, center - width); second <= Math.min(duration, center + width); second += 1) {
      const distance = Math.abs(second - center) / width;
      points[second] = clamp(
        points[second] + height * (1 - distance),
        GAME_BALANCE.trafficShape.pressure.burstClamp.min,
        GAME_BALANCE.trafficShape.pressure.burstClamp.max,
      );
    }
  }

  return { duration, points };
}

function getTrafficWeights(board: BoardModel, kind: SimulationMode, second: number) {
  const profile =
    kind === "final" && second >= board.finalPhaseChange.shiftPoint
      ? board.finalPhaseChange.routeProfileAfterShift
      : board.boardProfile;

  const routeWeights =
    kind === "fit"
      ? PROFILE_ROUTE_WEIGHTS[profile]
      : {
          local: PROFILE_ROUTE_WEIGHTS[profile].local * GAME_BALANCE.trafficShape.arrivals.routeWeightMultipliers[kind].local,
          intercity:
            PROFILE_ROUTE_WEIGHTS[profile].intercity * GAME_BALANCE.trafficShape.arrivals.routeWeightMultipliers[kind].intercity,
          relay: PROFILE_ROUTE_WEIGHTS[profile].relay * GAME_BALANCE.trafficShape.arrivals.routeWeightMultipliers[kind].relay,
          priority:
            PROFILE_ROUTE_WEIGHTS[profile].priority * GAME_BALANCE.trafficShape.arrivals.routeWeightMultipliers[kind].priority,
        };

  return {
    routeWeights,
    billingWeights: PROFILE_BILLING_WEIGHTS[profile],
    urgencyWeights: PROFILE_URGENCY_WEIGHTS[profile],
  };
}

export function createTraffic(board: BoardModel, kind: SimulationMode): TrafficEvent[] {
  const rng = createRng(`${board.seed}:${kind}:traffic`);
  const pressureCurve = createPressureCurve(board, kind);
  const duration = pressureCurve.duration;
  const count = GAME_BALANCE.trafficShape.arrivals.countByMode[kind];
  const schedule: TrafficEvent[] = [];
  let second = 0;

  for (let index = 0; index < count; index += 1) {
    const load = pressureCurve.points[Math.min(second, duration)];
    const { routeWeights, billingWeights, urgencyWeights } = getTrafficWeights(board, kind, second);
    const routeCode = weightedPick(rng, routeWeights);
    let billingMode = weightedPick(rng, billingWeights);
    let urgency = weightedPick(rng, urgencyWeights);
    let subscriberClass = pick(rng, SUBSCRIBER_CLASSES);
    if (routeCode === "priority" && rng() > 1 - GAME_BALANCE.trafficShape.arrivals.priorityUrgencyChance) urgency = "priority";
    if (routeCode === "intercity" && rng() > 1 - GAME_BALANCE.trafficShape.arrivals.intercityVerifiedChance) billingMode = "verified";
    if (routeCode === "relay" && rng() > 1 - GAME_BALANCE.trafficShape.arrivals.relaySpecialSubscriberChance) {
      subscriberClass = pick(rng, ["hotel", "government"] as SubscriberClass[]);
    }

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

function trafficRegimeFor(index: number): TrafficRegime {
  return TRAFFIC_REGIME_ORDER[index % TRAFFIC_REGIME_ORDER.length]!;
}

export function createObservations(board: BoardModel): ObservationRow[] {
  const rng = createRng(`${board.seed}:observations`);
  const rows: ObservationRow[] = [];
  for (let index = 0; index < GAME_BALANCE.trafficShape.observations.rowCount; index += 1) {
    const routeCode = weightedPick(rng, PROFILE_ROUTE_WEIGHTS[board.boardProfile]);
    const billingMode = weightedPick(rng, PROFILE_BILLING_WEIGHTS[board.boardProfile]);
    const urgency = weightedPick(rng, PROFILE_URGENCY_WEIGHTS[board.boardProfile]);
    const subscriberClass = pick(rng, SUBSCRIBER_CLASSES);
    const loadBand = pick(rng, ["low", "medium", "high", "peak"] as LoadBand[]);
    const queueBand = pick(rng, ["short", "rising", "long"] as QueueBand[]);
    const selected = pickLineForObservation(rng, board.lines, { routeCode, billingMode, urgency });
    const load = getRepresentativeLoad(loadBand);
    const queuedForSeconds = getRepresentativeQueueSeconds(queueBand);
    const resultRoll = connectProbability(
      selected,
      { routeCode, subscriberClass, billingMode, urgency },
      load,
      queuedForSeconds,
      selected.loadSoftCap,
    );
    const usedPremium = selected.isPremiumTrunk && premiumEligible({ routeCode, billingMode, urgency });
    let result: ObservationRow["outcome"]["result"];
    if (index % GAME_BALANCE.trafficShape.observations.deterministicNoiseEvery === 0) {
      result = pick(rng, ["connected", "held", "fault", "dropped"] as ObservationRow["outcome"]["result"][]);
    } else if (rng() < resultRoll) {
      result = "connected";
    } else {
      const faultWeight = clamp(
        load + (1 - selected.loadSoftCap) + GAME_BALANCE.trafficShape.observations.faultWeight.additive,
        GAME_BALANCE.trafficShape.observations.faultWeight.min,
        GAME_BALANCE.trafficShape.observations.faultWeight.max,
      );
      const dropWeight = clamp(
        queuedForSeconds / DROP_THRESHOLDS[routeCode] +
          (queueBand === "long" ? GAME_BALANCE.trafficShape.observations.dropWeight.longQueueBonus : 0),
        GAME_BALANCE.trafficShape.observations.dropWeight.min,
        GAME_BALANCE.trafficShape.observations.dropWeight.max,
      );
      const heldWeight = clamp(
        1 -
          faultWeight * GAME_BALANCE.trafficShape.observations.heldWeight.faultFactor -
          dropWeight * GAME_BALANCE.trafficShape.observations.heldWeight.dropFactor,
        GAME_BALANCE.trafficShape.observations.heldWeight.min,
        GAME_BALANCE.trafficShape.observations.heldWeight.max,
      );
      const failureRoll = rng() * (faultWeight + dropWeight + heldWeight);
      result =
        failureRoll <= heldWeight
          ? "held"
          : failureRoll <= heldWeight + faultWeight
            ? "fault"
            : "dropped";
    }

    rows.push({
      logId: `obs-${String(index + 1).padStart(5, "0")}`,
      shiftBucket: `bucket-${Math.floor(index / GAME_BALANCE.trafficShape.observations.shiftBucketSize)}`,
      trafficRegime: trafficRegimeFor(index),
      historicalLineAlias: selected.historicalAlias,
      historicalLineGroup: selected.lineGroupId,
      call: { routeCode, subscriberClass, billingMode, urgency },
      context: {
        loadBand,
        queueBand,
        recentIncidentsNearLine: Math.floor(rng() * GAME_BALANCE.trafficShape.observations.recentIncidentsMaxExclusive),
      },
      decision: {
        action: result === "held" ? "hold" : "route",
        usedPremium,
      },
      outcome: {
        result,
        ...(result === "held" || result === "dropped"
          ? { holdBand: queueBand === "short" ? "brief" : queueBand === "rising" ? "moderate" : "long" }
          : {}),
      },
    });
  }
  return rows;
}
