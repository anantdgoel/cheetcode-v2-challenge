import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from './_generated/server'

export const submit = internalMutation({
  args: {
    github: v.string(),
    name: v.string(),
    email: v.string(),
    reportPublicId: v.string()
  },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query('reports')
      .withIndex('by_publicId', (q) => q.eq('publicId', args.reportPublicId))
      .unique()

    if (!report) {
      throw new Error('report not found')
    }

    const existing = await ctx.db
      .query('contactSubmissions')
      .withIndex('by_reportPublicId', (q) => q.eq('reportPublicId', args.reportPublicId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        submittedAt: Date.now()
      })
      return
    }

    await ctx.db.insert('contactSubmissions', {
      github: args.github,
      name: args.name,
      email: args.email,
      reportPublicId: args.reportPublicId,
      submittedAt: Date.now()
    })
  }
})

export const getByReportPublicId = query({
  args: { reportPublicId: v.string() },
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query('contactSubmissions')
      .withIndex('by_reportPublicId', (q) => q.eq('reportPublicId', args.reportPublicId))
      .unique()

    return submission ? { submitted: true } : null
  }
})

export const getByGithub = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('contactSubmissions')
      .withIndex('by_github', (q) => q.eq('github', args.github))
      .first()
  }
})
