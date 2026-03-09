import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  shiftTableValidator,
  titleValidator
} from './validators'

export default defineSchema({
  shifts: defineTable(shiftTableValidator)
    .index('by_github_and_startedAt', ['github', 'startedAt'])
    .index('by_state_and_expiresAt', ['state', 'expiresAt']),

  reports: defineTable({
    publicId: v.string(),
    shiftId: v.id('shifts'),
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
    kind: v.union(v.literal('final'), v.literal('auto_final'))
  })
    .index('by_publicId', ['publicId'])
    .index('by_achievedAt', ['achievedAt']),

  leaderboardBest: defineTable({
    github: v.string(),
    title: titleValidator,
    hiddenScore: v.number(),
    boardEfficiency: v.number(),
    achievedAt: v.number(),
    shiftId: v.id('shifts'),
    publicId: v.string(),
    connectedCalls: v.optional(v.number()),
    totalCalls: v.optional(v.number()),
    droppedCalls: v.optional(v.number()),
    avgHoldSeconds: v.optional(v.number())
  })
    .index('by_github', ['github'])
    .index('by_hiddenScore_and_boardEfficiency_and_achievedAt', [
      'hiddenScore',
      'boardEfficiency',
      'achievedAt'
    ]),

  leaderboardMeta: defineTable({
    totalEntries: v.number()
  }),

  contactSubmissions: defineTable({
    github: v.string(),
    name: v.string(),
    email: v.string(),
    reportPublicId: v.string(),
    submittedAt: v.number()
  })
    .index('by_github', ['github'])
    .index('by_reportPublicId', ['reportPublicId']),

  candidateSummaries: defineTable({
    github: v.string(),
    summary: v.string(),
    generatedAt: v.number()
  }).index('by_github', ['github'])
})
