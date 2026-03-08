import type { EvaluationRecordView, ShiftView } from '@/core/domain/views'
import type { StoredRunRecord, StoredShiftRecord } from './persistence'
import { getAcceptedRun, getCurrentPhase, getNextProbeKind, getViewStatus, PROBE_ORDER, toViewRunKind } from './lifecycle'

function shapeRun (run: StoredRunRecord): EvaluationRecordView {
  return {
    id: run.id,
    kind: toViewRunKind(run),
    state: run.state === 'processing' ? 'accepted' : run.state,
    acceptedAt: run.acceptedAt,
    sourceHash: run.sourceHash,
    sourceSnapshot: run.sourceSnapshot,
    ...(run.resolvedAt !== undefined ? { resolvedAt: run.resolvedAt } : {}),
    ...(run.probeSummary ? { probeSummary: run.probeSummary } : {}),
    ...(run.metrics ? { metrics: run.metrics } : {}),
    ...(run.title ? { title: run.title } : {}),
    ...(run.chiefOperatorNote ? { chiefOperatorNote: run.chiefOperatorNote } : {}),
    ...(run.reportPublicId ? { reportPublicId: run.reportPublicId } : {})
  }
}

export function shapeShiftView (shift: StoredShiftRecord, now: number): ShiftView {
  const probeEvaluations: EvaluationRecordView[] = []
  let finalEvaluation: EvaluationRecordView | undefined
  let probesUsed = 0
  let probeAcceptedAt: number | undefined
  let finalAcceptedAt: number | undefined

  for (const run of shift.runs) {
    const shapedRun = shapeRun(run)
    if (run.kind === 'final') {
      finalEvaluation = shapedRun
      finalAcceptedAt ??= run.acceptedAt
      continue
    }

    probeEvaluations.push(shapedRun)
    probeAcceptedAt ??= run.state !== 'completed' ? run.acceptedAt : undefined
    if (run.state === 'completed') {
      probesUsed += 1
    }
  }

  const acceptedRun = getAcceptedRun(shift.runs)
  const probeWindowOpen = shift.state === 'active' && now < shift.phase1EndsAt
  const nextProbeKind = probeWindowOpen ? getNextProbeKind(shift.runs) : undefined

  return {
    ...(shift.completedAt !== undefined ? { completedAt: shift.completedAt } : {}),
    ...(shift.latestValidSource ? { latestValidSource: shift.latestValidSource } : {}),
    ...(shift.latestValidAt !== undefined ? { latestValidAt: shift.latestValidAt } : {}),
    ...(shift.latestValidationError ? { latestValidationError: shift.latestValidationError } : {}),
    ...(shift.latestValidationCheckedAt !== undefined ? { latestValidationCheckedAt: shift.latestValidationCheckedAt } : {}),
    ...(probeAcceptedAt !== undefined ? { probeAcceptedAt } : {}),
    ...(finalAcceptedAt !== undefined ? { finalAcceptedAt } : {}),
    ...(shift.reportPublicId ? { reportPublicId: shift.reportPublicId } : {}),
    ...(finalEvaluation ? { finalEvaluation } : {}),
    ...(nextProbeKind ? { nextProbeKind } : {}),
    id: shift.id,
    github: shift.github,
    status: getViewStatus(shift, now),
    startedAt: shift.startedAt,
    phase1EndsAt: shift.phase1EndsAt,
    expiresAt: shift.expiresAt,
    artifactVersion: shift.artifactVersion,
    latestDraftSource: shift.latestDraftSource,
    latestDraftSavedAt: shift.latestDraftSavedAt,
    currentPhase: getCurrentPhase(shift, now),
    probesUsed,
    maxProbes: PROBE_ORDER.length,
    remainingProbes: Math.max(0, PROBE_ORDER.length - probesUsed),
    canGoLive:
      shift.state === 'active' &&
      now < shift.expiresAt &&
      !!shift.latestValidSource &&
      !acceptedRun &&
      !finalEvaluation,
    probeEvaluations
  }
}
