import { query } from "./_generated/server";

export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("leaderboardBest")
      .withIndex("by_hiddenScore")
      .order("desc")
      .take(100);

    return entries.sort((left, right) => {
      if (right.hiddenScore !== left.hiddenScore) {
        return right.hiddenScore - left.hiddenScore;
      }
      if (right.boardEfficiency !== left.boardEfficiency) {
        return right.boardEfficiency - left.boardEfficiency;
      }
      return left.achievedAt - right.achievedAt;
    });
  },
});
