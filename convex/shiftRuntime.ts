'use node'

import { v } from 'convex/values'
import { type Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { type ActionCtx, internalAction } from './_generated/server'
import type { RunProbeResult, GoLiveResult } from '../src/core/domain/commands'
import type { ProbeKind } from '../src/core/domain/game'
import { createBoard } from '../src/core/engine/board-generation'
import { stableHash } from '../src/core/engine/shared'
import type { StoredRunRecord, StoredShiftRecord } from '../src/features/shift/domain/persistence'
import { PROBE_ORDER, shouldAutoFinalize, shouldExpireWithoutResult } from '../src/features/shift/domain/lifecycle'
import { shapeShiftView } from '../src/features/shift/domain/view'

const RESOLUTION_POLL_ATTEMPTS = 20
const RESOLUTION_POLL_DELAY_MS = 10

type ClaimRunForProcessingResult =
  | {
    kind: 'busy' | 'completed' | 'missing';
    shift: StoredShiftRecord | null;
  }
  | {
    kind: 'claimed';
    shift: StoredShiftRecord;
  }

function reportPublicIdForRun (shiftId: string, runId: string) {
  return stableHash(`${shiftId}:${runId}`).slice(0, 16)
}

function createRunId () {
  return crypto.randomUUID()
}

function requireValidSource (shift: StoredShiftRecord) {
  if (!shift.latestValidSource || !shift.latestValidSourceHash) {
    throw new Error('valid module required')
  }

  return {
    source: shift.latestValidSource,
    sourceHash: shift.latestValidSourceHash
  }
}

async function loadOwnedShift (
  ctx: ActionCtx,
  github: string,
  shiftId: Id<'shifts'>
) {
  return ctx.runQuery(internal.sessions.getOwnedShift, {
    github,
    shiftId
  })
}

async function finishProbeRun (
  ctx: ActionCtx,
  shift: StoredShiftRecord,
  run: StoredRunRecord & { kind: ProbeKind }
) {
  const { runProbe: executeProbeRun } = await import('../src/core/engine/policy-vm')
  const board = createBoard(shift.seed)
  const { summary } = await executeProbeRun({
    board,
    source: run.sourceSnapshot,
    probeKind: run.kind
  })

  await ctx.runMutation(internal.sessions.completeProbeRun, {
    shiftId: runShiftId(shift),
    runId: run.id,
    summary,
    resolvedAt: Date.now()
  })
}

async function finishFinalRun (
  ctx: ActionCtx,
  shift: StoredShiftRecord,
  run: StoredRunRecord
) {
  const {
    buildFinalReport,
    runFinal: executeFinalRun
  } = await import('../src/core/engine/policy-vm')
  const shiftId = runShiftId(shift)
  const board = createBoard(shift.seed)
  const result = await executeFinalRun({
    board,
    source: run.sourceSnapshot
  })
  const achievedAt = Date.now()
  const report = buildFinalReport({
    shiftId: shift.id,
    github: shift.github,
    publicId: reportPublicIdForRun(shift.id, run.id),
    achievedAt,
    kind: run.trigger === 'auto_expire' ? 'auto_final' : 'final',
    metrics: result.metrics,
    seed: shift.seed
  })
  const persistedReport = {
    ...report,
    shiftId
  }

  await ctx.runMutation(internal.reports.upsertReport, {
    report: persistedReport
  })
  await ctx.runMutation(internal.sessions.completeFinalRun, {
    shiftId,
    runId: run.id,
    reportPublicId: report.publicId,
    title: report.title,
    metrics: result.metrics,
    chiefOperatorNote: report.chiefOperatorNote,
    resolvedAt: achievedAt
  })
  await ctx.runMutation(internal.leaderboard.maybeUpsertFromReport, {
    report: persistedReport
  })
}

function runShiftId (shift: StoredShiftRecord) {
  return shift.id as Id<'shifts'>
}

function getAcceptedRun (shift: StoredShiftRecord) {
  return shift.runs.find((run) => run.state === 'accepted')
}

function hasProcessingRun (shift: StoredShiftRecord) {
  return shift.runs.some((run) => run.state === 'processing')
}

function hasInFlightRun (shift: StoredShiftRecord) {
  return shift.runs.some((run) => run.state === 'accepted' || run.state === 'processing')
}

async function pauseForConcurrentResolver () {
  await new Promise((resolve) => setTimeout(resolve, RESOLUTION_POLL_DELAY_MS))
}

async function acceptRunAndResolve (params: {
  ctx: ActionCtx;
  github: string;
  shiftId: Id<'shifts'>;
  run: {
    id: string;
    kind: StoredRunRecord['kind'];
    trigger: StoredRunRecord['trigger'];
    acceptedAt: number;
    sourceHash: string;
    sourceSnapshot: string;
  };
}) {
  await params.ctx.runMutation(internal.sessions.acceptRun, {
    github: params.github,
    shiftId: params.shiftId,
    run: params.run
  })

  return resolveOwnedShiftRecord(params.ctx, params.github, params.shiftId)
}

export async function resolveOwnedShiftRecord (
  ctx: ActionCtx,
  github: string,
  shiftId: Id<'shifts'>
): Promise<StoredShiftRecord | null> {
  let shift = await loadOwnedShift(ctx, github, shiftId)

  for (let attempt = 0; shift && attempt < RESOLUTION_POLL_ATTEMPTS; attempt += 1) {
    const acceptedRun = getAcceptedRun(shift)
    if (acceptedRun) {
      const claim = await ctx.runMutation(internal.sessions.claimRunForProcessing, {
        shiftId,
        runId: acceptedRun.id
      }) as ClaimRunForProcessingResult

      if (claim.kind === 'claimed') {
        const claimedShift = claim.shift
        const claimedRun = claimedShift?.runs.find((run) => run.id === acceptedRun.id)
        if (!claimedShift || !claimedRun || claimedRun.state !== 'processing') {
          throw new Error('shift resolution claim lost')
        }

        if (claimedRun.kind === 'final') {
          await finishFinalRun(ctx, claimedShift, claimedRun)
        } else {
          await finishProbeRun(ctx, claimedShift, claimedRun as StoredRunRecord & { kind: ProbeKind })
        }
      } else {
        await pauseForConcurrentResolver()
      }

      shift = await loadOwnedShift(ctx, github, shiftId)
      continue
    }

    if (hasProcessingRun(shift)) {
      await pauseForConcurrentResolver()
      shift = await loadOwnedShift(ctx, github, shiftId)
      continue
    }

    const now = Date.now()
    if (shouldAutoFinalize(shift, now) && shift.latestValidSource && shift.latestValidSourceHash) {
      await ctx.runMutation(internal.sessions.acceptRun, {
        github,
        shiftId,
        run: {
          id: createRunId(),
          kind: 'final',
          trigger: 'auto_expire',
          acceptedAt: shift.expiresAt,
          sourceHash: shift.latestValidSourceHash,
          sourceSnapshot: shift.latestValidSource
        }
      })
      shift = await loadOwnedShift(ctx, github, shiftId)
      continue
    }

    if (shouldExpireWithoutResult(shift, now)) {
      await ctx.runMutation(internal.sessions.markExpiredNoResult, {
        shiftId,
        completedAt: shift.expiresAt
      })
      shift = await loadOwnedShift(ctx, github, shiftId)
      continue
    }

    return shift
  }

  if (shift) {
    if (hasProcessingRun(shift)) {
      return shift
    }
    throw new Error('shift resolution did not converge')
  }

  return null
}

export const runProbe = internalAction({
  args: {
    github: v.string(),
    shiftId: v.id('shifts')
  },
  handler: async (ctx, args): Promise<RunProbeResult> => {
    const shift = await resolveOwnedShiftRecord(ctx, args.github, args.shiftId)
    const now = Date.now()

    if (!shift) {
      throw new Error('shift not found')
    }
    if (shift.state !== 'active' || now >= shift.expiresAt) {
      throw new Error('shift expired')
    }
    if (now >= shift.phase1EndsAt) {
      throw new Error('trial window closed')
    }
    if (hasInFlightRun(shift)) {
      throw new Error('evaluation already in progress')
    }

    const nextProbeKind = PROBE_ORDER.find(
      (kind) => !shift.runs.some((run) => run.kind === kind && run.state === 'completed')
    )
    if (!nextProbeKind) {
      throw new Error('all probes exhausted')
    }

    const { source, sourceHash } = requireValidSource(shift)
    const runId = createRunId()
    const resolved = await acceptRunAndResolve({
      ctx,
      github: args.github,
      shiftId: args.shiftId,
      run: {
        id: runId,
        kind: nextProbeKind,
        trigger: 'manual',
        acceptedAt: now,
        sourceHash,
        sourceSnapshot: source
      }
    })
    if (!resolved) {
      throw new Error('probe summary unavailable')
    }

    const completedProbe = resolved.runs.find((run) => run.id === runId && run.probeSummary)
    if (!completedProbe?.probeSummary) {
      throw new Error('probe summary unavailable')
    }

    return {
      probeKind: nextProbeKind,
      summary: completedProbe.probeSummary,
      shift: shapeShiftView(resolved, Date.now())
    }
  }
})

export const runFinal = internalAction({
  args: {
    github: v.string(),
    shiftId: v.id('shifts')
  },
  handler: async (ctx, args): Promise<GoLiveResult> => {
    const shift = await resolveOwnedShiftRecord(ctx, args.github, args.shiftId)
    if (!shift) {
      throw new Error('shift not found')
    }
    if (hasInFlightRun(shift)) {
      throw new Error('evaluation already in progress')
    }
    if (shift.runs.some((run) => run.kind === 'final')) {
      const resolved = await resolveOwnedShiftRecord(ctx, args.github, args.shiftId)
      if (!resolved) {
        throw new Error('final evaluation unavailable')
      }
      return { shift: shapeShiftView(resolved, Date.now()) }
    }

    const { source, sourceHash } = requireValidSource(shift)
    const resolved = await acceptRunAndResolve({
      ctx,
      github: args.github,
      shiftId: args.shiftId,
      run: {
        id: createRunId(),
        kind: 'final',
        trigger: 'manual',
        acceptedAt: Date.now(),
        sourceHash,
        sourceSnapshot: source
      }
    })
    if (!resolved || !resolved.runs.some((run) => run.kind === 'final' && run.state === 'completed')) {
      throw new Error('final evaluation unavailable')
    }

    return {
      shift: shapeShiftView(resolved, Date.now())
    }
  }
})
