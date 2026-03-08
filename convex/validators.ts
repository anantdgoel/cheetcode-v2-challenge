import { v } from "convex/values";

export const shiftStatusValidator = v.union(
  v.literal("active_phase_1"),
  v.literal("active_phase_2"),
  v.literal("evaluating"),
  v.literal("completed"),
  v.literal("expired_no_result"),
);

export const evaluationKindValidator = v.union(
  v.literal("fit"),
  v.literal("stress"),
  v.literal("final"),
  v.literal("auto_final"),
);

export const evaluationStateValidator = v.union(v.literal("accepted"), v.literal("completed"));

export const titleValidator = v.union(
  v.literal("chief_operator"),
  v.literal("senior_operator"),
  v.literal("operator"),
  v.literal("trainee"),
  v.literal("off_the_board"),
);

export const boardConditionValidator = v.union(
  v.literal("steady"),
  v.literal("strained"),
  v.literal("overrun"),
);

export const probeKindValidator = v.union(v.literal("fit"), v.literal("stress"));

export const artifactNameValidator = v.union(
  v.literal("manual.md"),
  v.literal("starter.js"),
  v.literal("lines.json"),
  v.literal("observations.jsonl"),
);

export const routeCodeValidator = v.union(
  v.literal("local"),
  v.literal("intercity"),
  v.literal("relay"),
  v.literal("priority"),
);

export const billingModeValidator = v.union(
  v.literal("standard"),
  v.literal("verified"),
  v.literal("collect"),
);

export const urgencyValidator = v.union(v.literal("routine"), v.literal("priority"));

export const loadBandValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("peak"),
);

export const probeSummaryMetricsValidator = v.object({
  connectedCalls: v.number(),
  totalCalls: v.number(),
  droppedCalls: v.number(),
  avgHoldSeconds: v.number(),
  premiumUsageRate: v.number(),
  efficiency: v.number(),
});

export const probeTableRowValidator = v.object({
  bucketId: v.string(),
  attempts: v.number(),
  connectRate: v.number(),
  dropRate: v.number(),
  avgHoldSeconds: v.number(),
  premiumUsageRate: v.number(),
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
      dominantReason: v.union(
        v.literal("hold_too_long"),
        v.literal("fault_under_load"),
        v.literal("premium_misuse"),
        v.literal("low_margin_routing"),
      ),
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
