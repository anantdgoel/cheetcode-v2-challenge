import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
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

async function incrementLeaderboardCount (ctx: MutationCtx) {
  const counter = await ctx.db.query('leaderboardMeta').first()
  if (counter) {
    await ctx.db.patch('leaderboardMeta', counter._id, { totalEntries: counter.totalEntries + 1 })
  } else {
    await ctx.db.insert('leaderboardMeta', { totalEntries: 1 })
  }
}

function stripLeaderboardEntry (entry: Doc<'leaderboardBest'>) {
  const { _id, _creationTime, hiddenScore: _, ...rest } = entry
  return rest
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_hiddenScore_and_boardEfficiency_and_achievedAt')
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...results, page: results.page.map(stripLeaderboardEntry) }
  }
})

export const getPositionForGithub = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_hiddenScore_and_boardEfficiency_and_achievedAt')
      .order('desc')
      .collect()
    const index = entries.findIndex((e) => e.github === args.github)
    return index === -1 ? null : index + 1
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
      await ctx.db.patch('leaderboardBest', existing._id, args.entry)
      return await ctx.db.get('leaderboardBest', existing._id)
    }

    const id = await ctx.db.insert('leaderboardBest', args.entry)
    await incrementLeaderboardCount(ctx)
    return await ctx.db.get('leaderboardBest', id)
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
      await ctx.db.patch('leaderboardBest', existing._id, entry)
      return await ctx.db.get('leaderboardBest', existing._id)
    }

    const id = await ctx.db.insert('leaderboardBest', entry)
    await incrementLeaderboardCount(ctx)
    return await ctx.db.get('leaderboardBest', id)
  }
})
