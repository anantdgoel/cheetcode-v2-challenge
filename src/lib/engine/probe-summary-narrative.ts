import {
  FAILURE_MODES,
  PROBE_CHIEF_OPERATOR_NOTE_COUNT,
  PROBE_COUNTERFACTUAL_NOTE_COUNT,
  PROBE_RECOMMENDED_QUESTION_COUNT,
  type FailureMode,
  type ProbeKind,
  type ProbeSummary,
  type RouteCode,
  type TransferWarning,
  type BillingMode,
  type Urgency
} from '@/lib/domain/game'
import { clamp } from './shared'
import type { SummarySignals } from './probe-summary-analysis'

type FailureModeDefinition = {
  score: (signals: SummarySignals, mode: ProbeKind) => number;
  diagnosticQuestion: string;
  chiefNote: (bucket: string, transferWarning: TransferWarning) => string;
  counterfactual: (bucket: string) => string;
};

function roundSupport (value: number) {
  return Number(clamp(value, 0, 0.99).toFixed(2))
}

function expectTupleLength<T> (values: T[], expected: number, label: string): T[] {
  if (values.length < expected) {
    throw new Error(`probe summary invariant failed: ${label} requires ${expected} entries`)
  }
  return values
}

function dedupeStrings (values: string[]) {
  return [...new Set(values)]
}

function asQuestionPair (values: string[]) {
  const pair = expectTupleLength(values, PROBE_RECOMMENDED_QUESTION_COUNT, 'recommendedQuestions')
  return [pair[0], pair[1]] as [string, string]
}

function asCounterfactualPair (values: string[]) {
  const pair = expectTupleLength(values, PROBE_COUNTERFACTUAL_NOTE_COUNT, 'counterfactualNotes')
  return [pair[0], pair[1]] as [string, string]
}

function asChiefNoteTuple (values: string[]) {
  const notes = expectTupleLength(values, PROBE_CHIEF_OPERATOR_NOTE_COUNT, 'chiefOperatorNotes')
  return [notes[0], notes[1], notes[2], notes[3], notes[4]] as [string, string, string, string, string]
}

function bucketPhrase (bucketId: string | undefined) {
  if (!bucketId) return 'the room'
  const [routeCode, billingMode, urgency] = bucketId.split('|') as [RouteCode, BillingMode, Urgency]
  return [
    routeCode === 'intercity' ? 'intercity' : routeCode,
    billingMode === 'verified' ? 'verified' : billingMode === 'collect' ? 'collect' : 'standard',
    urgency === 'priority' ? 'priority' : 'routine'
  ].join(' ')
}

const FAILURE_MODE_DEFS: Record<FailureMode, FailureModeDefinition> = {
  collapse_under_pressure: {
    score: (signals) =>
      roundSupport(
        Math.max(0, signals.calmConnectRate - signals.hotConnectRate) * 1.2 +
          Math.max(0, signals.hotDropRate - signals.calmDropRate) * 1.2 +
          signals.lowMarginFaultRate * 0.8 +
          signals.pressureCollapse * 0.2
      ),
    diagnosticQuestion: 'Does the desk change shape once pressure moves from building to hot?',
    chiefNote: (bucket) =>
      `The ${bucket} desk carried neatly until the lamps stacked, then the room began dropping its poise before the callers did.`,
    counterfactual: (bucket) =>
      `What seemed like a steady answer for ${bucket} in the books lost its footing once the room heated up.`
  },
  premium_thrash: {
    score: (signals) =>
      roundSupport(
        signals.premiumUsageRate * 0.85 +
          signals.premiumFaultRate * 0.9 +
          signals.premiumMisuseRate * 1.2 +
          signals.premiumFragility * 0.16
      ),
    diagnosticQuestion: 'Is premium reuse flattering the early rows and hurting the narrow high-value calls later?',
    chiefNote: (bucket) =>
      `The polished trunks paid early on ${bucket}, then started charging the room for their vanity once they were leaned on twice.`,
    counterfactual: (bucket) =>
      `What seemed like generous premium help for ${bucket} turned out to be early shine that soured with reuse.`
  },
  overholding: {
    score: (signals) =>
      roundSupport(
        signals.holdFailureRate * 1.15 +
          signals.droppedOnHoldRate * 1.15 +
          Math.min(signals.holdFailureRate, 0.3) * 0.4
      ),
    diagnosticQuestion: 'Are callers being left on hold where a modest route would have cleared them sooner?',
    chiefNote: (bucket) =>
      `The queue treated ${bucket} like borrowed time; patience looked cheap until the board asked for it all at once.`,
    counterfactual: (bucket) =>
      `What seemed like harmless patience for ${bucket} became delay the board never paid back.`
  },
  false_generalist: {
    score: (signals) =>
      roundSupport(
        signals.failureRouteBreadth * 0.75 +
          signals.lineGroupOverreach * 0.7 +
          signals.lineGroupFaultPeak * 0.75 +
          signals.historyUnreliability * 0.12
      ),
    diagnosticQuestion: 'Are the same rows being treated as universal when only one traffic family really wants them?',
    chiefNote: (bucket) =>
      `The relay-looking rows flattered themselves across ${bucket}, then failed when asked to be every desk in the room.`,
    counterfactual: (bucket) =>
      `What seemed like an all-purpose row for ${bucket} was really one desk wearing borrowed confidence.`
  },
  tempo_lag: {
    score: (signals, mode) =>
      roundSupport(
        Math.max(0, signals.firstHalfConnectRate - signals.secondHalfConnectRate) * 1.25 +
          Math.max(0, signals.secondHalfDropRate - signals.firstHalfDropRate) * 1.1 +
          signals.tempoLag * 0.24 +
          (mode === 'stress' ? 0.08 : 0)
      ),
    diagnosticQuestion: 'Does the room answer late to surging pace even when the first fit looked clean?',
    chiefNote: (bucket, transferWarning) =>
      transferWarning === 'likely_final_shift_sensitive'
        ? `The room changes pace ahead of the routing on ${bucket}; the late board answers a beat behind the first clean read.`
        : `The room answered ${bucket} cleanly at first, then fell a beat behind its own pace once the turns arrived closer together.`,
    counterfactual: (bucket) =>
      `What seemed well-timed for ${bucket} on the first read arrived a beat late once the room quickened.`
  },
  misleading_history: {
    score: (signals) =>
      roundSupport(
        signals.historyUnreliability * 1.05 +
          Math.max(0, signals.calmConnectRate - signals.hotConnectRate) * 0.18 +
          signals.failureRouteBreadth * 0.2 +
          signals.finalShiftSensitivity * 0.18
      ),
    diagnosticQuestion: 'Did the books reward the wrong desks for the live room you actually have?',
    chiefNote: (bucket) =>
      `The books praised a calmer version of ${bucket} than the probe actually found once the live room started speaking for itself.`,
    counterfactual: (bucket) =>
      `What seemed like board law for ${bucket} was partly the books talking louder than the live room.`
  }
}

export function scoreFailureModes (signals: SummarySignals, mode: ProbeKind) {
  const scores = Object.fromEntries(
    FAILURE_MODES.map((failureMode) => [failureMode, FAILURE_MODE_DEFS[failureMode].score(signals, mode)])
  ) as Record<FailureMode, number>

  return {
    ranked: [...FAILURE_MODES].sort((left, right) => scores[right] - scores[left]).slice(0, 3),
    scores
  }
}

export function transferWarningForSignals (signals: SummarySignals, mode: ProbeKind): TransferWarning {
  if (signals.finalShiftSensitivity > 0.62 || (signals.tempoLag > 0.58 && mode === 'stress')) {
    return 'likely_final_shift_sensitive'
  }
  if (mode === 'stress' && signals.pressureCollapse > 0.55 && signals.historyUnreliability < 0.38) {
    return 'stress_only'
  }
  return 'stable'
}

export function buildRecommendedQuestions (failureModes: FailureMode[]) {
  return asQuestionPair(
    failureModes.slice(0, PROBE_RECOMMENDED_QUESTION_COUNT).map((mode) => FAILURE_MODE_DEFS[mode].diagnosticQuestion)
  )
}

export function buildChiefOperatorNotes (
  failureModes: FailureMode[],
  failureBuckets: ProbeSummary['failureBuckets'],
  transferWarning: TransferWarning,
  signals: SummarySignals
) {
  const bucket = bucketPhrase(failureBuckets[0]?.bucketId)
  const notes = dedupeStrings([
    ...failureModes.map((mode) => FAILURE_MODE_DEFS[mode].chiefNote(bucket, transferWarning)),
    signals.lineGroupOverreach > 0.22
      ? 'One corner of the board was asked to answer too much of the room, and the room noticed before the policy did.'
      : 'The room rewarded cleaner matching when the routing stopped pretending every open lamp meant the same thing.',
    transferWarning === 'likely_final_shift_sensitive'
      ? 'The probe looked orderly only until the room hinted that its late habits are not the same as its opening manners.'
      : 'The room did not ask for a new board, only a firmer reading of when the present one stops behaving politely.'
  ])
  return asChiefNoteTuple(notes.slice(0, PROBE_CHIEF_OPERATOR_NOTE_COUNT))
}

export function buildCounterfactualNotes (
  failureModes: FailureMode[],
  failureBuckets: ProbeSummary['failureBuckets']
) {
  const topBucket = bucketPhrase(failureBuckets[0]?.bucketId)
  const secondaryBucket = bucketPhrase(failureBuckets[1]?.bucketId ?? failureBuckets[0]?.bucketId)
  const notes = dedupeStrings([
    FAILURE_MODE_DEFS[failureModes[0] ?? 'misleading_history'].counterfactual(topBucket),
    FAILURE_MODE_DEFS[failureModes[1] ?? 'collapse_under_pressure'].counterfactual(secondaryBucket)
  ])
  return asCounterfactualPair([
    notes[0] ?? FAILURE_MODE_DEFS.misleading_history.counterfactual(topBucket),
    notes[1] ?? FAILURE_MODE_DEFS.tempo_lag.counterfactual(secondaryBucket)
  ])
}
