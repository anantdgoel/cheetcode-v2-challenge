import type { EvaluationRecordView, ShiftView } from "@/lib/contracts/views";
import type { StoredRunRecord, StoredShiftRecord } from "@/lib/data/types";
import { getAcceptedRun, getCurrentPhase, getNextProbeKind, getViewStatus, PROBE_ORDER, toViewRunKind } from "./shift-lifecycle";

function shapeRun(run: StoredRunRecord): EvaluationRecordView {
  return {
    id: run.id,
    kind: toViewRunKind(run),
    state: run.state,
    acceptedAt: run.acceptedAt,
    resolvedAt: run.resolvedAt,
    sourceHash: run.sourceHash,
    sourceSnapshot: run.sourceSnapshot,
    probeSummary: run.probeSummary,
    metrics: run.metrics,
    title: run.title,
    chiefOperatorNote: run.chiefOperatorNote,
    reportPublicId: run.reportPublicId,
  };
}

/** Map the stored shift record to the exact DTO shape consumed by the UI. */
export function shapeShiftView(shift: StoredShiftRecord, now: number): ShiftView {
  const probeEvaluations = shift.runs.filter((run) => run.kind !== "final").map(shapeRun);
  const finalEvaluation = shift.runs.filter((run) => run.kind === "final").map(shapeRun).at(-1);
  const probesUsed = probeEvaluations.filter((run) => run.state === "completed").length;
  const acceptedRun = getAcceptedRun(shift.runs);

  return {
    id: shift.id,
    github: shift.github,
    status: getViewStatus(shift, now),
    startedAt: shift.startedAt,
    phase1EndsAt: shift.phase1EndsAt,
    expiresAt: shift.expiresAt,
    completedAt: shift.completedAt,
    artifactVersion: shift.artifactVersion,
    latestDraftSource: shift.latestDraftSource,
    latestDraftSavedAt: shift.latestDraftSavedAt,
    latestValidSource: shift.latestValidSource,
    latestValidAt: shift.latestValidAt,
    latestValidationError: shift.latestValidationError,
    latestValidationCheckedAt: shift.latestValidationCheckedAt,
    probeAcceptedAt: shift.runs.find((run) => run.kind !== "final" && run.state === "accepted")?.acceptedAt,
    finalAcceptedAt: shift.runs.find((run) => run.kind === "final")?.acceptedAt,
    reportPublicId: shift.reportPublicId,
    currentPhase: getCurrentPhase(shift, now),
    probesUsed,
    maxProbes: PROBE_ORDER.length,
    remainingProbes: Math.max(0, PROBE_ORDER.length - probesUsed),
    nextProbeKind: getNextProbeKind(shift.runs),
    canGoLive:
      shift.state === "active" &&
      now < shift.expiresAt &&
      !!shift.latestValidSource &&
      !acceptedRun &&
      !finalEvaluation,
    probeEvaluations,
    finalEvaluation,
  };
}
