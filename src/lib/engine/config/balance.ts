import type {
  BoardProfile,
  LineFamily,
  MaintenanceBand,
  ProbeKind,
  QueueBand,
  RouteCode,
} from "@/lib/contracts/game";
import type { ClampRange, RangeTuning } from "@/lib/engine/types";

export type JitterRange = RangeTuning;
export type WeightMap<TKey extends string> = Record<TKey, number>;

/**
 * Tunable gameplay knobs. Each section is grouped by the product question it
 * answers so balance work is safe to review and easy to iterate.
 */
export const GAME_BALANCE = {
  boardGeneration: {
    minLines: 24,
    lineVariance: 5,
    premiumCountByProfile: {
      switchboard: 5,
      "front-office": 6,
      "night-rush": 5,
    } as const satisfies Record<BoardProfile, number>,
    qualityOffset: { base: 0, spread: 0.09, min: -0.14, max: 0.14 } as JitterRange,
    loadSoftCap: {
      district: { base: 0.58, spread: 0.08, min: 0.34, max: 0.9 },
      relay: { base: 0.66, spread: 0.08, min: 0.34, max: 0.9 },
      trunk: { base: 0.78, spread: 0.08, min: 0.34, max: 0.9 },
    } as const satisfies Record<LineFamily, JitterRange>,
    loadSlope: {
      district: { base: 0.72, spread: 0.1, min: 0.2, max: 0.92 },
      relay: { base: 0.54, spread: 0.1, min: 0.2, max: 0.92 },
      trunk: { base: 0.42, spread: 0.1, min: 0.2, max: 0.92 },
    } as const satisfies Record<LineFamily, JitterRange>,
    premiumBoost: { base: 0.14, spread: 0.07, min: 0.04, max: 0.3 } as JitterRange,
    maintenanceOffsetByBand: {
      recently_serviced: 0.06,
      steady: 0.02,
      temperamental: -0.05,
    } as const satisfies Record<MaintenanceBand, number>,
  },
  visibleSignal: {
    visibleNoise: { base: 0.2, spread: 0.02, min: 0.18, max: 0.22 } as JitterRange,
    compatibilityJitter: { base: 0, spread: 0.04, min: 0.1, max: 0.99 } as JitterRange,
    districtFallback: {
      localStandard: 0.9,
      localOther: 0.82,
      priority: 0.26,
      offFamily: 0.12,
    },
    relayFallback: {
      relayCollect: 0.88,
      relayOther: 0.82,
      priority: 0.38,
      offFamily: 0.14,
    },
    trunkFallback: {
      intercityVerified: 0.94,
      intercityOther: 0.78,
      priorityRoutine: 0.68,
      priorityUrgent: 0.86,
      offFamily: 0.08,
    },
  },
  trafficShape: {
    observations: {
      rowCount: 4800,
      deterministicNoiseEvery: 5,
      shiftBucketSize: 24,
      representativeLoadByBand: {
        low: 0.24,
        medium: 0.5,
        high: 0.72,
        peak: 0.88,
      },
      representativeQueueSecondsByBand: {
        short: 3,
        rising: 7,
        long: 12,
      } as const satisfies Record<QueueBand, number>,
      familyWeights: {
        district: { preferred: 1.2, fallback: 0.45 },
        relay: { preferred: 1.05, fallback: 0.55 },
        trunk: { preferred: 1.15, fallback: 0.5 },
      },
      premiumEligibleWeight: 1.08,
      faultWeight: { additive: 0.1, min: 0.15, max: 0.78 } as ClampRange & { additive: number },
      dropWeight: { longQueueBonus: 0.18, min: 0.1, max: 0.74 } as ClampRange & { longQueueBonus: number },
      heldWeight: { faultFactor: 0.55, dropFactor: 0.65, min: 0.12, max: 0.52 } as ClampRange & {
        faultFactor: number;
        dropFactor: number;
      },
      recentIncidentsMaxExclusive: 4,
    },
    pressure: {
      durationByMode: {
        fit: 180,
        stress: 180,
        final: 420,
      } as const satisfies Record<ProbeKind | "final", number>,
      baselineByMode: {
        fit: 0.22,
        stress: 0.44,
        final: 0.3,
      } as const satisfies Record<ProbeKind | "final", number>,
      wave: {
        primaryDivisor: 18,
        primaryAmplitude: 0.06,
        secondaryDivisor: 11,
        secondaryAmplitude: 0.04,
      },
      curveClamp: { min: 0.1, max: 0.95 } as ClampRange,
      burstCountByMode: {
        fit: 2,
        stress: 4,
        final: 5,
      } as const satisfies Record<ProbeKind | "final", number>,
      burstWidth: { base: 10, variance: 20 },
      burstHeight: {
        fit: { base: 0.12, variance: 0.1 },
        stress: { base: 0.22, variance: 0.12 },
        final: { base: 0.12, variance: 0.1 },
      } as const,
      burstClamp: { min: 0.1, max: 0.98 } as ClampRange,
    },
    finalPhaseChange: {
      transitionWindowSeconds: 15,
      shiftPointMin: 150,
      shiftPointRange: 121,
      loadDelta: { base: 0.15, spread: 0.03, min: -0.18, max: 0.18 } as JitterRange,
      capDelta: { base: 0.08, spread: 0.015, min: -0.095, max: 0.095 } as JitterRange,
      effectiveSoftCapClamp: { min: 0.2, max: 0.95 } as ClampRange,
    },
    arrivals: {
      countByMode: {
        fit: 110,
        stress: 110,
        final: 340,
      } as const satisfies Record<ProbeKind | "final", number>,
      routeWeightMultipliers: {
        fit: { local: 1, intercity: 1, relay: 1, priority: 1 },
        stress: { local: 0.8, intercity: 1.15, relay: 1.15, priority: 1.15 },
        final: { local: 0.92, intercity: 1.05, relay: 1.04, priority: 1.08 },
      } as const satisfies Record<ProbeKind | "final", Record<RouteCode, number>>,
      priorityUrgencyChance: 0.75,
      intercityVerifiedChance: 0.58,
      relaySpecialSubscriberChance: 0.6,
      stressLoadPenalty: 0.95,
      defaultLoadPenalty: 0.7,
      gapFactor: { base: 0.7, variance: 1.4 },
    },
  },
  runtimePenalties: {
    queueLoadFactorPerCall: 0.02,
    queueLoadCap: 8,
    liveLoadClamp: { min: 0, max: 1 } as ClampRange,
    defaultCurveLoad: 0.4,
    loadBandThresholds: {
      peak: 0.8,
      high: 0.62,
      medium: 0.38,
    },
    queueBandThresholds: {
      long: 6,
      rising: 3,
    },
    serviceDurationBaseByRoute: {
      local: 4,
      relay: 6,
      intercity: 8,
      priority: 5,
    } as const satisfies Record<RouteCode, number>,
    urgencyServiceBonus: 1,
    serviceDurationVariance: 4,
    loadPenaltyMultiplier: 1.8,
    premiumMisusePenalty: -0.08,
    governmentRelayBias: 0.03,
    businessTrunkBias: 0.03,
    connectionBase: 0.1,
    connectionScoreFactor: 0.9,
    queuePressureFactor: 0.06,
    connectionClamp: { min: 0.03, max: 0.99 } as ClampRange,
    queueHoldDenominator: 16,
    faultRecovery: { base: 4, loadFactor: 5 },
    postPlanHorizonSeconds: 90,
  },
  scoring: {
    deskConditionThresholds: {
      steady: 0.75,
      strained: 0.55,
    },
  },
  probePresentation: {
    confidenceFloor: 0.2,
    confidenceCeiling: 0.99,
    confidenceTrafficFactor: 0.08,
    maxIncidentNotes: 8,
  },
} as const;
