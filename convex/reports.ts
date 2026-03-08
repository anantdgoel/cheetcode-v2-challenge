import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertSecret } from "./auth";
import { loadShift, type ShiftRunDoc } from "./records";
import { titleValidator } from "./validators";

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

export const upsertReport = mutation({
  args: {
    secret: v.string(),
    report: v.object({
      publicId: v.string(),
      shiftId: v.string(),
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
    }),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_publicId", (query) => query.eq("publicId", args.report.publicId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.report);
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("reports", args.report);
    return await ctx.db.get(id);
  },
});

export const adminLookup = query({
  args: {
    secret: v.string(),
    github: v.optional(v.string()),
    shiftId: v.optional(v.string()),
    publicId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
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

    const resolvedShiftId = args.shiftId ?? report?.shiftId ?? leaderboardRow?.shiftId ?? null;
    const shift = resolvedShiftId ? await loadShift(ctx.db, resolvedShiftId) : null;

    return {
      leaderboardRow: leaderboardRow
        ? {
            github: leaderboardRow.github,
            title: leaderboardRow.title,
            boardEfficiency: leaderboardRow.boardEfficiency,
            hiddenScore: leaderboardRow.hiddenScore,
            achievedAt: leaderboardRow.achievedAt,
            shiftId: leaderboardRow.shiftId,
            publicId: leaderboardRow.publicId,
            connectedCalls: leaderboardRow.connectedCalls,
            totalCalls: leaderboardRow.totalCalls,
            droppedCalls: leaderboardRow.droppedCalls,
            avgHoldSeconds: leaderboardRow.avgHoldSeconds,
          }
        : null,
      report,
      shift: shift
        ? {
            id: shift._id,
            github: shift.github,
            state: shift.state,
            expiresAt: shift.expiresAt,
          }
        : null,
      runs: shift
        ? shift.runs.map((run: ShiftRunDoc) => ({
            id: run.id,
            kind: run.kind === "final" ? (run.trigger === "auto_expire" ? "auto_final" : "final") : run.kind,
            state: run.state,
            acceptedAt: run.acceptedAt,
            resolvedAt: run.resolvedAt,
          }))
        : [],
    };
  },
});
