import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isProbeKind } from "../src/lib/shift-runtime";
import {
  probeSummaryValidator,
  simulationMetricsValidator,
  titleValidator,
} from "./validators";

type ReadCtx = Pick<QueryCtx, "db">;

type CompleteProbeArgs = {
  github: string;
  shiftId: Id<"shifts">;
  evaluationId: Id<"evaluations">;
  probeSummary: Doc<"evaluations">["probeSummary"] extends infer TValue
    ? Exclude<TValue, undefined>
    : never;
  traceChunks: string[];
};

type CompleteFinalArgs = {
  github: string;
  shiftId: Id<"shifts">;
  evaluationId: Id<"evaluations">;
  reportPublicId: string;
  title: Doc<"reports">["title"];
  metrics: Doc<"reports"> extends never ? never : {
    connectedCalls: number;
    totalCalls: number;
    droppedCalls: number;
    avgHoldSeconds: number;
    totalHoldSeconds: number;
    premiumUsageCount: number;
    premiumUsageRate: number;
    trunkMisuseCount: number;
    efficiency: number;
    hiddenScore: number;
  };
  chiefOperatorNote: string;
  achievedAt: number;
  traceChunks: string[];
};

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_MUTATION_SECRET;
  if (!expected) {
    throw new Error("CONVEX_MUTATION_SECRET is not configured in the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("unauthorized");
  }
}

async function storeTraceChunks(
  ctx: MutationCtx,
  evaluationId: Id<"evaluations">,
  chunks: string[],
) {
  const existing = await ctx.db
    .query("evaluationTraceChunks")
    .withIndex("by_evaluation", (query) => query.eq("evaluationId", evaluationId))
    .collect();

  if (existing.length) return existing.length;

  for (let index = 0; index < chunks.length; index += 1) {
    await ctx.db.insert("evaluationTraceChunks", {
      evaluationId,
      chunkIndex: index,
      payload: chunks[index],
    });
  }

  return chunks.length;
}

async function completeProbeRecord(
  ctx: MutationCtx,
  args: CompleteProbeArgs,
) {
  const shift = await ctx.db.get(args.shiftId);
  if (!shift || shift.github !== args.github) throw new Error("shift not found");

  const evaluation = await ctx.db.get(args.evaluationId);
  if (!evaluation || evaluation.shiftId !== args.shiftId || !isProbeKind(evaluation.kind)) {
    throw new Error("probe evaluation not found");
  }

  if (evaluation.state === "completed") {
    return evaluation;
  }

  const resolvedAt = Date.now();
  const traceChunkCount = await storeTraceChunks(ctx, args.evaluationId, args.traceChunks);

  await ctx.db.patch(args.evaluationId, {
    state: "completed",
    resolvedAt,
    probeSummary: args.probeSummary,
    failureModeSummary: [],
    incidentLog: [],
    traceChunkCount,
  });

  const probeResults = [
    ...shift.probeResults,
    {
      kind: evaluation.kind,
      at: resolvedAt,
      efficiency: args.probeSummary.metrics.efficiency,
      sourceHash: evaluation.sourceHash,
    },
  ];

  await ctx.db.patch(args.shiftId, {
    status: shift.status,
    probeResults,
    probesUsed: probeResults.length,
    probeAcceptedAt: undefined,
  });

  return await ctx.db.get(args.evaluationId);
}

async function completeFinalRecord(
  ctx: MutationCtx,
  args: CompleteFinalArgs,
) {
  const shift = await ctx.db.get(args.shiftId);
  if (!shift || shift.github !== args.github) throw new Error("shift not found");

  const evaluation = await ctx.db.get(args.evaluationId);
  if (
    !evaluation ||
    evaluation.shiftId !== args.shiftId ||
    (evaluation.kind !== "final" && evaluation.kind !== "auto_final")
  ) {
    throw new Error("final evaluation not found");
  }

  if (evaluation.state === "completed" && evaluation.reportPublicId) {
    const existingReportPublicId = evaluation.reportPublicId;
    return ctx.db
      .query("reports")
      .withIndex("by_publicId", (query) => query.eq("publicId", existingReportPublicId))
      .first();
  }

  const traceChunkCount = await storeTraceChunks(ctx, args.evaluationId, args.traceChunks);
  const kind = evaluation.kind === "auto_final" ? "auto_final" : "final";

  const existingReport = await ctx.db
    .query("reports")
    .withIndex("by_publicId", (query) => query.eq("publicId", args.reportPublicId))
    .first();

  const reportId =
    existingReport?._id ??
    (await ctx.db.insert("reports", {
      publicId: args.reportPublicId,
      shiftId: args.shiftId,
      github: args.github,
      title: args.title,
      boardEfficiency: args.metrics.efficiency,
      connectedCalls: args.metrics.connectedCalls,
      totalCalls: args.metrics.totalCalls,
      droppedCalls: args.metrics.droppedCalls,
      avgHoldSeconds: args.metrics.avgHoldSeconds,
      premiumTrunkUsage: args.metrics.premiumUsageCount,
      chiefOperatorNote: args.chiefOperatorNote,
      achievedAt: args.achievedAt,
      hiddenScore: args.metrics.hiddenScore,
      kind,
    }));

  await ctx.db.patch(args.evaluationId, {
    state: "completed",
    resolvedAt: Date.now(),
    metrics: args.metrics,
    title: args.title,
    chiefOperatorNote: args.chiefOperatorNote,
    reportPublicId: args.reportPublicId,
    traceChunkCount,
  });

  await ctx.db.patch(args.shiftId, {
    status: "completed",
    completedAt: args.achievedAt,
    reportPublicId: args.reportPublicId,
    finalEvaluationId: args.evaluationId,
    finalAcceptedAt: shift.finalAcceptedAt || args.achievedAt,
  });

  const existingLeaderboard = await ctx.db
    .query("leaderboardBest")
    .withIndex("by_github", (query) => query.eq("github", args.github))
    .first();

  if (
    shouldReplaceLeaderboard(
      existingLeaderboard
        ? {
            hiddenScore: existingLeaderboard.hiddenScore,
            boardEfficiency: existingLeaderboard.boardEfficiency,
            achievedAt: existingLeaderboard.achievedAt,
          }
        : null,
      {
        hiddenScore: args.metrics.hiddenScore,
        boardEfficiency: args.metrics.efficiency,
        achievedAt: args.achievedAt,
      },
    )
  ) {
    if (existingLeaderboard) {
      await ctx.db.patch(existingLeaderboard._id, {
        title: args.title,
        hiddenScore: args.metrics.hiddenScore,
        boardEfficiency: args.metrics.efficiency,
        achievedAt: args.achievedAt,
        shiftId: args.shiftId,
        publicId: args.reportPublicId,
        connectedCalls: args.metrics.connectedCalls,
        totalCalls: args.metrics.totalCalls,
        droppedCalls: args.metrics.droppedCalls,
        avgHoldSeconds: args.metrics.avgHoldSeconds,
      });
    } else {
      await ctx.db.insert("leaderboardBest", {
        github: args.github,
        title: args.title,
        hiddenScore: args.metrics.hiddenScore,
        boardEfficiency: args.metrics.efficiency,
        achievedAt: args.achievedAt,
        shiftId: args.shiftId,
        publicId: args.reportPublicId,
        connectedCalls: args.metrics.connectedCalls,
        totalCalls: args.metrics.totalCalls,
        droppedCalls: args.metrics.droppedCalls,
        avgHoldSeconds: args.metrics.avgHoldSeconds,
      });
    }
  }

  return await ctx.db.get(reportId);
}

function shouldReplaceLeaderboard(
  existing: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  } | null,
  candidate: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  },
) {
  if (!existing) return true;
  if (candidate.hiddenScore !== existing.hiddenScore) {
    return candidate.hiddenScore > existing.hiddenScore;
  }
  if (candidate.boardEfficiency !== existing.boardEfficiency) {
    return candidate.boardEfficiency > existing.boardEfficiency;
  }
  return candidate.achievedAt < existing.achievedAt;
}

export const getTraceChunks = internalQuery({
  args: { evaluationId: v.id("evaluations") },
  handler: async (ctx: ReadCtx, args) => {
    return ctx.db
      .query("evaluationTraceChunks")
      .withIndex("by_evaluation", (query) => query.eq("evaluationId", args.evaluationId))
      .order("asc")
      .collect();
  },
});

export const completeProbeInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    evaluationId: v.id("evaluations"),
    probeSummary: probeSummaryValidator,
    traceChunks: v.array(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    return completeProbeRecord(ctx, args);
  },
});

export const completeFinalInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    evaluationId: v.id("evaluations"),
    reportPublicId: v.string(),
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    achievedAt: v.number(),
    traceChunks: v.array(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    return completeFinalRecord(ctx, args);
  },
});

export const completeProbe = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
    evaluationId: v.id("evaluations"),
    probeSummary: probeSummaryValidator,
    traceChunks: v.array(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    assertSecret(args.secret);
    return completeProbeRecord(ctx, {
      github: args.github,
      shiftId: args.shiftId,
      evaluationId: args.evaluationId,
      probeSummary: args.probeSummary,
      traceChunks: args.traceChunks,
    });
  },
});

export const completeFinal = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
    evaluationId: v.id("evaluations"),
    reportPublicId: v.string(),
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    achievedAt: v.number(),
    traceChunks: v.array(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    assertSecret(args.secret);
    return completeFinalRecord(ctx, {
      github: args.github,
      shiftId: args.shiftId,
      evaluationId: args.evaluationId,
      reportPublicId: args.reportPublicId,
      title: args.title,
      metrics: args.metrics,
      chiefOperatorNote: args.chiefOperatorNote,
      achievedAt: args.achievedAt,
      traceChunks: args.traceChunks,
    });
  },
});
