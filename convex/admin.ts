import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'

export const getCandidates = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const pageSize = args.pageSize ?? 25

    const results = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_hiddenScore_and_boardEfficiency_and_achievedAt')
      .order('desc')
      .paginate({ cursor: args.cursor ?? null, numItems: pageSize })

    const counter = await ctx.db.query('leaderboardMeta').first()
    const totalEntries = counter?.totalEntries ?? 0

    const rows = await Promise.all(
      results.page.map(async (entry) => {
        const shifts = await ctx.db
          .query('shifts')
          .withIndex('by_github_and_startedAt', (q) => q.eq('github', entry.github))
          .collect()

        const contact = await ctx.db
          .query('contactSubmissions')
          .withIndex('by_github', (q) => q.eq('github', entry.github))
          .first()

        const lastShift = shifts.length > 0
          ? shifts.reduce((latest, s) => s.startedAt > latest.startedAt ? s : latest, shifts[0])
          : null

        return {
          github: entry.github,
          title: entry.title,
          hiddenScore: entry.hiddenScore,
          boardEfficiency: entry.boardEfficiency,
          achievedAt: entry.achievedAt,
          publicId: entry.publicId,
          shiftCount: shifts.length,
          hasContact: !!contact,
          lastActive: lastShift?.startedAt ?? entry.achievedAt,
          connectedCalls: entry.connectedCalls,
          totalCalls: entry.totalCalls,
          droppedCalls: entry.droppedCalls,
          avgHoldSeconds: entry.avgHoldSeconds
        }
      })
    )

    return {
      rows,
      totalEntries,
      nextCursor: results.continueCursor,
      isDone: results.isDone
    }
  }
})

export const getCandidateDetail = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const [leaderboardRow, shifts, contact, summary] = await Promise.all([
      ctx.db
        .query('leaderboardBest')
        .withIndex('by_github', (q) => q.eq('github', args.github))
        .unique(),
      ctx.db
        .query('shifts')
        .withIndex('by_github_and_startedAt', (q) => q.eq('github', args.github))
        .order('desc')
        .collect(),
      ctx.db
        .query('contactSubmissions')
        .withIndex('by_github', (q) => q.eq('github', args.github))
        .first(),
      ctx.db
        .query('candidateSummaries')
        .withIndex('by_github', (q) => q.eq('github', args.github))
        .first()
    ])

    const shapedShifts = shifts.map((shift) => ({
      id: shift._id,
      state: shift.state,
      startedAt: shift.startedAt,
      completedAt: shift.completedAt,
      expiresAt: shift.expiresAt,
      runs: shift.runs.map((run) => ({
        id: run.id,
        kind: run.kind,
        trigger: run.trigger,
        state: run.state,
        acceptedAt: run.acceptedAt,
        resolvedAt: run.resolvedAt,
        sourceSnapshot: run.sourceSnapshot,
        metrics: run.metrics,
        title: run.title,
        chiefOperatorNote: run.chiefOperatorNote,
        probeSummary: run.probeSummary
          ? {
              metrics: run.probeSummary.metrics,
              failureModes: run.probeSummary.failureModes,
              deskCondition: run.probeSummary.deskCondition,
              probeKind: run.probeSummary.probeKind
            }
          : undefined
      }))
    }))

    return {
      github: args.github,
      leaderboardRow: leaderboardRow
        ? {
            github: leaderboardRow.github,
            title: leaderboardRow.title,
            boardEfficiency: leaderboardRow.boardEfficiency,
            hiddenScore: leaderboardRow.hiddenScore,
            achievedAt: leaderboardRow.achievedAt,
            publicId: leaderboardRow.publicId,
            shiftId: leaderboardRow.shiftId,
            connectedCalls: leaderboardRow.connectedCalls,
            totalCalls: leaderboardRow.totalCalls,
            droppedCalls: leaderboardRow.droppedCalls,
            avgHoldSeconds: leaderboardRow.avgHoldSeconds
          }
        : null,
      shifts: shapedShifts,
      contact: contact
        ? { name: contact.name, email: contact.email, submittedAt: contact.submittedAt }
        : null,
      summary: summary
        ? { summary: summary.summary, generatedAt: summary.generatedAt }
        : null
    }
  }
})

export const upsertSummary = internalMutation({
  args: {
    github: v.string(),
    summary: v.string(),
    generatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('candidateSummaries')
      .withIndex('by_github', (q) => q.eq('github', args.github))
      .first()

    if (existing) {
      await ctx.db.patch('candidateSummaries', existing._id, {
        summary: args.summary,
        generatedAt: args.generatedAt
      })
    } else {
      await ctx.db.insert('candidateSummaries', {
        github: args.github,
        summary: args.summary,
        generatedAt: args.generatedAt
      })
    }
  }
})
