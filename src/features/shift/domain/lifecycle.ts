import type { ProbeKind } from '@/core/domain/game'
import type { EvaluationKind, ShiftStatus } from '@/core/domain/views'
import type { ClientShiftRecord, StoredRunRecord } from './persistence'

type ProbeProgressRun = Pick<StoredRunRecord, 'kind' | 'state'>
type ShiftRecordLike = {
  state: ClientShiftRecord['state'];
  runs: ProbeProgressRun[];
  expiresAt: number;
  phase1EndsAt: number;
  latestValidSource?: string;
}

export const PHASE_1_MS = 30_000
export const SHIFT_MS = 60_000

export const PROBE_ORDER: ProbeKind[] = ['fit', 'stress']

export function toViewRunKind (run: StoredRunRecord): EvaluationKind {
  if (run.kind === 'final') {
    return run.trigger === 'auto_expire' ? 'auto_final' : 'final'
  }
  return run.kind
}

function getCompletedProbeKinds (runs: ProbeProgressRun[]): ProbeKind[] {
  return PROBE_ORDER.filter((kind) => runs.some((run) => run.kind === kind && run.state === 'completed'))
}

export function getNextProbeKind (runs: ProbeProgressRun[]): ProbeKind | undefined {
  const completed = new Set(getCompletedProbeKinds(runs))
  return PROBE_ORDER.find((kind) => !completed.has(kind))
}

export function getAcceptedRun<Run extends Pick<StoredRunRecord, 'state'>> (runs: Run[]) {
  return runs.find((run) => run.state === 'accepted' || run.state === 'processing')
}

export function hasLiveActiveShift (shift: ShiftRecordLike, now: number) {
  return shift.state === 'active' && (now < shift.expiresAt || !!getAcceptedRun(shift.runs))
}

export function getViewStatus (shift: ShiftRecordLike, now: number): ShiftStatus {
  const acceptedRun = getAcceptedRun(shift.runs)
  if (acceptedRun) return 'evaluating'
  if (shift.state === 'completed') return 'completed'
  if (shift.state === 'expired' || now >= shift.expiresAt) return 'expired_no_result'
  return now >= shift.phase1EndsAt ? 'active_phase_2' : 'active_phase_1'
}

export function getCurrentPhase (shift: ShiftRecordLike, now: number) {
  const status = getViewStatus(shift, now)
  if (status === 'evaluating') return 'evaluating' as const
  if (status === 'completed') return 'completed' as const
  if (status === 'expired_no_result') return 'expired' as const
  return 'active' as const
}

export function canEditShift (shift: ShiftRecordLike, now: number) {
  return shift.state === 'active' && now < shift.expiresAt && !getAcceptedRun(shift.runs)
}

export function shouldAutoFinalize (shift: ShiftRecordLike, now: number) {
  return shift.state === 'active' && now >= shift.expiresAt && !!shift.latestValidSource && !shift.runs.some((run) => run.kind === 'final')
}

export function shouldExpireWithoutResult (shift: ShiftRecordLike, now: number) {
  return shift.state === 'active' && now >= shift.expiresAt && !shift.latestValidSource
}
