import type {
  BoardProfile,
  LineFamily,
  MaintenanceBand,
  ProbeKind,
  QueueBand,
  RouteCode
} from '@/core/domain/game'
import type { ClampRange, RangeTuning } from '@/core/engine/models'

export type JitterRange = RangeTuning

const PREMIUM_COUNT_BY_PROFILE = {
  switchboard: 4,
  'front-office': 5,
  'night-rush': 4,
  'civic-desk': 5,
  'commuter-belt': 3,
  'storm-watch': 5
} as const satisfies Record<BoardProfile, number>

const OBSERVATION_NOISE = {
  visibleNoise: { base: 0.225, spread: 0.025, min: 0.2, max: 0.26 } as JitterRange,
  compatibilityJitter: { base: 0, spread: 0.1, min: 0.1, max: 0.99 } as JitterRange,
  seededNoiseRate: 0.25,
  traineeOutcomeFlipRate: 0.28
} as const

const FINAL_PRESSURE_PROFILE = {
  finalBaseline: 0.34,
  finalBurstCount: 6,
  finalBurstHeight: { base: 0.16, variance: 0.12 },
  shiftCountWeights: {
    0: 0.12,
    1: 0.42,
    2: 0.34,
    3: 0.12
  } as const,
  loadDelta: { base: 0.14, spread: 0.04, min: -0.18, max: 0.18 } as JitterRange,
  capDelta: { base: 0.1, spread: 0.025, min: -0.14, max: 0.14 } as JitterRange,
  trafficDelta: { base: 0.14, spread: 0.03, min: -0.18, max: 0.18 } as JitterRange
} as const

const PREMIUM_AND_LOAD_DIFFICULTY = {
  premiumBoost: { base: 0.11, spread: 0.06, min: 0.03, max: 0.22 } as JitterRange,
  defaultLoadPenalty: 0.76,
  loadPenaltyMultiplier: 2.05,
  premiumHeat: {
    baseBoost: 0.1,
    misuseHeat: 0.5,
    useHeat: 1,
    decayPerSecond: 0.05,
    linearPenalty: 0.06,
    ineligiblePenalty: -0.08
  },
  suburbanLoadPenalty: {
    loadThreshold: 0.68,
    queueThreshold: 6,
    penalty: 0.08
  }
} as const

/**
 * Tunable gameplay knobs. Each section is grouped by the product question it
 * answers so balance work is safe to review and easy to iterate.
 */
export const GAME_BALANCE = {
  boardGeneration: {
    minLines: 24,
    lineVariance: 5,
    premiumCountByProfile: PREMIUM_COUNT_BY_PROFILE,
    hiddenTraits: {
      pressureCollapse: { base: 0.52, spread: 0.26, min: 0.1, max: 0.98 } as JitterRange,
      premiumFragility: { base: 0.48, spread: 0.28, min: 0.08, max: 0.98 } as JitterRange,
      historyReliability: { base: 0.62, spread: 0.24, min: 0.08, max: 0.98 } as JitterRange,
      finalShiftSensitivity: { base: 0.46, spread: 0.28, min: 0.04, max: 0.98 } as JitterRange,
      tempoLag: { base: 0.44, spread: 0.24, min: 0.04, max: 0.98 } as JitterRange,
      profileBias: {
        switchboard: {
          pressureCollapse: -0.08,
          premiumFragility: -0.04,
          historyReliability: 0.08,
          finalShiftSensitivity: -0.08,
          tempoLag: -0.08
        },
        'front-office': {
          pressureCollapse: 0.02,
          premiumFragility: 0.12,
          historyReliability: -0.02,
          finalShiftSensitivity: 0.06,
          tempoLag: 0.02
        },
        'night-rush': {
          pressureCollapse: 0.08,
          premiumFragility: 0.02,
          historyReliability: -0.04,
          finalShiftSensitivity: 0.04,
          tempoLag: 0.08
        },
        'civic-desk': {
          pressureCollapse: 0.02,
          premiumFragility: -0.02,
          historyReliability: 0.04,
          finalShiftSensitivity: 0.1,
          tempoLag: 0.02
        },
        'commuter-belt': {
          pressureCollapse: 0.04,
          premiumFragility: -0.06,
          historyReliability: -0.08,
          finalShiftSensitivity: 0.02,
          tempoLag: 0.04
        },
        'storm-watch': {
          pressureCollapse: 0.16,
          premiumFragility: 0.1,
          historyReliability: -0.1,
          finalShiftSensitivity: 0.16,
          tempoLag: 0.12
        }
      } as const satisfies Record<BoardProfile, Record<'pressureCollapse' | 'premiumFragility' | 'historyReliability' | 'finalShiftSensitivity' | 'tempoLag', number>>
    },
    qualityOffset: { base: 0, spread: 0.09, min: -0.14, max: 0.14 } as JitterRange,
    loadSoftCap: {
      district: { base: 0.58, spread: 0.08, min: 0.34, max: 0.9 },
      relay: { base: 0.66, spread: 0.08, min: 0.34, max: 0.9 },
      trunk: { base: 0.78, spread: 0.08, min: 0.34, max: 0.9 },
      exchange: { base: 0.52, spread: 0.07, min: 0.3, max: 0.84 },
      suburban: { base: 0.64, spread: 0.07, min: 0.36, max: 0.88 }
    } as const satisfies Record<LineFamily, JitterRange>,
    loadSlope: {
      district: { base: 0.72, spread: 0.1, min: 0.2, max: 0.92 },
      relay: { base: 0.54, spread: 0.1, min: 0.2, max: 0.92 },
      trunk: { base: 0.42, spread: 0.1, min: 0.2, max: 0.92 },
      exchange: { base: 0.78, spread: 0.08, min: 0.32, max: 0.98 },
      suburban: { base: 0.56, spread: 0.08, min: 0.24, max: 0.84 }
    } as const satisfies Record<LineFamily, JitterRange>,
    premiumBoost: PREMIUM_AND_LOAD_DIFFICULTY.premiumBoost,
    maintenanceOffsetByBand: {
      recently_serviced: 0.06,
      steady: 0.02,
      temperamental: -0.05
    } as const satisfies Record<MaintenanceBand, number>
  },
  visibleSignal: {
    visibleNoise: OBSERVATION_NOISE.visibleNoise,
    compatibilityJitter: OBSERVATION_NOISE.compatibilityJitter,
    boardFamilyCountWeights: {
      3: 0.34,
      4: 0.42,
      5: 0.24
    } as const,
    districtFallback: {
      localStandard: 0.9,
      localOther: 0.82,
      priority: 0.26,
      offFamily: 0.12
    },
    relayFallback: {
      relayCollect: 0.88,
      relayOther: 0.82,
      priority: 0.38,
      offFamily: 0.14
    },
    trunkFallback: {
      intercityVerified: 0.94,
      intercityOther: 0.78,
      priorityRoutine: 0.68,
      priorityUrgent: 0.86,
      offFamily: 0.08
    },
    exchangeFallback: {
      priorityVerified: 0.88,
      priorityOther: 0.79,
      verifiedOther: 0.64,
      offFamily: 0.22
    },
    suburbanFallback: {
      localRoutine: 0.74,
      relayRoutine: 0.68,
      intercityRoutine: 0.6,
      offFamily: 0.34
    }
  },
  trafficShape: {
    observations: {
      rowCount: 4800,
      seededNoiseRate: OBSERVATION_NOISE.seededNoiseRate,
      shiftBucketSize: 24,
      operatorGradeWeights: {
        senior: 0.22,
        operator: 0.53,
        trainee: 0.25
      } as const,
      traineeAdversarial: {
        outcomeFlipRate: OBSERVATION_NOISE.traineeOutcomeFlipRate,
        borderlineMin: 0.42,
        borderlineMax: 0.68
      },
      representativeLoadByBand: {
        low: 0.24,
        medium: 0.5,
        high: 0.72,
        peak: 0.88
      },
      representativeQueueSecondsByBand: {
        short: 3,
        rising: 7,
        long: 12
      } as const satisfies Record<QueueBand, number>,
      familyWeights: {
        district: { preferred: 1.2, fallback: 0.45 },
        relay: { preferred: 1.05, fallback: 0.55 },
        trunk: { preferred: 1.15, fallback: 0.5 },
        exchange: { preferred: 1.12, fallback: 0.46 },
        suburban: { preferred: 1.08, fallback: 0.62 }
      },
      premiumEligibleWeight: 1.08,
      faultWeight: { additive: 0.1, min: 0.15, max: 0.78 } as ClampRange & { additive: number },
      dropWeight: { longQueueBonus: 0.18, min: 0.1, max: 0.74 } as ClampRange & { longQueueBonus: number },
      heldWeight: { faultFactor: 0.55, dropFactor: 0.65, min: 0.12, max: 0.52 } as ClampRange & {
        faultFactor: number;
        dropFactor: number;
      },
      recentIncidentsMaxExclusive: 4,
      historyDistortion: {
        loadReliefMax: 0.16,
        premiumHeatReliefMax: 0.9,
        visibleFamilyBiasRateMax: 0.28,
        extraNoiseRateMax: 0.22
      }
    },
    pressure: {
      durationByMode: {
        fit: 120,
        stress: 120,
        final: 420
      } as const satisfies Record<ProbeKind | 'final', number>,
      baselineByMode: {
        fit: 0.22,
        stress: 0.44,
        final: FINAL_PRESSURE_PROFILE.finalBaseline
      } as const satisfies Record<ProbeKind | 'final', number>,
      wave: {
        primaryDivisor: 18,
        primaryAmplitude: 0.06,
        secondaryDivisor: 11,
        secondaryAmplitude: 0.04
      },
      curveClamp: { min: 0.1, max: 0.95 } as ClampRange,
      publicNoise: { base: 0, spread: 0.035, min: 0.1, max: 0.98 } as JitterRange,
      burstCountByMode: {
        fit: 2,
        stress: 4,
        final: FINAL_PRESSURE_PROFILE.finalBurstCount
      } as const satisfies Record<ProbeKind | 'final', number>,
      burstWidth: { base: 10, variance: 20 },
      burstHeight: {
        fit: { base: 0.12, variance: 0.1 },
        stress: { base: 0.22, variance: 0.12 },
        final: FINAL_PRESSURE_PROFILE.finalBurstHeight
      } as const,
      burstClamp: { min: 0.1, max: 0.98 } as ClampRange
    },
    finalPhaseChange: {
      transitionWindowSeconds: 15,
      shiftCountWeights: FINAL_PRESSURE_PROFILE.shiftCountWeights,
      shiftPointMin: 90,
      shiftPointRange: 240,
      durationSeconds: { base: 18, variance: 14 },
      loadDelta: FINAL_PRESSURE_PROFILE.loadDelta,
      capDelta: FINAL_PRESSURE_PROFILE.capDelta,
      trafficDelta: FINAL_PRESSURE_PROFILE.trafficDelta,
      effectiveSoftCapClamp: { min: 0.2, max: 0.95 } as ClampRange
    },
    arrivals: {
      countByMode: {
        fit: 96,
        stress: 96,
        final: 340
      } as const satisfies Record<ProbeKind | 'final', number>,
      routeWeightMultipliers: {
        fit: { local: 1, intercity: 1, relay: 1, priority: 1 },
        stress: { local: 0.8, intercity: 1.15, relay: 1.15, priority: 1.15 },
        final: { local: 0.92, intercity: 1.05, relay: 1.04, priority: 1.08 }
      } as const satisfies Record<ProbeKind | 'final', Record<RouteCode, number>>,
      priorityUrgencyChance: 0.75,
      intercityVerifiedChance: 0.58,
      relaySpecialSubscriberChance: 0.6,
      stressLoadPenalty: 0.95,
      defaultLoadPenalty: PREMIUM_AND_LOAD_DIFFICULTY.defaultLoadPenalty,
      gapFactor: { base: 0.7, variance: 1.4 }
    }
  },
  runtimePenalties: {
    queueLoadFactorPerCall: 0.02,
    queueLoadCap: 8,
    liveLoadClamp: { min: 0, max: 1 } as ClampRange,
    defaultCurveLoad: 0.4,
    loadBandThresholds: {
      peak: 0.8,
      high: 0.62,
      medium: 0.38
    },
    queueBandThresholds: {
      long: 6,
      rising: 3
    },
    serviceDurationBaseByRoute: {
      local: 4,
      relay: 6,
      intercity: 8,
      priority: 5
    } as const satisfies Record<RouteCode, number>,
    urgencyServiceBonus: 1,
    serviceDurationVariance: 4,
    loadPenaltyMultiplier: PREMIUM_AND_LOAD_DIFFICULTY.loadPenaltyMultiplier,
    premiumMisusePenalty: -0.08,
    governmentRelayBias: 0.03,
    businessTrunkBias: 0.03,
    governmentExchangeBias: 0.06,
    suburbanRoutineBias: 0.04,
    connectionBase: 0.1,
    connectionScoreFactor: 0.9,
    queuePressureFactor: 0.06,
    connectionClamp: { min: 0.03, max: 0.99 } as ClampRange,
    queueHoldDenominator: 16,
    faultRecovery: { base: 4, loadFactor: 5 },
    postPlanHorizonSeconds: 90,
    premiumHeat: PREMIUM_AND_LOAD_DIFFICULTY.premiumHeat,
    pressureBandThresholds: {
      hot: 0.7,
      building: 0.42
    },
    suburbanLoadPenalty: PREMIUM_AND_LOAD_DIFFICULTY.suburbanLoadPenalty,
    hiddenTraitEffects: {
      collapseLoadThreshold: 0.58,
      collapsePenaltyScale: 0.18,
      collapseSoftCapScale: 0.12,
      tempoLagPenaltyScale: 0.16,
      finalShiftPenaltyScale: 0.12,
      premiumHeatFragilityScale: 0.85,
      premiumHeatDecayReliefScale: 0.45
    }
  },
  scoring: {
    deskConditionThresholds: {
      steady: 0.75,
      strained: 0.55
    }
  },
  probePresentation: {
    confidenceFloor: 0.2,
    confidenceCeiling: 0.99,
    confidenceTrafficFactor: 0.08,
    maxIncidentNotes: 8
  }
} as const
