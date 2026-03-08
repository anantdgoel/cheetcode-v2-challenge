import {
  PROBE_CHIEF_OPERATOR_NOTE_COUNT,
  PROBE_COUNTERFACTUAL_NOTE_COUNT,
  PROBE_RECOMMENDED_QUESTION_COUNT,
  type ProbeSummary
} from '../src/lib/domain/game'
import type { StoredShiftRecord } from '../src/lib/repositories/records'
import type { Doc, Id } from './_generated/dataModel'
import type { DatabaseReader } from './_generated/server'

export type ShiftDoc = Doc<'shifts'>;
export type ShiftRunDoc = ShiftDoc['runs'][number];
export type ShiftId = Id<'shifts'>;

function expectExactLength<T> (value: T[], expected: number, field: string): T[] {
  if (value.length !== expected) {
    throw new Error(`invalid persisted probe summary: expected ${field} to have length ${expected}, received ${value.length}`)
  }
  return value
}

function normalizeProbeSummary (summary: ShiftRunDoc['probeSummary'] | undefined): ProbeSummary | undefined {
  if (!summary) return undefined
  const recommendedQuestions = expectExactLength(
    summary.recommendedQuestions,
    PROBE_RECOMMENDED_QUESTION_COUNT,
    'recommendedQuestions'
  )
  const chiefOperatorNotes = expectExactLength(
    summary.chiefOperatorNotes,
    PROBE_CHIEF_OPERATOR_NOTE_COUNT,
    'chiefOperatorNotes'
  )
  const counterfactualNotes = expectExactLength(
    summary.counterfactualNotes,
    PROBE_COUNTERFACTUAL_NOTE_COUNT,
    'counterfactualNotes'
  )
  const normalizedQuestions: ProbeSummary['recommendedQuestions'] = [recommendedQuestions[0], recommendedQuestions[1]]
  const normalizedChiefNotes: ProbeSummary['chiefOperatorNotes'] = [
    chiefOperatorNotes[0],
    chiefOperatorNotes[1],
    chiefOperatorNotes[2],
    chiefOperatorNotes[3],
    chiefOperatorNotes[4]
  ]
  const normalizedCounterfactuals: ProbeSummary['counterfactualNotes'] = [
    counterfactualNotes[0],
    counterfactualNotes[1]
  ]
  return {
    probeKind: summary.probeKind,
    deskCondition: summary.deskCondition,
    metrics: summary.metrics,
    callBucketTable: summary.callBucketTable,
    loadBandTable: summary.loadBandTable,
    lineGroupTable: summary.lineGroupTable,
    failureBuckets: summary.failureBuckets,
    failureModes: summary.failureModes,
    modeConfidence: summary.modeConfidence,
    transferWarning: summary.transferWarning,
    recommendedQuestions: normalizedQuestions,
    chiefOperatorNotes: normalizedChiefNotes,
    counterfactualNotes: normalizedCounterfactuals,
    incidents: summary.incidents
  }
}

export function toShiftRecord (doc: ShiftDoc | null): StoredShiftRecord | null {
  if (!doc) return null
  return {
    id: doc._id,
    github: doc.github,
    seed: doc.seed,
    artifactVersion: doc.artifactVersion,
    state: doc.state,
    startedAt: doc.startedAt,
    phase1EndsAt: doc.phase1EndsAt,
    expiresAt: doc.expiresAt,
    completedAt: doc.completedAt,
    latestDraftSource: doc.latestDraftSource,
    latestDraftSavedAt: doc.latestDraftSavedAt,
    latestValidSource: doc.latestValidSource,
    latestValidSourceHash: doc.latestValidSourceHash,
    latestValidAt: doc.latestValidAt,
    latestValidationError: doc.latestValidationError,
    latestValidationCheckedAt: doc.latestValidationCheckedAt,
    artifactFetchAt: doc.artifactFetchAt,
    runs: doc.runs.map((run) => ({
      ...run,
      probeSummary: normalizeProbeSummary(run.probeSummary)
    })),
    reportPublicId: doc.reportPublicId
  }
}

export async function loadShift (db: DatabaseReader, shiftId: ShiftId) {
  return db.get(shiftId)
}

export async function loadShiftById (db: DatabaseReader, shiftId: ShiftId) {
  return db.get(shiftId)
}

export async function loadOwnedShift (db: DatabaseReader, github: string, shiftId: ShiftId) {
  const doc = await loadShift(db, shiftId)
  if (!doc || doc.github !== github) return null
  return doc
}
