import {
  BILLING_MODES,
  BOARD_CONDITIONS,
  FAILURE_MODES,
  LOAD_BANDS,
  PROBE_CHIEF_OPERATOR_NOTE_COUNT,
  PROBE_COUNTERFACTUAL_NOTE_COUNT,
  PROBE_RECOMMENDED_QUESTION_COUNT,
  PROBE_KINDS,
  ROUTE_CODES,
  TITLES,
  TRANSFER_WARNINGS,
  URGENCIES,
  type ProbeSummary
} from '../src/core/domain/game'
import { expectLiteralValue } from '../src/core/domain/normalizers'
import type { StoredRunRecord, StoredShiftRecord } from '../src/features/shift/domain/persistence'
import type { Doc, Id } from './_generated/dataModel'
import type { DatabaseReader } from './_generated/server'

export type ShiftDoc = Doc<'shifts'>
export type ShiftRunDoc = ShiftDoc['runs'][number]
export type ShiftId = Id<'shifts'>
const FAILURE_REASONS = ['hold_too_long', 'fault_under_load', 'premium_misuse', 'low_margin_routing'] as const

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
  const normalizedFailureBuckets: ProbeSummary['failureBuckets'] = summary.failureBuckets.map((bucket) => ({
    ...bucket,
    dominantReason: expectLiteralValue(bucket.dominantReason, FAILURE_REASONS, 'probeSummary.failureBuckets.dominantReason')
  }))
  return {
    probeKind: expectLiteralValue(summary.probeKind, PROBE_KINDS, 'probeSummary.probeKind'),
    deskCondition: expectLiteralValue(summary.deskCondition, BOARD_CONDITIONS, 'probeSummary.deskCondition'),
    metrics: summary.metrics,
    callBucketTable: summary.callBucketTable.map((row) => ({
      ...row,
      routeCode: expectLiteralValue(row.routeCode, ROUTE_CODES, 'probeSummary.callBucketTable.routeCode'),
      billingMode: expectLiteralValue(row.billingMode, BILLING_MODES, 'probeSummary.callBucketTable.billingMode'),
      urgency: expectLiteralValue(row.urgency, URGENCIES, 'probeSummary.callBucketTable.urgency')
    })),
    loadBandTable: summary.loadBandTable.map((row) => ({
      ...row,
      loadBand: expectLiteralValue(row.loadBand, LOAD_BANDS, 'probeSummary.loadBandTable.loadBand')
    })),
    lineGroupTable: summary.lineGroupTable,
    failureBuckets: normalizedFailureBuckets,
    failureModes: summary.failureModes.map((mode) => (
      expectLiteralValue(mode, FAILURE_MODES, 'probeSummary.failureModes')
    )),
    modeConfidence: summary.modeConfidence,
    transferWarning: expectLiteralValue(summary.transferWarning, TRANSFER_WARNINGS, 'probeSummary.transferWarning'),
    recommendedQuestions: normalizedQuestions,
    chiefOperatorNotes: normalizedChiefNotes,
    counterfactualNotes: normalizedCounterfactuals,
    incidents: summary.incidents
  }
}

function normalizeRun (run: ShiftRunDoc): StoredRunRecord {
  return {
    id: run.id,
    kind: run.kind,
    trigger: run.trigger,
    state: run.state,
    acceptedAt: run.acceptedAt,
    ...(run.resolvedAt ? { resolvedAt: run.resolvedAt } : {}),
    sourceHash: run.sourceHash,
    sourceSnapshot: run.sourceSnapshot,
    ...(run.probeSummary ? { probeSummary: normalizeProbeSummary(run.probeSummary) } : {}),
    ...(run.metrics ? { metrics: run.metrics } : {}),
    ...(run.title ? { title: expectLiteralValue(run.title, TITLES, 'run.title') } : {}),
    ...(run.chiefOperatorNote ? { chiefOperatorNote: run.chiefOperatorNote } : {}),
    ...(run.reportPublicId ? { reportPublicId: run.reportPublicId } : {})
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
    runs: doc.runs.map(normalizeRun),
    reportPublicId: doc.reportPublicId
  }
}

/** Client-safe shift record: strips seed and hiddenScore from run metrics */
export function toClientShiftRecord (doc: ShiftDoc | null) {
  const record = toShiftRecord(doc)
  if (!record) return null
  const { seed: _, ...rest } = record
  return {
    ...rest,
    runs: record.runs.map((run) => {
      if (!run.metrics) return run
      const { hiddenScore: _h, ...metrics } = run.metrics
      return { ...run, metrics }
    })
  }
}

export async function loadShiftById (db: DatabaseReader, shiftId: ShiftId) {
  return db.get('shifts', shiftId)
}

export async function loadOwnedShift (db: DatabaseReader, github: string, shiftId: ShiftId) {
  const doc = await loadShiftById(db, shiftId)
  if (!doc || doc.github !== github) return null
  return doc
}
