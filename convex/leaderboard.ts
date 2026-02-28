import { query } from "./_generated/server";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("leaderboard")
      .withIndex("by_elo")
      .order("desc")
      .collect();

    return entries.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return (a.attempts ?? 1) - (b.attempts ?? 1);
    });
  },
});