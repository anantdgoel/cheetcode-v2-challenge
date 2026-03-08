import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, internalQuery, query } from './_generated/server'
import { finalReportValidator, leaderboardEntryValidator } from './validators'

function isBetterLeaderboardCandidate (
  current: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  } | null,
  candidate: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  }
) {
  if (!current) return true
  if (candidate.hiddenScore !== current.hiddenScore) return candidate.hiddenScore > current.hiddenScore
  if (candidate.boardEfficiency !== current.boardEfficiency) return candidate.boardEfficiency > current.boardEfficiency
  return candidate.achievedAt < current.achievedAt
}

export function compareLeaderboardEntries (
  left: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  },
  right: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  }
) {
  if (right.hiddenScore !== left.hiddenScore) return right.hiddenScore - left.hiddenScore
  if (right.boardEfficiency !== left.boardEfficiency) return right.boardEfficiency - left.boardEfficiency
  return left.achievedAt - right.achievedAt
}

export function toPublicLeaderboard<T extends {
  hiddenScore: number;
  boardEfficiency: number;
  achievedAt: number;
}> (entries: T[]) {
  return entries.sort(compareLeaderboardEntries).slice(0, 100)
}

async function getLeaderboardCount (ctx: QueryCtx) {
  const counter = await ctx.db.query('leaderboardMeta').first()
  return counter?.totalEntries ?? 0
}

async function incrementLeaderboardCount (ctx: MutationCtx) {
  const counter = await ctx.db.query('leaderboardMeta').first()
  if (counter) {
    await ctx.db.patch(counter._id, { totalEntries: counter.totalEntries + 1 })
  } else {
    await ctx.db.insert('leaderboardMeta', { totalEntries: 1 })
  }
}

export const getPublic = query({
  args: {
    dispatchPage: v.optional(v.number()),
    dispatchPageSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const pageSize = args.dispatchPageSize ?? 7
    const page = args.dispatchPage ?? 0
    const needed = 3 + page * pageSize + pageSize

    const entries = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_hiddenScore_and_boardEfficiency_and_achievedAt')
      .order('desc')
      .take(needed)

    const totalEntries = await getLeaderboardCount(ctx)

    const topEntries = entries.slice(0, 3)
    const dispatchStart = 3 + page * pageSize
    const dispatchEntries = entries.slice(dispatchStart, dispatchStart + pageSize)
    const totalDispatchPages = Math.max(1, Math.ceil(Math.max(0, totalEntries - 3) / pageSize))

    return {
      topEntries,
      dispatchEntries,
      totalEntries,
      dispatchPage: page,
      totalDispatchPages
    }
  }
})

export const getForGithub = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('leaderboardBest')
      .withIndex('by_github', (query) => query.eq('github', args.github))
      .unique()
  }
})

export const upsertBest = internalMutation({
  args: {
    entry: leaderboardEntryValidator
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_github', (query) => query.eq('github', args.entry.github))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, args.entry)
      return await ctx.db.get(existing._id)
    }

    const id = await ctx.db.insert('leaderboardBest', args.entry)
    await incrementLeaderboardCount(ctx)
    return await ctx.db.get(id)
  }
})

export const maybeUpsertFromReport = internalMutation({
  args: {
    report: finalReportValidator
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_github', (query) => query.eq('github', args.report.github))
      .unique()

    if (
      !isBetterLeaderboardCandidate(existing, {
        hiddenScore: args.report.hiddenScore,
        boardEfficiency: args.report.boardEfficiency,
        achievedAt: args.report.achievedAt
      })
    ) {
      return existing
    }

    const entry = {
      github: args.report.github,
      title: args.report.title,
      boardEfficiency: args.report.boardEfficiency,
      hiddenScore: args.report.hiddenScore,
      achievedAt: args.report.achievedAt,
      shiftId: args.report.shiftId,
      publicId: args.report.publicId,
      connectedCalls: args.report.connectedCalls,
      totalCalls: args.report.totalCalls,
      droppedCalls: args.report.droppedCalls,
      avgHoldSeconds: args.report.avgHoldSeconds
    }

    if (existing) {
      await ctx.db.patch(existing._id, entry)
      return await ctx.db.get(existing._id)
    }

    const id = await ctx.db.insert('leaderboardBest', entry)
    await incrementLeaderboardCount(ctx)
    return await ctx.db.get(id)
  }
})
