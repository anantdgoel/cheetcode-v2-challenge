import type { ArtifactName, BoardCondition } from '@/core/domain/game'
import type { ShiftView } from '@/core/domain/views'
import type { ActionStep, ClockTone, ReadoutField, StepState } from './types'

const FINAL_WARNING_MS = 10_000

export const SHIFT_ARTIFACTS: ArtifactName[] = [
  'manual.md',
  'lines.json',
  'observations.jsonl'
]

export const SHIFT_ARTIFACT_LABELS: Record<ArtifactName, string> = {
  'manual.md': 'manual.md',
  'starter.js': 'starter.js',
  'lines.json': 'lines.json',
  'observations.jsonl': 'call-log.jsonl'
}

export function formatCountdown (targetTime: number, now: number) {
  const remaining = Math.max(0, targetTime - now)
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function conditionDotClass (condition: BoardCondition) {
  return `console-trial__condition-dot console-trial__condition-dot--${condition === 'overrun' ? 'overrun' : condition === 'strained' ? 'strained' : 'steady'}`
}

export function formatIncidents (incidents: Array<{ note: string; second: number }>) {
  return incidents.map((incident) => `t=${incident.second}s - ${incident.note}`).join('  ')
}

export function getProbeCompletionMessage (probeKind: ShiftView['nextProbeKind'] | 'fit' | 'stress') {
  return probeKind === 'fit'
    ? 'Day room read complete.'
    : 'Rush room read complete.'
}

export function getPhaseLabel (status: ShiftView['status']) {
  switch (status) {
    case 'active_phase_1':
      return 'Phase One'
    case 'active_phase_2':
      return 'Phase Two'
    case 'evaluating':
      return 'Evaluating'
    case 'completed':
      return 'Completed'
    case 'expired_no_result':
      return 'Expired'
  }
}

export function getClockTone (shift: ShiftView, now: number): ClockTone {
  if (shift.status === 'completed' || shift.status === 'expired_no_result' || shift.status === 'evaluating') {
    return 'resolved'
  }
  if (shift.expiresAt - now <= FINAL_WARNING_MS) {
    return 'critical'
  }
  if (now >= shift.phase1EndsAt) {
    return 'tight'
  }
  return 'steady'
}

export function getTimeCueLabel (shift: ShiftView, clockTone: ClockTone) {
  if (shift.status === 'evaluating') return 'Chief operator reading'
  if (clockTone === 'critical') {
    return shift.latestValidSource ? 'Last bell armed' : 'No draft on the board'
  }
  if (clockTone === 'tight') return 'Trial floor closed'
  if (clockTone === 'steady') return 'Board open'
  return ''
}

export function getAmbientNotice (params: {
  actionStatus: string;
  clockTone: ClockTone;
  shift: ShiftView;
}) {
  const { actionStatus, clockTone, shift } = params
  if (shift.finalEvaluation) {
    return { message: 'Shift complete - policy submitted', tone: 'success' as const }
  }
  if (shift.status === 'evaluating') {
    return {
      message: 'Live room engaged. Chief operator is reading your board. Your shift report will open automatically.',
      tone: 'success' as const
    }
  }
  if (actionStatus) {
    return {
      message: actionStatus,
      tone: clockTone === 'critical' ? ('warning' as const) : ('success' as const)
    }
  }
  if (clockTone === 'critical') {
    return shift.latestValidSource
      ? {
          message: 'Last bell. The last valid draft goes live at the whistle.',
          tone: 'warning' as const
        }
      : {
          message: 'Last bell. No valid draft is on the board. The room goes dark at expiry.',
          tone: 'warning' as const
        }
  }
  if (shift.latestValidAt && !shift.latestValidationError) {
    return {
      message:
        shift.remainingProbes === 0
          ? 'Board read complete. Go live when ready.'
          : 'Module validated - ready to go live',
      tone: 'success' as const
    }
  }
  return { message: '', tone: 'success' as const }
}

function getStepStates (shift: ShiftView): [StepState, StepState, StepState] {
  const hasValidated = !!shift.latestValidAt
  const hasUsedAllProbes = shift.remainingProbes === 0
  const hasFinal = !!shift.finalEvaluation
  const isTerminal = shift.status === 'completed' || shift.status === 'expired_no_result'
  const isEvaluating = shift.status === 'evaluating'

  return [
    hasValidated ? 'completed' : isTerminal || isEvaluating ? 'disabled' : 'active',
    hasUsedAllProbes
      ? 'completed'
      : !hasValidated || isTerminal || isEvaluating || !shift.nextProbeKind || shift.status === 'active_phase_2'
          ? 'disabled'
          : 'active',
    hasFinal ? 'completed' : isEvaluating ? 'disabled' : shift.canGoLive ? 'active' : isTerminal ? 'disabled' : 'upcoming'
  ]
}

export function deriveShiftConsoleState (params: {
  goingLive: boolean;
  onGoLive: () => void;
  onRunProbe: () => void;
  onValidate: () => void;
  runningProbe: boolean;
  shift: ShiftView;
  validating: boolean;
}) {
  const { goingLive, runningProbe, shift, validating } = params
  const [validateState, probeState, goLiveState] = getStepStates(shift)
  const trialStatus = String(shift.remainingProbes)
  const validatedDisplay = !shift.latestValidAt
    ? 'No'
    : new Date(shift.latestValidAt).toLocaleTimeString('en-US', { hour12: false })

  return {
    isCompleted: shift.status === 'completed' || shift.status === 'expired_no_result',
    isEvaluating: shift.status === 'evaluating',
    readoutFields: [
      [
        {
          label: 'Phase',
          value:
            shift.status === 'active_phase_1'
              ? 'Phase 1'
              : shift.status === 'active_phase_2'
                ? 'Phase 2'
                : getPhaseLabel(shift.status)
        },
        {
          label: 'Trial',
          modifier: shift.remainingProbes > 0 ? ' console-readout__value--green' : undefined,
          value: trialStatus
        }
      ],
      [
        {
          label: 'Validated',
          modifier: validatedDisplay === 'No' ? ' console-readout__value--muted' : undefined,
          value: validatedDisplay
        },
        {
          label: 'Can Go Live',
          modifier: shift.canGoLive
            ? ' console-readout__value--green'
            : ' console-readout__value--muted',
          value: shift.canGoLive ? 'Yes' : 'No'
        }
      ]
    ] as ReadoutField[][],
    steps: [
      {
        action: params.onValidate,
        label: 'Validate',
        loading: validating,
        loadingLabel: 'Validating...',
        number: '1',
        state: validateState
      },
      {
        action: params.onRunProbe,
        label: shift.status === 'active_phase_2' && shift.remainingProbes > 0
          ? 'Trial Floor Closed'
          : `Trial Shift (${shift.remainingProbes})`,
        loading: runningProbe,
        loadingLabel: 'Running...',
        number: '2',
        state: probeState
      },
      {
        action: params.onGoLive,
        emphasized: shift.remainingProbes === 0 && shift.canGoLive,
        label: shift.status === 'evaluating' ? 'Reading Board' : 'Go Live',
        loading: goingLive || shift.status === 'evaluating',
        loadingLabel: shift.status === 'evaluating' ? 'Reading Board...' : 'Submitting...',
        number: '3',
        state: goLiveState
      }
    ] as ActionStep[],
    probeCompletionMessage: getProbeCompletionMessage
  }
}
