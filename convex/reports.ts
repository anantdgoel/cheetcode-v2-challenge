import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from './_generated/server'
import { loadShiftById, type ShiftRunDoc } from './records'
import { finalReportValidator } from './validators'

export const getRecentReports = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query('reports')
      .withIndex('by_achievedAt')
      .order('desc')
      .take(Math.min(args.limit ?? 8, 24))
  }
})

export const getReportByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('reports')
      .withIndex('by_publicId', (query) => query.eq('publicId', args.publicId))
      .unique()
  }
})

export const upsertReport = internalMutation({
  args: {
    report: finalReportValidator
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('reports')
      .withIndex('by_publicId', (query) => query.eq('publicId', args.report.publicId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, args.report)
      return await ctx.db.get(existing._id)
    }

    const id = await ctx.db.insert('reports', args.report)
    return await ctx.db.get(id)
  }
})

export const adminLookup = internalQuery({
  args: {
    github: v.optional(v.string()),
    shiftId: v.optional(v.id('shifts')),
    publicId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const leaderboardRow = args.github
      ? await ctx.db
        .query('leaderboardBest')
        .withIndex('by_github', (query) => query.eq('github', args.github))
        .unique()
      : null

    const report = args.publicId
      ? await ctx.db
        .query('reports')
        .withIndex('by_publicId', (query) => query.eq('publicId', args.publicId))
        .unique()
      : null

    const resolvedShiftId = args.shiftId ?? report?.shiftId ?? leaderboardRow?.shiftId ?? null
    const shift = resolvedShiftId ? await loadShiftById(ctx.db, resolvedShiftId) : null

    const resolvedGithub = args.github ?? report?.github ?? leaderboardRow?.github ?? shift?.github ?? null
    const contactRow = resolvedGithub
      ? await ctx.db
        .query('contactSubmissions')
        .withIndex('by_github', (q) => q.eq('github', resolvedGithub))
        .first()
      : null

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
            avgHoldSeconds: leaderboardRow.avgHoldSeconds
          }
        : null,
      report,
      shift: shift
        ? {
            id: shift._id,
            github: shift.github,
            state: shift.state,
            expiresAt: shift.expiresAt
          }
        : null,
      runs: shift
        ? shift.runs.map((run: ShiftRunDoc) => ({
          id: run.id,
          kind: run.kind === 'final' ? (run.trigger === 'auto_expire' ? 'auto_final' : 'final') : run.kind,
          state: run.state,
          acceptedAt: run.acceptedAt,
          resolvedAt: run.resolvedAt
        }))
        : [],
      contact: contactRow
        ? { name: contactRow.name, email: contactRow.email, submittedAt: contactRow.submittedAt }
        : null
    }
  }
})
