import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  artifactNameValidator,
  evaluationKindValidator,
  evaluationStateValidator,
  probeKindValidator,
  probeSummaryValidator,
  shiftStatusValidator,
  simulationMetricsValidator,
  titleValidator,
} from "./validators";

export default defineSchema({
  shifts: defineTable({
    github: v.string(),
    seed: v.string(),
    status: shiftStatusValidator,
    artifactVersion: v.number(),
    startedAt: v.number(),
    phase1EndsAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    latestDraftSource: v.string(),
    latestDraftSavedAt: v.number(),
    latestValidSource: v.optional(v.string()),
    latestValidSourceHash: v.optional(v.string()),
    latestValidAt: v.optional(v.number()),
    latestValidationError: v.optional(v.string()),
    latestValidationCheckedAt: v.optional(v.number()),
    probesUsed: v.number(),
    probeResults: v.array(
      v.object({
        kind: probeKindValidator,
        at: v.number(),
        efficiency: v.number(),
        sourceHash: v.string(),
      }),
    ),
    artifactFetches: v.array(
      v.object({
        name: artifactNameValidator,
        at: v.number(),
      }),
    ),
    validationAttempts: v.number(),
    policyRevisions: v.number(),
    validatedSourceHashes: v.array(v.string()),
    probeAcceptedAt: v.optional(v.number()),
    finalAcceptedAt: v.optional(v.number()),
    finalEvaluationId: v.optional(v.id("evaluations")),
    reportPublicId: v.optional(v.string()),
    bundleHashes: v.object({
      manualMd: v.string(),
      starterJs: v.string(),
      linesJson: v.string(),
      observationsJsonl: v.string(),
    }),
  })
    .index("by_github_startedAt", ["github", "startedAt"])
    .index("by_status_expiresAt", ["status", "expiresAt"]),

  evaluations: defineTable({
    shiftId: v.id("shifts"),
    github: v.string(),
    kind: evaluationKindValidator,
    state: evaluationStateValidator,
    acceptedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    sourceHash: v.string(),
    sourceSnapshot: v.string(),
    probeSummary: v.optional(probeSummaryValidator),
    failureModeSummary: v.optional(v.array(v.string())),
    incidentLog: v.optional(v.array(v.string())),
    metrics: v.optional(simulationMetricsValidator),
    title: v.optional(titleValidator),
    chiefOperatorNote: v.optional(v.string()),
    reportPublicId: v.optional(v.string()),
    traceChunkCount: v.optional(v.number()),
  })
    .index("by_shift_kind", ["shiftId", "kind"])
    .index("by_shift_acceptedAt", ["shiftId", "acceptedAt"]),

  leaderboardBest: defineTable({
    github: v.string(),
    title: titleValidator,
    hiddenScore: v.number(),
    boardEfficiency: v.number(),
    achievedAt: v.number(),
    shiftId: v.id("shifts"),
    publicId: v.string(),
    connectedCalls: v.optional(v.number()),
    totalCalls: v.optional(v.number()),
    droppedCalls: v.optional(v.number()),
    avgHoldSeconds: v.optional(v.number()),
  })
    .index("by_github", ["github"])
    .index("by_hiddenScore", ["hiddenScore", "boardEfficiency", "achievedAt"]),

  reports: defineTable({
    publicId: v.string(),
    shiftId: v.id("shifts"),
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
    kind: v.union(v.literal("final"), v.literal("auto_final")),
  })
    .index("by_publicId", ["publicId"])
    .index("by_achievedAt", ["achievedAt"]),

  evaluationTraceChunks: defineTable({
    evaluationId: v.id("evaluations"),
    chunkIndex: v.number(),
    payload: v.string(),
  }).index("by_evaluation", ["evaluationId", "chunkIndex"]),
});
