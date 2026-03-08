import { v } from "convex/values";
import { action, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_MUTATION_SECRET;
  if (!expected) {
    throw new Error("CONVEX_MUTATION_SECRET is not configured in the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("unauthorized");
  }
}

type AdminLookupResult = {
  leaderboardRow: Doc<"leaderboardBest"> | null;
  report: Doc<"reports"> | null;
  shift: Doc<"shifts"> | null;
  evaluations: Array<Doc<"evaluations">>;
  trace:
    | {
        evaluationId: Id<"evaluations">;
        page: number;
        totalPages: number;
        chunk: Doc<"evaluationTraceChunks"> | null;
      }
    | null;
};

export const getRecentReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("reports")
      .withIndex("by_achievedAt")
      .order("desc")
      .take(Math.min(args.limit ?? 8, 24));
  },
});

export const getReportByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("reports")
      .withIndex("by_publicId", (query) => query.eq("publicId", args.publicId))
      .first();
  },
});

export const adminLookupInternal = internalQuery({
  args: {
    github: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    publicId: v.optional(v.string()),
    evaluationId: v.optional(v.id("evaluations")),
    tracePage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leaderboardRow = args.github
      ? await ctx.db
          .query("leaderboardBest")
          .withIndex("by_github", (query) => query.eq("github", args.github!))
          .first()
      : null;

    const report = args.publicId
      ? await ctx.db
          .query("reports")
          .withIndex("by_publicId", (query) => query.eq("publicId", args.publicId!))
          .first()
      : null;

    const shiftId = args.shiftId ?? report?.shiftId ?? leaderboardRow?.shiftId ?? null;
    const shift = shiftId ? await ctx.db.get(shiftId) : null;
    const evaluations = shiftId
      ? await ctx.db
          .query("evaluations")
          .withIndex("by_shift_acceptedAt", (query) => query.eq("shiftId", shiftId))
          .order("desc")
          .collect()
      : [];

    const chosenEvaluationId =
      args.evaluationId ??
      evaluations.find(
        (evaluation) =>
          evaluation.kind === "final" || evaluation.kind === "auto_final",
      )?._id ??
      evaluations[0]?._id;

    const tracePage = Math.max(0, args.tracePage ?? 0);
    const traceChunks = chosenEvaluationId
      ? await ctx.db
          .query("evaluationTraceChunks")
          .withIndex("by_evaluation", (query) => query.eq("evaluationId", chosenEvaluationId))
          .order("asc")
          .collect()
      : [];

    return {
      leaderboardRow,
      report,
      shift,
      evaluations,
      trace: chosenEvaluationId
        ? {
            evaluationId: chosenEvaluationId,
            page: tracePage,
            totalPages: traceChunks.length,
            chunk: traceChunks[tracePage] ?? null,
          }
        : null,
    };
  },
});

export const adminLookup = action({
  args: {
    secret: v.string(),
    github: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    publicId: v.optional(v.string()),
    evaluationId: v.optional(v.id("evaluations")),
    tracePage: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AdminLookupResult> => {
    assertSecret(args.secret);
    return ctx.runQuery(internal.leads.adminLookupInternal, {
      github: args.github,
      shiftId: args.shiftId,
      publicId: args.publicId,
      evaluationId: args.evaluationId,
      tracePage: args.tracePage,
    });
  },
});
