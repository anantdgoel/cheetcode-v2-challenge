'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { requireAuthenticatedGithub } from './lib/auth'
import { appError } from './lib/errors'
import type { StoredShiftRecord } from '../src/features/shift/domain/persistence'
import { PHASE_1_MS, SHIFT_MS } from '../src/features/shift/domain/lifecycle'
import { shapeShiftView } from '../src/features/shift/domain/view'
import { validateDraftSource } from '../src/core/domain/draft-source'

type StartShiftRecordResult =
  | { activeShiftId: string; kind: 'active_shift_exists' }
  | { kind: 'started'; shift: StoredShiftRecord }

export const startShift = action({
  args: {},
  handler: async (ctx) => {
    const github = await requireAuthenticatedGithub(ctx)
    const now = Date.now()

    const { buildStarterPolicy } = await import('../src/core/engine/artifacts')
    const { validatePolicy } = await import('../src/core/engine/policy-vm')

    const starterSource = buildStarterPolicy()
    const starterValidation = await validatePolicy(starterSource)
    if (!starterValidation.ok) {
      throw appError('starter_policy_invalid')
    }

    // ctx.runMutation returns any in action context; type mirrors sessions.start
    const result = await ctx.runMutation(internal.sessions.start, {
      github,
      seed: crypto.randomUUID(),
      artifactVersion: 1,
      starterSource,
      starterValidation,
      now,
      phase1EndsAt: now + PHASE_1_MS,
      expiresAt: now + SHIFT_MS
    }) as StartShiftRecordResult

    if (result.kind === 'active_shift_exists') {
      return { kind: 'active_shift_exists' as const, activeShiftId: result.activeShiftId }
    }

    const shift = shapeShiftView(result.shift, Date.now())
    return { kind: 'started' as const, shift }
  }
})

export const saveDraft = action({
  args: {
    shiftId: v.id('shifts'),
    source: v.string()
  },
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const draft = validateDraftSource(args.source)
    if (draft.ok === false) {
      throw new Error(draft.error)
    }

    const result = await ctx.runMutation(internal.sessions.saveDraft, {
      github,
      shiftId: args.shiftId,
      source: draft.value,
      savedAt: Date.now()
    }) as StoredShiftRecord | null

    return result ? shapeShiftView(result, Date.now()) : null
  }
})

export const validateDraft = action({
  args: {
    shiftId: v.id('shifts'),
    source: v.string()
  },
  handler: async (ctx, args) => {
    const github = await requireAuthenticatedGithub(ctx)
    const { validatePolicy } = await import('../src/core/engine/policy-vm')

    const validation = await validatePolicy(args.source)
    const result = await ctx.runMutation(internal.sessions.storeValidation, {
      github,
      shiftId: args.shiftId,
      source: validation.ok ? validation.normalizedSource : args.source.trim(),
      validation,
      checkedAt: Date.now()
    }) as StoredShiftRecord | null

    return {
      validation,
      shift: result ? shapeShiftView(result, Date.now()) : null
    }
  }
})
