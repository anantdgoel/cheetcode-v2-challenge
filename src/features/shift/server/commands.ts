import type { GoLiveCommand, GoLiveResult, RunProbeCommand, RunProbeResult, SaveDraftCommand, ValidateDraftCommand, ValidateDraftResult } from '@/features/shift/domain/contracts'
import { validateDraftSource } from '@/core/domain/draft-source'
import { buildStarterPolicy } from '@/core/engine/artifacts'
import { asShiftId, fetchInternalAction, fetchInternalMutation, internal } from '@/server/convex/client'
import { canEditShift, PHASE_1_MS, SHIFT_MS } from '../domain/lifecycle'
import { normalizeShiftServiceError, ShiftServiceError } from '../domain/errors'
import { ensureResolvedShift } from './resolver'
import { getOwnedShiftForGithub } from './queries'

type StartShiftRecordResult =
  | {
    activeShiftId: string;
    kind: 'active_shift_exists';
  }
  | {
    kind: 'started';
    shift: { id: string };
  }

async function validatePolicySource (source: string) {
  const { validatePolicy } = await import('@/core/engine')
  return validatePolicy(source)
}

export async function startShiftForGithub (github: string) {
  const now = Date.now()
  const starterSource = buildStarterPolicy()
  const starterValidation = await validatePolicySource(starterSource)
  if (!starterValidation.ok) {
    throw new ShiftServiceError('starter_policy_invalid')
  }

  const result = await fetchInternalMutation(internal.sessions.start, {
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
    throw new ShiftServiceError('active_shift_exists', { activeShiftId: result.activeShiftId })
  }

  return getOwnedShiftForGithub(github, result.shift.id)
}

export async function saveDraftForGithub (params: SaveDraftCommand) {
  const shift = await ensureResolvedShift(params.github, params.shiftId)
  if (!shift || !canEditShift(shift, Date.now())) {
    throw new ShiftServiceError('shift_not_editable')
  }

  const draft = validateDraftSource(params.source)
  if (draft.ok === false) {
    throw new Error(draft.error)
  }

  try {
    await fetchInternalMutation(internal.sessions.saveDraft, {
      github: params.github,
      shiftId: asShiftId(params.shiftId),
      source: draft.value,
      savedAt: params.savedAt ?? Date.now()
    })
  } catch (error) {
    throw normalizeShiftServiceError(error) ?? error
  }

  return getOwnedShiftForGithub(params.github, params.shiftId)
}

export async function validateDraftForGithub (
  params: ValidateDraftCommand
): Promise<ValidateDraftResult> {
  const shift = await ensureResolvedShift(params.github, params.shiftId)
  if (!shift || !canEditShift(shift, Date.now())) {
    throw new ShiftServiceError('shift_not_editable')
  }

  const validation = await validatePolicySource(params.source)
  try {
    await fetchInternalMutation(internal.sessions.storeValidation, {
      github: params.github,
      shiftId: asShiftId(params.shiftId),
      source: validation.ok ? validation.normalizedSource : params.source.trim(),
      validation,
      checkedAt: Date.now()
    })
  } catch (error) {
    throw normalizeShiftServiceError(error) ?? error
  }

  return {
    validation,
    shift: await getOwnedShiftForGithub(params.github, params.shiftId)
  }
}

export async function runProbeForGithub (params: RunProbeCommand): Promise<RunProbeResult> {
  try {
    return await fetchInternalAction(internal.shiftRuntime.runProbe, {
      github: params.github,
      shiftId: asShiftId(params.shiftId)
    })
  } catch (error) {
    throw normalizeShiftServiceError(error) ?? error
  }
}

export async function goLiveForGithub (params: GoLiveCommand): Promise<GoLiveResult> {
  try {
    return await fetchInternalAction(internal.shiftRuntime.runFinal, {
      github: params.github,
      shiftId: asShiftId(params.shiftId)
    })
  } catch (error) {
    throw normalizeShiftServiceError(error) ?? error
  }
}
