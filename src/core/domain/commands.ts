import type { PolicyValidationResult, ProbeSummary, ProbeKind } from './game'
import type { ShiftView } from './views'

export type SaveDraftCommand = {
  github: string;
  shiftId: string;
  source: string;
  savedAt?: number;
}

export type ValidateDraftCommand = {
  github: string;
  shiftId: string;
  source: string;
}

export type ValidateDraftResult = {
  validation: PolicyValidationResult;
  shift: ShiftView | null;
}

export type RunProbeCommand = {
  github: string;
  shiftId: string;
}

export type RunProbeResult = {
  probeKind: ProbeKind;
  summary: ProbeSummary;
  shift: ShiftView;
}

export type GoLiveCommand = {
  github: string;
  shiftId: string;
}

export type GoLiveResult = {
  shift: ShiftView;
}
