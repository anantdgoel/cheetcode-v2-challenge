import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertSecret } from "./auth";
import { titleValidator } from "./validators";

export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("leaderboardBest")
      .withIndex("by_hiddenScore")
      .order("desc")
      .take(100);

    return entries.sort((left, right) => {
      if (right.hiddenScore !== left.hiddenScore) return right.hiddenScore - left.hiddenScore;
      if (right.boardEfficiency !== left.boardEfficiency) return right.boardEfficiency - left.boardEfficiency;
      return left.achievedAt - right.achievedAt;
    });
  },
});

export const getForGithub = query({
  args: { secret: v.string(), github: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db
      .query("leaderboardBest")
      .withIndex("by_github", (query) => query.eq("github", args.github))
      .first();
  },
});

export const upsertBest = mutation({
  args: {
    secret: v.string(),
    entry: v.object({
      github: v.string(),
      title: titleValidator,
      hiddenScore: v.number(),
      boardEfficiency: v.number(),
      achievedAt: v.number(),
      shiftId: v.string(),
      publicId: v.string(),
      connectedCalls: v.optional(v.number()),
      totalCalls: v.optional(v.number()),
      droppedCalls: v.optional(v.number()),
      avgHoldSeconds: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("leaderboardBest")
      .withIndex("by_github", (query) => query.eq("github", args.entry.github))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.entry);
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("leaderboardBest", args.entry);
    return await ctx.db.get(id);
  },
});
