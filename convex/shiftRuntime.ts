'use node'

import { v } from 'convex/values'
import { type Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { type ActionCtx, internalAction } from './_generated/server'
import type { ProbeKind } from '../src/core/domain/game'
import { createBoard } from '../src/core/engine/board-generation'
import { stableHash } from '../src/core/engine/shared'
import type { StoredRunRecord, StoredShiftRecord } from '../src/features/shift/domain/persistence'

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

function isProbeRun (run: StoredRunRecord): run is StoredRunRecord & { kind: ProbeKind } {
  return run.kind !== 'final'
}

async function finishProbeRun (
  ctx: ActionCtx,
  shiftId: Id<'shifts'>,
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
    shiftId,
    runId: run.id,
    summary,
    resolvedAt: Date.now()
  })
}

async function finishFinalRun (
  ctx: ActionCtx,
  shiftId: Id<'shifts'>,
  shift: StoredShiftRecord,
  run: StoredRunRecord
) {
  const {
    buildFinalReport,
    runFinal: executeFinalRun
  } = await import('../src/core/engine/policy-vm')
  const board = createBoard(shift.seed)
  const result = await executeFinalRun({
    board,
    source: run.sourceSnapshot
  })
  const achievedAt = Date.now()
  const report = buildFinalReport({
    shiftId,
    github: shift.github,
    publicId: reportPublicIdForRun(shiftId, run.id),
    achievedAt,
    kind: run.trigger === 'auto_expire' ? 'auto_final' : 'final',
    metrics: result.metrics,
    seed: shift.seed
  })

  // Atomic: report + session + leaderboard in one transaction
  await ctx.runMutation(internal.sessions.completeFinalRunWithReport, {
    shiftId,
    runId: run.id,
    report: { ...report, shiftId },
    title: report.title,
    metrics: result.metrics,
    chiefOperatorNote: report.chiefOperatorNote,
    resolvedAt: achievedAt
  })
}

export const processProbeRun = internalAction({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    runId: v.string()
  },
  handler: async (ctx, args) => {
    // ctx.runMutation returns `any` in action context
    const claim = await ctx.runMutation(internal.sessions.claimRunForProcessing, {
      shiftId: args.shiftId,
      runId: args.runId
    }) as ClaimRunForProcessingResult

    if (claim.kind !== 'claimed' || !claim.shift) return

    const run = claim.shift.runs.find((r) => r.id === args.runId)
    if (!run) return
    if (!isProbeRun(run)) return

    await finishProbeRun(ctx, args.shiftId, claim.shift, run)
  }
})

export const processFinalRun = internalAction({
  args: {
    github: v.string(),
    shiftId: v.id('shifts'),
    runId: v.string()
  },
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sessions.claimRunForProcessing, {
      shiftId: args.shiftId,
      runId: args.runId
    }) as ClaimRunForProcessingResult

    if (claim.kind !== 'claimed' || !claim.shift) return

    const run = claim.shift.runs.find((r) => r.id === args.runId)
    if (!run || run.kind !== 'final') return

    await finishFinalRun(ctx, args.shiftId, claim.shift, run)
  }
})
