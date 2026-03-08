import { v } from 'convex/values'
import {
  ARTIFACT_NAMES,
  BILLING_MODES,
  BOARD_CONDITIONS,
  FAILURE_MODES,
  LOAD_BANDS,
  PROBE_KINDS,
  ROUTE_CODES,
  TITLES,
  TRANSFER_WARNINGS,
  URGENCIES
} from '../src/core/domain/game'

type LiteralValidator<T extends string> = ReturnType<typeof v.literal<T>>

function literalUnion<T extends string> (values: readonly [T, ...T[]]) {
  return v.union(...values.map((value) => v.literal(value)) as [
    LiteralValidator<T>,
    LiteralValidator<T>,
    ...Array<LiteralValidator<T>>
  ])
}

export const shiftStateValidator = literalUnion(['active', 'completed', 'expired'])
export const storedRunKindValidator = literalUnion(['fit', 'stress', 'final'])
export const storedRunTriggerValidator = literalUnion(['manual', 'auto_expire'])
export const runStateValidator = literalUnion(['accepted', 'processing', 'completed'])
export const titleValidator = literalUnion(TITLES)
export const boardConditionValidator = literalUnion(BOARD_CONDITIONS)
export const probeKindValidator = literalUnion(PROBE_KINDS)
export const artifactNameValidator = literalUnion(ARTIFACT_NAMES)
export const routeCodeValidator = literalUnion(ROUTE_CODES)
export const billingModeValidator = literalUnion(BILLING_MODES)
export const urgencyValidator = literalUnion(URGENCIES)
export const loadBandValidator = literalUnion(LOAD_BANDS)
export const failureModeValidator = literalUnion(FAILURE_MODES)
export const transferWarningValidator = literalUnion(TRANSFER_WARNINGS)

export const probeSummaryMetricsValidator = v.object({
  connectedCalls: v.number(),
  totalCalls: v.number(),
  droppedCalls: v.number(),
  avgHoldSeconds: v.number(),
  premiumUsageRate: v.number(),
  efficiency: v.number()
})

export const probeSummaryValidator = v.object({
  probeKind: probeKindValidator,
  deskCondition: boardConditionValidator,
  metrics: probeSummaryMetricsValidator,
  callBucketTable: v.array(
    v.object({
      bucketId: v.string(),
      attempts: v.number(),
      connectRate: v.number(),
      dropRate: v.number(),
      avgHoldSeconds: v.number(),
      premiumUsageRate: v.number(),
      routeCode: routeCodeValidator,
      billingMode: billingModeValidator,
      urgency: urgencyValidator
    })
  ),
  loadBandTable: v.array(
    v.object({
      bucketId: v.string(),
      attempts: v.number(),
      connectRate: v.number(),
      dropRate: v.number(),
      avgHoldSeconds: v.number(),
      premiumUsageRate: v.number(),
      loadBand: loadBandValidator
    })
  ),
  lineGroupTable: v.array(
    v.object({
      lineGroupId: v.string(),
      usageCount: v.number(),
      connectRate: v.number(),
      faultRate: v.number(),
      premiumUsageRate: v.number()
    })
  ),
  failureBuckets: v.array(
    v.object({
      bucketId: v.string(),
      count: v.number(),
      dominantReason: literalUnion([
        'hold_too_long',
        'fault_under_load',
        'premium_misuse',
        'low_margin_routing'
      ]),
      confidence: v.number()
    })
  ),
  failureModes: v.array(failureModeValidator),
  modeConfidence: v.object({
    collapse_under_pressure: v.optional(v.number()),
    premium_thrash: v.optional(v.number()),
    overholding: v.optional(v.number()),
    false_generalist: v.optional(v.number()),
    tempo_lag: v.optional(v.number()),
    misleading_history: v.optional(v.number())
  }),
  transferWarning: transferWarningValidator,
  recommendedQuestions: v.array(v.string()),
  chiefOperatorNotes: v.array(v.string()),
  counterfactualNotes: v.array(v.string()),
  incidents: v.array(
    v.object({
      second: v.number(),
      note: v.string()
    })
  )
})

export const simulationMetricsValidator = v.object({
  connectedCalls: v.number(),
  totalCalls: v.number(),
  droppedCalls: v.number(),
  avgHoldSeconds: v.number(),
  totalHoldSeconds: v.number(),
  premiumUsageCount: v.number(),
  premiumUsageRate: v.number(),
  trunkMisuseCount: v.number(),
  efficiency: v.number(),
  hiddenScore: v.number()
})

export const policyValidationResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    normalizedSource: v.string(),
    sourceHash: v.string()
  }),
  v.object({
    ok: v.literal(false),
    error: v.string()
  })
)

export const reportKindValidator = literalUnion(['final', 'auto_final'])

export const finalReportValidator = v.object({
  publicId: v.string(),
  shiftId: v.id('shifts'),
  github: v.string(),
  title: titleValidator,
  boardEfficiency: v.number(),
  connectedCalls: v.number(),
  totalCalls: v.number(),
  droppedCalls: v.number(),
  avgHoldSeconds: v.number(),
  premiumTrunkUsage: v.number(),
  chiefOperatorNote: v.string(),
  achievedAt: v.number(),
  hiddenScore: v.number(),
  kind: reportKindValidator
})

export const leaderboardEntryValidator = v.object({
  github: v.string(),
  title: titleValidator,
  hiddenScore: v.number(),
  boardEfficiency: v.number(),
  achievedAt: v.number(),
  shiftId: v.id('shifts'),
  publicId: v.string(),
  connectedCalls: v.optional(v.number()),
  totalCalls: v.optional(v.number()),
  droppedCalls: v.optional(v.number()),
  avgHoldSeconds: v.optional(v.number())
})

export const storedRunValidator = v.object({
  id: v.string(),
  kind: storedRunKindValidator,
  trigger: storedRunTriggerValidator,
  state: runStateValidator,
  acceptedAt: v.number(),
  resolvedAt: v.optional(v.number()),
  sourceHash: v.string(),
  sourceSnapshot: v.string(),
  probeSummary: v.optional(probeSummaryValidator),
  metrics: v.optional(simulationMetricsValidator),
  title: v.optional(titleValidator),
  chiefOperatorNote: v.optional(v.string()),
  reportPublicId: v.optional(v.string())
})
