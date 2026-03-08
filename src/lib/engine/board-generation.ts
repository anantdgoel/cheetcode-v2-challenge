import type { BillingMode, BoardProfile, FinalShiftKind, LineFamily, RouteCode, Urgency } from "@/lib/domain/game";
import {
  BILLING_MODES,
  BOARD_PROFILES,
  GENERIC_LABELS,
  LINE_FAMILIES,
  MAINTENANCE_BANDS,
  PROFILE_FAMILY_WEIGHTS,
  ROUTE_CODES,
  URGENCIES,
} from "./config/constants";
import { GAME_BALANCE } from "./config/balance";
import { FAMILY_COMPATIBILITY_BASE, FAMILY_SWITCH_MARK_WEIGHTS, FAMILY_TAG_WEIGHTS } from "./config/profiles";
import { clamp, createRng, jitter, pick, shuffle, stableHash, weightedPick, type Rng } from "./shared";
import type { BoardHiddenTraits, BoardModel, FinalPhaseChange, LineModel } from "./models";

type CompatibilityKey = `${RouteCode}|${BillingMode}|${Urgency}`;

function getBoardProfile(seed: string) {
  return BOARD_PROFILES[Math.floor(createRng(`${seed}:profile`)() * BOARD_PROFILES.length)]!;
}

function pickBoardFamilyCount(rng: Rng) {
  const weights = GAME_BALANCE.visibleSignal.boardFamilyCountWeights;
  const pickKey = weightedPick(rng, weights);
  return Number(pickKey) as 3 | 4 | 5;
}

function pickActiveFamilies(rng: Rng, profile: BoardProfile, familyCount: 3 | 4 | 5) {
  const activeFamilies = new Set<LineFamily>();
  const weights = PROFILE_FAMILY_WEIGHTS[profile];
  const ranked = [...LINE_FAMILIES].sort((left, right) => weights[right] - weights[left]);

  for (const family of ranked.slice(0, Math.min(2, familyCount))) {
    activeFamilies.add(family);
  }
  while (activeFamilies.size < familyCount) {
    activeFamilies.add(weightedPick(rng, weights));
  }

  return shuffle(rng, [...activeFamilies]);
}

function buildVisibleFamilyMap(rng: Rng, activeFamilies: LineFamily[]) {
  const shuffled = shuffle(rng, [...activeFamilies]);
  const hasIdentity = activeFamilies.some((family, index) => shuffled[index] === family);
  const rotated = hasIdentity && shuffled.length > 1 ? [...shuffled.slice(1), shuffled[0]!] : shuffled;
  return activeFamilies.reduce(
    (acc, family, index) => {
      acc[family] = rotated[index] ?? family;
      return acc;
    },
    {} as Partial<Record<LineFamily, LineFamily>>,
  );
}

function fallbackCompatibility(family: LineFamily, routeCode: RouteCode, billingMode: BillingMode, urgency: Urgency) {
  if (family === "district") {
    if (routeCode === "local") {
      return billingMode === "standard"
        ? GAME_BALANCE.visibleSignal.districtFallback.localStandard
        : GAME_BALANCE.visibleSignal.districtFallback.localOther;
    }
    if (routeCode === "priority") return GAME_BALANCE.visibleSignal.districtFallback.priority;
    return GAME_BALANCE.visibleSignal.districtFallback.offFamily;
  }

  if (family === "relay") {
    if (routeCode === "relay") {
      return billingMode === "collect"
        ? GAME_BALANCE.visibleSignal.relayFallback.relayCollect
        : GAME_BALANCE.visibleSignal.relayFallback.relayOther;
    }
    if (routeCode === "priority") return GAME_BALANCE.visibleSignal.relayFallback.priority;
    return GAME_BALANCE.visibleSignal.relayFallback.offFamily;
  }

  if (family === "trunk") {
    if (routeCode === "intercity") {
      return billingMode === "verified"
        ? GAME_BALANCE.visibleSignal.trunkFallback.intercityVerified
        : GAME_BALANCE.visibleSignal.trunkFallback.intercityOther;
    }
    if (routeCode === "priority") {
      return urgency === "priority"
        ? GAME_BALANCE.visibleSignal.trunkFallback.priorityUrgent
        : GAME_BALANCE.visibleSignal.trunkFallback.priorityRoutine;
    }
    return GAME_BALANCE.visibleSignal.trunkFallback.offFamily;
  }

  if (family === "exchange") {
    if (routeCode === "priority") {
      return billingMode === "verified"
        ? GAME_BALANCE.visibleSignal.exchangeFallback.priorityVerified
        : GAME_BALANCE.visibleSignal.exchangeFallback.priorityOther;
    }
    if (billingMode === "verified") return GAME_BALANCE.visibleSignal.exchangeFallback.verifiedOther;
    return GAME_BALANCE.visibleSignal.exchangeFallback.offFamily;
  }

  if (routeCode === "local" && urgency === "routine") return GAME_BALANCE.visibleSignal.suburbanFallback.localRoutine;
  if (routeCode === "relay" && urgency === "routine") return GAME_BALANCE.visibleSignal.suburbanFallback.relayRoutine;
  if (routeCode === "intercity" && urgency === "routine") return GAME_BALANCE.visibleSignal.suburbanFallback.intercityRoutine;
  return GAME_BALANCE.visibleSignal.suburbanFallback.offFamily;
}

function getCompatibilityBaseline(family: LineFamily, routeCode: RouteCode, billingMode: BillingMode, urgency: Urgency) {
  const key = `${routeCode}|${billingMode}|${urgency}` as CompatibilityKey;
  return FAMILY_COMPATIBILITY_BASE[family][key] ?? fallbackCompatibility(family, routeCode, billingMode, urgency);
}

function getFamilyBoardBias(seed: string, family: LineFamily, key: CompatibilityKey) {
  return jitter(
    createRng(`${seed}:family-bias:${family}:${key}`),
    0,
    GAME_BALANCE.visibleSignal.compatibilityJitter.spread,
    -GAME_BALANCE.visibleSignal.compatibilityJitter.spread,
    GAME_BALANCE.visibleSignal.compatibilityJitter.spread,
  );
}

function buildCompatibility(seed: string, rng: Rng, family: LineFamily) {
  const compatibility: Record<string, number> = {};

  for (const routeCode of ROUTE_CODES) {
    for (const billingMode of BILLING_MODES) {
      for (const urgency of URGENCIES) {
        const key = `${routeCode}|${billingMode}|${urgency}` as CompatibilityKey;
        const base = clamp(
          getCompatibilityBaseline(family, routeCode, billingMode, urgency) + getFamilyBoardBias(seed, family, key),
          GAME_BALANCE.visibleSignal.compatibilityJitter.min,
          GAME_BALANCE.visibleSignal.compatibilityJitter.max,
        );
        compatibility[key] = jitter(rng, base, 0.04, 0.1, 0.99);
      }
    }
  }

  return compatibility;
}

function buildLineGroupId(line: Pick<LineModel, "switchMark" | "classTags" | "isPremiumTrunk">) {
  const [firstTag = "misc"] = line.classTags;
  return `${line.switchMark.toLowerCase()}-${firstTag.slice(0, 3)}${line.isPremiumTrunk ? "-p" : ""}`;
}

function chooseFinalShiftCount(rng: Rng, familyCount: number, boardProfile: BoardProfile) {
  const hardBoard = familyCount >= 5 || boardProfile === "storm-watch";
  if (hardBoard && rng() < 0.7) return weightedPick(rng, { 0: 0.22, 1: 0.5, 2: 0.28 }) as "0" | "1" | "2";
  return weightedPick(rng, GAME_BALANCE.trafficShape.finalPhaseChange.shiftCountWeights);
}

function buildHiddenTraits(seed: string, boardProfile: BoardProfile): BoardHiddenTraits {
  const bias = GAME_BALANCE.boardGeneration.hiddenTraits.profileBias[boardProfile];
  const buildTrait = (name: keyof BoardHiddenTraits) =>
    clamp(
      jitter(
        createRng(`${seed}:trait:${name}`),
        GAME_BALANCE.boardGeneration.hiddenTraits[name].base,
        GAME_BALANCE.boardGeneration.hiddenTraits[name].spread,
        GAME_BALANCE.boardGeneration.hiddenTraits[name].min,
        GAME_BALANCE.boardGeneration.hiddenTraits[name].max,
      ) + bias[name],
      GAME_BALANCE.boardGeneration.hiddenTraits[name].min,
      GAME_BALANCE.boardGeneration.hiddenTraits[name].max,
    );

  return {
    pressureCollapse: buildTrait("pressureCollapse"),
    premiumFragility: buildTrait("premiumFragility"),
    historyReliability: buildTrait("historyReliability"),
    finalShiftSensitivity: buildTrait("finalShiftSensitivity"),
    tempoLag: buildTrait("tempoLag"),
  };
}

function pickShiftKind(rng: Rng): FinalShiftKind {
  return pick(rng, ["traffic_mix", "cap_swing"] as FinalShiftKind[]);
}

function buildTrafficDelta(rng: Rng) {
  const primary = pick(rng, ROUTE_CODES);
  const secondary = pick(
    rng,
    ROUTE_CODES.filter((routeCode) => routeCode !== primary),
  );
  const delta = jitter(
    rng,
    rng() > 0.5 ? GAME_BALANCE.trafficShape.finalPhaseChange.trafficDelta.base : -GAME_BALANCE.trafficShape.finalPhaseChange.trafficDelta.base,
    GAME_BALANCE.trafficShape.finalPhaseChange.trafficDelta.spread,
    GAME_BALANCE.trafficShape.finalPhaseChange.trafficDelta.min,
    GAME_BALANCE.trafficShape.finalPhaseChange.trafficDelta.max,
  );
  return {
    [primary]: delta,
    [secondary]: -delta * 0.75,
  } as Partial<Record<RouteCode, number>>;
}

function buildFinalPhaseChanges(
  seed: string,
  boardProfile: BoardProfile,
  activeFamilies: LineFamily[],
  hiddenTraits: BoardHiddenTraits,
): FinalPhaseChange[] {
  const rng = createRng(`${seed}:final-phase`);
  let count = Number(chooseFinalShiftCount(rng, activeFamilies.length, boardProfile));
  if (hiddenTraits.finalShiftSensitivity > 0.72 && count < 3) count += 1;
  if (!count) return [];

  const points = Array.from({ length: count }, () =>
    GAME_BALANCE.trafficShape.finalPhaseChange.shiftPointMin +
    Math.floor(rng() * GAME_BALANCE.trafficShape.finalPhaseChange.shiftPointRange),
  ).sort((left, right) => left - right);

  return points.map((shiftPoint, index) => {
    const kind = pickShiftKind(createRng(`${seed}:final-phase:${index}:kind`));
    return {
      kind,
      shiftPoint,
      durationSeconds:
        GAME_BALANCE.trafficShape.finalPhaseChange.durationSeconds.base +
        Math.floor(rng() * GAME_BALANCE.trafficShape.finalPhaseChange.durationSeconds.variance),
      loadDelta: jitter(
        rng,
        rng() > 0.5
          ? GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.base
          : -GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.base,
        GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.spread,
        GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.min,
        GAME_BALANCE.trafficShape.finalPhaseChange.loadDelta.max,
      ) * (1 + hiddenTraits.finalShiftSensitivity * 0.55),
      trafficDelta: kind === "traffic_mix" ? buildTrafficDelta(rng) : {},
      targetFamily: pick(rng, activeFamilies),
      capDelta:
        kind === "cap_swing"
          ? jitter(
              rng,
              rng() > 0.5
                ? GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.base
                : -GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.base,
              GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.spread,
              GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.min,
              GAME_BALANCE.trafficShape.finalPhaseChange.capDelta.max,
            ) * (1 + hiddenTraits.finalShiftSensitivity * 0.5 + hiddenTraits.tempoLag * 0.15)
          : 0,
    };
  });
}

function buildLines(
  seed: string,
  boardProfile: BoardProfile,
  activeFamilies: LineFamily[],
  visibleFamilyMap: Partial<Record<LineFamily, LineFamily>>,
  visibleNoiseRate: number,
): LineModel[] {
  const rng = createRng(`${seed}:lines`);
  const totalLines =
    GAME_BALANCE.boardGeneration.minLines + Math.floor(rng() * GAME_BALANCE.boardGeneration.lineVariance);
  const premiumCount = GAME_BALANCE.boardGeneration.premiumCountByProfile[boardProfile];
  const familyWeights = activeFamilies.reduce(
    (acc, family) => {
      acc[family] = PROFILE_FAMILY_WEIGHTS[boardProfile][family];
      return acc;
    },
    {} as Record<LineFamily, number>,
  );
  const chosenFamilies = Array.from({ length: totalLines }, () => weightedPick(rng, familyWeights));
  for (let index = 0; index < activeFamilies.length && index < chosenFamilies.length; index += 1) {
    chosenFamilies[index] = activeFamilies[index]!;
  }

  return shuffle(rng, chosenFamilies).map((family, index) => {
    const defaultVisibleFamily = visibleFamilyMap[family] ?? family;
    const visibleFamily =
      rng() < visibleNoiseRate
        ? pick(
            rng,
            activeFamilies.filter((candidate) => candidate !== defaultVisibleFamily),
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
      visibleFamily,
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
      compatibility: buildCompatibility(seed, rng, family),
    };
    line.lineGroupId = buildLineGroupId(line);
    line.historicalAlias = `${line.switchMark.replace("-", "")}-${line.label.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X")}-${stableHash(`${seed}:${index}`).slice(0, 4)}`;
    line.maintenanceOffset = GAME_BALANCE.boardGeneration.maintenanceOffsetByBand[line.maintenanceBand];
    return line;
  });
}

export function createBoard(seed: string): BoardModel {
  const boardProfile = getBoardProfile(seed);
  const hiddenTraits = buildHiddenTraits(seed, boardProfile);
  const familyCount = pickBoardFamilyCount(createRng(`${seed}:family-count`));
  const activeFamilies = pickActiveFamilies(createRng(`${seed}:families`), boardProfile, familyCount);
  const visibleFamilyMap = buildVisibleFamilyMap(createRng(`${seed}:visible-map`), activeFamilies);
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
    activeFamilies,
    lines: buildLines(seed, boardProfile, activeFamilies, visibleFamilyMap, visibleNoiseRate),
    visibleFamilyMap,
    visibleNoiseRate,
    finalPhaseChanges: buildFinalPhaseChanges(seed, boardProfile, activeFamilies, hiddenTraits),
    hiddenTraits,
  };
}
