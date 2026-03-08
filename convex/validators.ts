import { v } from "convex/values";
import {
  ARTIFACT_NAMES,
  BILLING_MODES,
  BOARD_CONDITIONS,
  LOAD_BANDS,
  PROBE_KINDS,
  ROUTE_CODES,
  TITLES,
  URGENCIES,
} from "../src/lib/domain/game";

function literalUnion<T extends string>(values: readonly [T, ...T[]]) {
  return v.union(...(values.map((value) => v.literal(value)) as any));
}

export const shiftStateValidator = literalUnion(["active", "completed", "expired"]);
export const storedRunKindValidator = literalUnion(["fit", "stress", "final"]);
export const storedRunTriggerValidator = literalUnion(["manual", "auto_expire"]);
export const runStateValidator = literalUnion(["accepted", "completed"]);
export const titleValidator = literalUnion(TITLES);
export const boardConditionValidator = literalUnion(BOARD_CONDITIONS);
export const probeKindValidator = literalUnion(PROBE_KINDS);
export const artifactNameValidator = literalUnion(ARTIFACT_NAMES);
export const routeCodeValidator = literalUnion(ROUTE_CODES);
export const billingModeValidator = literalUnion(BILLING_MODES);
export const urgencyValidator = literalUnion(URGENCIES);
export const loadBandValidator = literalUnion(LOAD_BANDS);

export const probeSummaryMetricsValidator = v.object({
  connectedCalls: v.number(),
  totalCalls: v.number(),
  droppedCalls: v.number(),
  avgHoldSeconds: v.number(),
  premiumUsageRate: v.number(),
  efficiency: v.number(),
});

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
      urgency: urgencyValidator,
    }),
  ),
  loadBandTable: v.array(
    v.object({
      bucketId: v.string(),
      attempts: v.number(),
      connectRate: v.number(),
      dropRate: v.number(),
      avgHoldSeconds: v.number(),
      premiumUsageRate: v.number(),
      loadBand: loadBandValidator,
    }),
  ),
  lineGroupTable: v.array(
    v.object({
      lineGroupId: v.string(),
      usageCount: v.number(),
      connectRate: v.number(),
      faultRate: v.number(),
      premiumUsageRate: v.number(),
    }),
  ),
  failureBuckets: v.array(
    v.object({
      bucketId: v.string(),
      count: v.number(),
      dominantReason: literalUnion([
        "hold_too_long",
        "fault_under_load",
        "premium_misuse",
        "low_margin_routing",
      ]),
      confidence: v.number(),
    }),
  ),
  incidents: v.array(
    v.object({
      second: v.number(),
      note: v.string(),
    }),
  ),
});

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
  hiddenScore: v.number(),
});

export const policyValidationResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    normalizedSource: v.string(),
    sourceHash: v.string(),
  }),
  v.object({
    ok: v.literal(false),
    error: v.string(),
  }),
);

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
  reportPublicId: v.optional(v.string()),
});
