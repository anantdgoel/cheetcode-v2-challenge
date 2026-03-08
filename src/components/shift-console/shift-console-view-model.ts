import type { BoardCondition, Title } from "@/lib/contracts/game";
import type { ShiftView } from "@/lib/contracts/views";
import type { ActionStep, ReadoutField, StepState } from "./types";

export function formatCountdown(targetTime: number, now: number) {
  const remaining = Math.max(0, targetTime - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getPhaseLabel(status: ShiftView["status"]) {
  switch (status) {
    case "active_phase_1": return "Phase One";
    case "active_phase_2": return "Phase Two";
    case "evaluating": return "Evaluating";
    case "completed": return "Completed";
    case "expired_no_result": return "Expired";
  }
}

function getTrialStatus(shift: ShiftView) {
  if (shift.probesUsed === 0) return "Available";
  if (shift.remainingProbes > 0) return "Completed";
  return "Used";
}

function getValidatedDisplay(shift: ShiftView) {
  if (!shift.latestValidAt) return "No";
  return new Date(shift.latestValidAt).toLocaleTimeString("en-US", { hour12: false });
}

export function titleToLineNumber(title: Title): string | null {
  switch (title) {
    case "chief_operator": return "01";
    case "senior_operator": return "02";
    case "operator": return "03";
    case "trainee": return "04";
    default: return null;
  }
}

export function conditionDotClass(condition: BoardCondition) {
  return `console-trial__condition-dot console-trial__condition-dot--${condition === "overrun" ? "overrun" : condition === "strained" ? "strained" : "steady"}`;
}

function getStepStates(shift: ShiftView): [StepState, StepState, StepState] {
  const hasValidated = !!shift.latestValidAt;
  const hasProbed = shift.probesUsed > 0;
  const hasFinal = !!shift.finalEvaluation;
  const isTerminal = shift.status === "completed" || shift.status === "expired_no_result";

  const s1: StepState = hasValidated ? "completed" : isTerminal ? "disabled" : "active";
  const s2: StepState = hasProbed ? "completed" : (!hasValidated || isTerminal) ? "disabled" : shift.nextProbeKind ? "active" : "disabled";
  const s3: StepState = hasFinal ? "completed" : shift.canGoLive ? "active" : isTerminal ? "disabled" : "upcoming";

  return [s1, s2, s3];
}

export function formatIncidents(incidents: Array<{ second: number; note: string }>) {
  return incidents.map((incident) => `t=${incident.second}s - ${incident.note}`).join("  ");
}

export function getShiftConsoleViewModel(params: {
  shift: ShiftView;
  now: number;
  validating: boolean;
  runningProbe: boolean;
  goingLive: boolean;
  actionStatus: string;
  onValidate: () => void;
  onRunProbe: () => void;
  onGoLive: () => void;
}) {
  const { shift, now, validating, runningProbe, goingLive, actionStatus } = params;
  const [s1, s2, s3] = getStepStates(shift);
  const phaseLabel = getPhaseLabel(shift.status);
  const trialStatus = getTrialStatus(shift);
  const validatedDisplay = getValidatedDisplay(shift);
  const isCompleted = shift.status === "completed" || shift.status === "expired_no_result";
  const isEvaluating = shift.status === "evaluating";

  const dotClass = isCompleted
    ? "console-header__dot console-header__dot--completed"
    : shift.status === "expired_no_result"
      ? "console-header__dot console-header__dot--expired"
      : "console-header__dot";

  const statusNotice = shift.finalEvaluation
    ? "Shift complete - policy submitted"
    : actionStatus || (shift.latestValidAt && !shift.latestValidationError
      ? "Module validated - ready to go live"
      : "");

  const readoutFields: ReadoutField[][] = [
    [
      {
        label: "Phase",
        value: shift.status === "active_phase_1" ? "Phase 1" : shift.status === "active_phase_2" ? "Phase 2" : phaseLabel,
        modifier: "",
      },
      {
        label: "Trial",
        value: trialStatus,
        modifier: trialStatus !== "Available" ? " console-readout__value--green" : "",
      },
    ],
    [
      {
        label: "Validated",
        value: validatedDisplay,
        modifier: validatedDisplay === "No" ? " console-readout__value--muted" : "",
      },
      {
        label: "Can Go Live",
        value: shift.canGoLive ? "Yes" : "No",
        modifier: shift.canGoLive ? " console-readout__value--green" : " console-readout__value--muted",
      },
    ],
  ];

  const steps: ActionStep[] = [
    {
      state: s1,
      number: "1",
      label: "Validate",
      loading: validating,
      loadingLabel: "Validating...",
      action: params.onValidate,
    },
    {
      state: s2,
      number: "2",
      label: "Trial Shift",
      loading: runningProbe,
      loadingLabel: "Running...",
      action: params.onRunProbe,
    },
    {
      state: s3,
      number: "3",
      label: "Go Live",
      loading: goingLive,
      loadingLabel: "Submitting...",
      action: params.onGoLive,
    },
  ];

  return {
    dotClass,
    isCompleted,
    isEvaluating,
    phaseLabel,
    readoutFields,
    statusNotice,
    steps,
  };
}
