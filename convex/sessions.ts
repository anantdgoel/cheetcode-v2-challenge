import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { requireAuthenticatedGithub } from './lib/auth'
import { appError } from './lib/errors'
import { loadOwnedShift, loadShiftById, toClientShiftRecord, toShiftRecord, type ShiftDoc, type ShiftRunDoc } from './records'
import { buildArtifactContent } from '../src/core/engine/artifacts'
import { hasLiveActiveShift } from '../src/features/shift/domain/lifecycle'
import {
  clientShiftRecordValidator,
  finalReportValidator,
  policyValidationResultValidator,
  probeKindValidator,
  probeSummaryValidator,
  simulationMetricsValidator,
  storedRunKindValidator,
  storedRunTriggerValidator,
  titleValidator
} from './validators'

function artifactFieldName (name: 'manual.md' | 'starter.js' | 'lines.json' | 'observations.jsonl') {
  switch (name) {
    case 'manual.md':
      return 'manualMd'
    case 'starter.js':
      return 'starterJs'
    case 'lines.json':
      return 'linesJson'
    case 'observations.jsonl':
      return 'observationsJsonl'
  }
}

const STUCK_RUN_TIMEOUT_MS = 60_000

function getAcceptedRun (shift: Pick<ShiftDoc, 'runs'>) {
  return shift.runs.find((run) => {
    if (run.state !== 'accepted' && run.state !== 'processing') return false
    if (run.acceptedAt && Date.now() - run.acceptedAt > STUCK_RUN_TIMEOUT_MS) return false
    return true
  })
}

function getRunById (shift: Pick<ShiftDoc, 'runs'>, runId: string) {
  return shift.runs.find((run) => run.id === runId)
}

function mapRuns (
  shift: Pick<ShiftDoc, '_id' | 'runs'>,
  runId: string,
  update: (run: ShiftRunDoc) => ShiftRunDoc
) {
  const run = getRunById(shift, runId)
  if (!run) return null

  return {
    run,
    runs: shift.runs.map((candidate: ShiftRunDoc) =>
      candidate.id === runId ? update(candidate) : candidate
    )
  }
}

function hasFinalRun (shift: Pick<ShiftDoc, 'runs'>) {
  return shift.runs.some((run) => run.kind === 'final')
}

function ensureOwnedShift (shift: ShiftDoc | null, github: string) {
  if (!shift || shift.github !== github) {
    throw appError('shift_not_found')
  }
  return shift
}

function ensureEditableShift (shift: ShiftDoc) {
  if (shift.state !== 'active' || Date.now() >= shift.expiresAt || getAcceptedRun(shift)) {
    throw new Error('shift is no longer editable')
  }
}

export const getCurrentOwned = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('shifts')
      .withIndex('by_github_and_startedAt', (query) => query.eq('github', args.github))
      .order('desc')
      .first()
    return toShiftRecord(doc)
  }
})

export const getOwnedShift = internalQuery({
  args: { github: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, args) => {
    return toShiftRecord(await loadOwnedShift(ctx.db, args.github, args.shiftId))
  }
})

export const start = internalMutation({
  args: {
    github: v.string(),
    seed: v.string(),
    artifactVersion: v.number(),
    starterSource: v.string(),
    starterValidation: v.object({
      ok: v.literal(true),
      normalizedSource: v.string(),
      sourceHash: v.string()
    }),
    now: v.number(),
    phase1EndsAt: v.number(),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query('shifts')
      .withIndex('by_github_and_startedAt', (query) => query.eq('github', args.github))
      .order('desc')
      .first()

    if (latest && hasLiveActiveShift(latest, args.now)) {
      return {
        activeShiftId: latest._id,
        kind: 'active_shift_exists' as const
      }
    }

    const shiftId = await ctx.db.insert('shifts', {
      github: args.github,
      seed: args.seed,
      artifactVersion: args.artifactVersion,
      state: 'active',
      startedAt: args.now,
      phase1EndsAt: args.phase1EndsAt,
      expiresAt: args.expiresAt,
      latestDraftSource: args.starterSource,
      latestDraftSavedAt: args.now,
      latestValidSource: args.starterValidation.normalizedSource,
      latestValidSourceHash: args.starterValidation.sourceHash,
      latestValidAt: args.now,
      latestValidationCheckedAt: args.now,
      artifactFetchAt: {},
      runs: [],
      reportPublicId: undefined
    })

    return {
      kind: 'started' as const,
      shift: toShiftRecord(await loadShiftById(ctx.db, shiftId))
    }
  }
})

export const saveDraft = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    source: v.string(),
    savedAt: v.number()
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github)
    ensureEditableShift(shift)
    await ctx.db.patch('shifts', shift._id, {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.savedAt
    })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const storeValidation = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    source: v.string(),
    validation: policyValidationResultValidator,
    checkedAt: v.number()
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github)
    ensureEditableShift(shift)
    const patch: Partial<ShiftDoc> = {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.checkedAt,
      latestValidationCheckedAt: args.checkedAt
    }
    if (args.validation.ok) {
      patch.latestValidSource = args.validation.normalizedSource
      patch.latestValidSourceHash = args.validation.sourceHash
      patch.latestValidAt = args.checkedAt
      patch.latestValidationError = undefined
    } else if ('error' in args.validation) {
      patch.latestValidationError = args.validation.error
    }
    await ctx.db.patch('shifts', shift._id, patch)
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const recordArtifactFetch = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    name: v.union(
      v.literal('manual.md'),
      v.literal('starter.js'),
      v.literal('lines.json'),
      v.literal('observations.jsonl')
    ),
    at: v.number()
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github)
    if (shift.state !== 'active') {
      throw new Error('shift not found')
    }
    await ctx.db.patch('shifts', shift._id, {
      artifactFetchAt: {
        ...shift.artifactFetchAt,
        [artifactFieldName(args.name)]: shift.artifactFetchAt?.[artifactFieldName(args.name)] ?? args.at
      }
    })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const acceptRun = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    run: v.object({
      id: v.string(),
      kind: storedRunKindValidator,
      trigger: storedRunTriggerValidator,
      acceptedAt: v.number(),
      sourceHash: v.string(),
      sourceSnapshot: v.string()
    })
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github)
    if (shift.state !== 'active') {
      throw new Error('shift expired')
    }
    if (args.run.trigger === 'manual' && Date.now() >= shift.expiresAt) {
      throw new Error('shift expired')
    }
    if (args.run.kind !== 'final' && Date.now() >= shift.phase1EndsAt) {
      throw new Error('trial window closed')
    }
    if (getAcceptedRun(shift)) {
      throw new Error('evaluation already in progress')
    }
    if (args.run.kind === 'final' && hasFinalRun(shift)) {
      throw new Error('final evaluation unavailable')
    }
    if (args.run.kind !== 'final' && shift.runs.some((run) => run.kind === args.run.kind)) {
      throw new Error('probe already submitted')
    }
    const nextRuns = [
      ...shift.runs.filter((existingRun) => existingRun.id !== args.run.id),
      {
        ...args.run,
        state: 'accepted' as const
      }
    ]
    await ctx.db.patch('shifts', shift._id, { runs: nextRuns })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const completeProbeRun = internalMutation({
  args: {
    shiftId: v.id('shifts'),
    runId: v.string(),
    summary: probeSummaryValidator,
    resolvedAt: v.number()
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId)
    if (!shift) {
      throw new Error('shift not found')
    }
    const next = mapRuns(shift, args.runId, (candidate) => ({
      ...candidate,
      state: 'completed' as const,
      resolvedAt: args.resolvedAt,
      probeSummary: args.summary
    }))
    if (!next || next.run.kind === 'final') {
      throw new Error('accepted probe run not found')
    }
    if (next.run.state === 'completed') {
      return toShiftRecord(shift)
    }
    if (next.run.state !== 'accepted' && next.run.state !== 'processing') {
      throw new Error('accepted probe run not found')
    }

    await ctx.db.patch('shifts', shift._id, { runs: next.runs })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const claimRunForProcessing = internalMutation({
  args: {
    shiftId: v.id('shifts'),
    runId: v.string()
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId)
    if (!shift) {
      throw new Error('shift not found')
    }

    const next = mapRuns(shift, args.runId, (candidate) => ({
      ...candidate,
      state: 'processing' as const
    }))
    if (!next) {
      return {
        kind: 'missing' as const,
        shift: toShiftRecord(shift)
      }
    }
    if (next.run.state === 'completed') {
      return {
        kind: 'completed' as const,
        shift: toShiftRecord(shift)
      }
    }
    if (next.run.state === 'processing') {
      return {
        kind: 'busy' as const,
        shift: toShiftRecord(shift)
      }
    }

    await ctx.db.patch('shifts', shift._id, { runs: next.runs })
    return {
      kind: 'claimed' as const,
      shift: toShiftRecord(await loadShiftById(ctx.db, shift._id))
    }
  }
})

export const completeFinalRun = internalMutation({
  args: {
    shiftId: v.id('shifts'),
    runId: v.string(),
    reportPublicId: v.string(),
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    resolvedAt: v.number()
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId)
    if (!shift) {
      throw new Error('shift not found')
    }
    const next = mapRuns(shift, args.runId, (candidate) => ({
      ...candidate,
      state: 'completed' as const,
      resolvedAt: args.resolvedAt,
      reportPublicId: args.reportPublicId,
      title: args.title,
      metrics: args.metrics,
      chiefOperatorNote: args.chiefOperatorNote
    }))
    if (!next || next.run.kind !== 'final') {
      throw new Error('accepted final run not found')
    }
    if (next.run.state === 'completed') {
      return toShiftRecord(shift)
    }
    if (next.run.state !== 'accepted' && next.run.state !== 'processing') {
      throw new Error('accepted final run not found')
    }

    await ctx.db.patch('shifts', shift._id, {
      runs: next.runs,
      state: 'completed',
      completedAt: args.resolvedAt,
      reportPublicId: args.reportPublicId
    })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

/**
 * Atomic mutation that completes a final run and writes report + leaderboard
 * in a single transaction. Replaces the 3-mutation sequence in finishFinalRun.
 */
export const completeFinalRunWithReport = internalMutation({
  args: {
    shiftId: v.id('shifts'),
    runId: v.string(),
    report: finalReportValidator,
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    resolvedAt: v.number()
  },
  handler: async (ctx, args) => {
    const existingReport = await ctx.db
      .query('reports')
      .withIndex('by_publicId', (q) => q.eq('publicId', args.report.publicId))
      .unique()
    if (existingReport) {
      await ctx.db.patch('reports', existingReport._id, args.report)
    } else {
      await ctx.db.insert('reports', args.report)
    }

    const shift = await loadShiftById(ctx.db, args.shiftId)
    if (!shift) throw new Error('shift not found')
    const next = mapRuns(shift, args.runId, (candidate) => ({
      ...candidate,
      state: 'completed' as const,
      resolvedAt: args.resolvedAt,
      reportPublicId: args.report.publicId,
      title: args.title,
      metrics: args.metrics,
      chiefOperatorNote: args.chiefOperatorNote
    }))
    if (!next || next.run.kind !== 'final') {
      throw new Error('accepted final run not found')
    }
    if (next.run.state !== 'accepted' && next.run.state !== 'processing') {
      if (next.run.state === 'completed') {
        return toShiftRecord(shift)
      }
      throw new Error('accepted final run not found')
    }
    await ctx.db.patch('shifts', shift._id, {
      runs: next.runs,
      state: 'completed',
      completedAt: args.resolvedAt,
      reportPublicId: args.report.publicId
    })

    const existingEntry = await ctx.db
      .query('leaderboardBest')
      .withIndex('by_github', (q) => q.eq('github', args.report.github))
      .unique()
    const candidate = {
      hiddenScore: args.report.hiddenScore,
      boardEfficiency: args.report.boardEfficiency,
      achievedAt: args.report.achievedAt
    }
    const isBetter = !existingEntry ||
      (candidate.hiddenScore !== existingEntry.hiddenScore
        ? candidate.hiddenScore > existingEntry.hiddenScore
        : candidate.boardEfficiency !== existingEntry.boardEfficiency
          ? candidate.boardEfficiency > existingEntry.boardEfficiency
          : candidate.achievedAt < existingEntry.achievedAt)

    if (isBetter) {
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
      if (existingEntry) {
        await ctx.db.patch('leaderboardBest', existingEntry._id, entry)
      } else {
        await ctx.db.insert('leaderboardBest', entry)
        const counter = await ctx.db.query('leaderboardMeta').first()
        if (counter) {
          await ctx.db.patch('leaderboardMeta', counter._id, { totalEntries: counter.totalEntries + 1 })
        } else {
          await ctx.db.insert('leaderboardMeta', { totalEntries: 1 })
        }
      }
    }

    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const markExpiredNoResult = internalMutation({
  args: {
    shiftId: v.id('shifts'),
    completedAt: v.number()
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId)
    if (!shift) {
      throw new Error('shift not found')
    }
    if (shift.state !== 'active' || hasFinalRun(shift) || getAcceptedRun(shift)) {
      return toShiftRecord(shift)
    }
    await ctx.db.patch('shifts', shift._id, {
      state: 'expired',
      completedAt: args.completedAt
    })
    return toShiftRecord(await loadShiftById(ctx.db, shift._id))
  }
})

export const getMyCurrentShift = query({
  args: {},
  returns: v.union(clientShiftRecordValidator, v.null()),
  handler: async (ctx) => {
    const github = await requireAuthenticatedGithub(ctx)
    const doc = await ctx.db
      .query('shifts')
      .withIndex('by_github_and_startedAt', (q) => q.eq('github', github))
      .order('desc')
      .first()
    return toClientShiftRecord(doc)
  }
})

export const getMyShift = query({
  args: { shiftId: v.id('shifts') },
  returns: v.union(clientShiftRecordValidator, v.null()),
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    return toClientShiftRecord(await loadOwnedShift(ctx.db, github, args.shiftId))
  }
})

export const getArtifactContent = query({
  args: {
    shiftId: v.id('shifts'),
    name: v.union(
      v.literal('manual.md'),
      v.literal('starter.js'),
      v.literal('lines.json'),
      v.literal('observations.jsonl')
    )
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const shift = await loadOwnedShift(ctx.db, github, args.shiftId)
    if (!shift || shift.state !== 'active') return null
    return buildArtifactContent(args.name, shift.seed)
  }
})

export const requestProbe = mutation({
  args: { shiftId: v.id('shifts') },
  returns: v.object({ runId: v.string(), probeKind: probeKindValidator }),
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const shift = ensureOwnedShift(
      await ctx.db.get('shifts', args.shiftId),
      github
    )
    const now = Date.now()
    if (shift.state !== 'active' || now >= shift.expiresAt) {
      throw appError('shift_expired')
    }
    if (now >= shift.phase1EndsAt) {
      throw appError('trial_window_closed')
    }
    if (getAcceptedRun(shift)) {
      throw appError('evaluation_in_progress')
    }
    if (!shift.latestValidSource || !shift.latestValidSourceHash) {
      throw appError('valid_module_required')
    }

    const PROBE_ORDER = ['fit', 'stress'] as const
    const nextProbeKind = PROBE_ORDER.find(
      (kind) => !shift.runs.some((run: ShiftRunDoc) => run.kind === kind && run.state === 'completed')
    )
    if (!nextProbeKind) {
      throw appError('all_probes_exhausted')
    }

    const runId = crypto.randomUUID()
    const nextRuns = [
      ...shift.runs,
      {
        id: runId,
        kind: nextProbeKind,
        trigger: 'manual' as const,
        state: 'accepted' as const,
        acceptedAt: now,
        sourceHash: shift.latestValidSourceHash,
        sourceSnapshot: shift.latestValidSource
      }
    ]
    await ctx.db.patch('shifts', shift._id, { runs: nextRuns })

    await ctx.scheduler.runAfter(0, internal.shiftRuntime.processProbeRun, {
      github,
      shiftId: args.shiftId,
      runId
    })

    return { runId, probeKind: nextProbeKind }
  }
})

export const requestGoLive = mutation({
  args: { shiftId: v.id('shifts') },
  returns: v.object({ runId: v.string() }),
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const shift = ensureOwnedShift(
      await ctx.db.get('shifts', args.shiftId),
      github
    )
    if (shift.state !== 'active') {
      throw appError('shift_expired')
    }
    if (getAcceptedRun(shift)) {
      throw appError('evaluation_in_progress')
    }
    if (hasFinalRun(shift)) {
      throw appError('final_evaluation_unavailable')
    }
    if (!shift.latestValidSource || !shift.latestValidSourceHash) {
      throw appError('valid_module_required')
    }

    const runId = crypto.randomUUID()
    const now = Date.now()
    const nextRuns = [
      ...shift.runs,
      {
        id: runId,
        kind: 'final' as const,
        trigger: 'manual' as const,
        state: 'accepted' as const,
        acceptedAt: now,
        sourceHash: shift.latestValidSourceHash,
        sourceSnapshot: shift.latestValidSource
      }
    ]
    await ctx.db.patch('shifts', shift._id, { runs: nextRuns })

    await ctx.scheduler.runAfter(0, internal.shiftRuntime.processFinalRun, {
      github,
      shiftId: args.shiftId,
      runId
    })

    return { runId }
  }
})

export const resolveShiftExpiry = mutation({
  args: { shiftId: v.id('shifts') },
  returns: v.union(
    v.literal('noop'),
    v.literal('scheduled_final'),
    v.literal('expired_no_result')
  ),
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const shift = ensureOwnedShift(
      await ctx.db.get('shifts', args.shiftId),
      github
    )
    const now = Date.now()

    if (shift.state !== 'active' || now < shift.expiresAt) {
      return 'noop'
    }
    if (getAcceptedRun(shift) || hasFinalRun(shift)) {
      return 'noop'
    }

    if (shift.latestValidSource && shift.latestValidSourceHash) {
      const runId = crypto.randomUUID()
      const nextRuns = [
        ...shift.runs,
        {
          id: runId,
          kind: 'final' as const,
          trigger: 'auto_expire' as const,
          state: 'accepted' as const,
          acceptedAt: shift.expiresAt,
          sourceHash: shift.latestValidSourceHash,
          sourceSnapshot: shift.latestValidSource
        }
      ]
      await ctx.db.patch('shifts', shift._id, { runs: nextRuns })

      await ctx.scheduler.runAfter(0, internal.shiftRuntime.processFinalRun, {
        github,
        shiftId: args.shiftId,
        runId
      })

      return 'scheduled_final'
    }

    await ctx.db.patch('shifts', shift._id, {
      state: 'expired',
      completedAt: shift.expiresAt
    })
    return 'expired_no_result'
  }
})
