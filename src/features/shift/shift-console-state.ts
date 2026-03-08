"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ArtifactName, BoardCondition, ProbeSummary } from "@/lib/domain/game";
import type { ShiftView } from "@/lib/domain/views";
import {
  fetchArtifactContent,
  fetchShift,
  goLive,
  runProbe,
  saveDraft,
  validateDraft,
} from "./shift-console-api";

export type ActiveTab = ArtifactName | "editor";
export type SavingState = "idle" | "saving" | "saved";
type StepState = "completed" | "active" | "upcoming" | "disabled";
type StatusNoticeTone = "success" | "warning";
export type ClockTone = "steady" | "tight" | "critical" | "resolved";

const FINAL_WARNING_MS = 10_000;

export type ActionStep = {
  action: () => void;
  emphasized?: boolean;
  label: string;
  loading: boolean;
  loadingLabel: string;
  number: string;
  state: StepState;
};

export type ReadoutField = {
  label: string;
  modifier?: string;
  value: string;
};

export const SHIFT_ARTIFACTS: ArtifactName[] = [
  "manual.md",
  "starter.js",
  "lines.json",
  "observations.jsonl",
];

export const SHIFT_ARTIFACT_LABELS: Record<ArtifactName, string> = {
  "manual.md": "manual.md",
  "starter.js": "starter.js",
  "lines.json": "lines.json",
  "observations.jsonl": "call-log.jsonl",
};

export function formatCountdown(targetTime: number, now: number) {
  const remaining = Math.max(0, targetTime - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function conditionDotClass(condition: BoardCondition) {
  return `console-trial__condition-dot console-trial__condition-dot--${condition === "overrun" ? "overrun" : condition === "strained" ? "strained" : "steady"}`;
}

export function formatIncidents(incidents: Array<{ note: string; second: number }>) {
  return incidents.map((incident) => `t=${incident.second}s - ${incident.note}`).join("  ");
}

function getProbeCompletionMessage(probeKind: ShiftView["nextProbeKind"] | "fit" | "stress") {
  return probeKind === "fit"
    ? "Day room read complete."
    : "Rush room read complete.";
}

function getPhaseLabel(status: ShiftView["status"]) {
  switch (status) {
    case "active_phase_1":
      return "Phase One";
    case "active_phase_2":
      return "Phase Two";
    case "evaluating":
      return "Evaluating";
    case "completed":
      return "Completed";
    case "expired_no_result":
      return "Expired";
  }
}

function getClockTone(shift: ShiftView, now: number): ClockTone {
  if (shift.status === "completed" || shift.status === "expired_no_result" || shift.status === "evaluating") {
    return "resolved";
  }
  if (shift.expiresAt - now <= FINAL_WARNING_MS) {
    return "critical";
  }
  if (now >= shift.phase1EndsAt) {
    return "tight";
  }
  return "steady";
}

function getTimeCueLabel(shift: ShiftView, clockTone: ClockTone) {
  if (clockTone === "critical") {
    return shift.latestValidSource ? "Last bell armed" : "No draft on the board";
  }
  if (clockTone === "tight") return "Trial floor closed";
  if (clockTone === "steady") return "Board open";
  return "";
}

function getAmbientNotice(params: {
  actionStatus: string;
  clockTone: ClockTone;
  shift: ShiftView;
}) {
  const { actionStatus, clockTone, shift } = params;
  if (shift.finalEvaluation) {
    return { message: "Shift complete - policy submitted", tone: "success" as const };
  }
  if (actionStatus) {
    return {
      message: actionStatus,
      tone: clockTone === "critical" ? ("warning" as const) : ("success" as const),
    };
  }
  if (clockTone === "critical") {
    return shift.latestValidSource
      ? {
          message: "Last bell. The last valid draft goes live at the whistle.",
          tone: "warning" as const,
        }
      : {
          message: "Last bell. No valid draft is on the board. The room goes dark at expiry.",
          tone: "warning" as const,
        };
  }
  if (shift.latestValidAt && !shift.latestValidationError) {
    return {
      message:
        shift.remainingProbes === 0
          ? "Board read complete. Go live when ready."
          : "Module validated - ready to go live",
      tone: "success" as const,
    };
  }
  return { message: "", tone: "success" as const };
}

function getStepStates(shift: ShiftView): [StepState, StepState, StepState] {
  const hasValidated = !!shift.latestValidAt;
  const hasUsedAllProbes = shift.remainingProbes === 0;
  const hasFinal = !!shift.finalEvaluation;
  const isTerminal = shift.status === "completed" || shift.status === "expired_no_result";

  return [
    hasValidated ? "completed" : isTerminal ? "disabled" : "active",
    hasUsedAllProbes
      ? "completed"
      : !hasValidated || isTerminal || !shift.nextProbeKind
        ? "disabled"
        : "active",
    hasFinal ? "completed" : shift.canGoLive ? "active" : isTerminal ? "disabled" : "upcoming",
  ];
}

function deriveShiftConsoleState(params: {
  actionStatus: string;
  goingLive: boolean;
  now: number;
  onGoLive: () => void;
  onRunProbe: () => void;
  onValidate: () => void;
  runningProbe: boolean;
  shift: ShiftView;
  validating: boolean;
}) {
  const { actionStatus, goingLive, now, runningProbe, shift, validating } = params;
  const [validateState, probeState, goLiveState] = getStepStates(shift);
  const phaseLabel = getPhaseLabel(shift.status);
  const clockTone = getClockTone(shift, now);
  const timeCueLabel = getTimeCueLabel(shift, clockTone);
  const trialStatus = String(shift.remainingProbes);
  const validatedDisplay = !shift.latestValidAt
    ? "No"
    : new Date(shift.latestValidAt).toLocaleTimeString("en-US", { hour12: false });
  const ambientNotice = getAmbientNotice({ actionStatus, clockTone, shift });

  return {
    clockTone,
    dotClass:
      shift.status === "completed"
        ? "console-header__dot console-header__dot--completed"
        : shift.status === "expired_no_result"
          ? "console-header__dot console-header__dot--expired"
          : "console-header__dot",
    isCompleted: shift.status === "completed" || shift.status === "expired_no_result",
    isEvaluating: shift.status === "evaluating",
    phaseLabel,
    statusNotice: ambientNotice.message,
    statusNoticeTone: ambientNotice.tone as StatusNoticeTone,
    readoutFields: [
      [
        {
          label: "Phase",
          value:
            shift.status === "active_phase_1"
              ? "Phase 1"
              : shift.status === "active_phase_2"
                ? "Phase 2"
                : phaseLabel,
        },
        {
          label: "Trial",
          modifier: trialStatus !== "Available" ? " console-readout__value--green" : undefined,
          value: trialStatus,
        },
      ],
      [
        {
          label: "Validated",
          modifier: validatedDisplay === "No" ? " console-readout__value--muted" : undefined,
          value: validatedDisplay,
        },
        {
          label: "Can Go Live",
          modifier: shift.canGoLive
            ? " console-readout__value--green"
            : " console-readout__value--muted",
          value: shift.canGoLive ? "Yes" : "No",
        },
      ],
    ] as ReadoutField[][],
    steps: [
      {
        action: params.onValidate,
        label: "Validate",
        loading: validating,
        loadingLabel: "Validating...",
        number: "1",
        state: validateState,
      },
      {
        action: params.onRunProbe,
        label: `Trial Shift (${shift.remainingProbes})`,
        loading: runningProbe,
        loadingLabel: "Running...",
        number: "2",
        state: probeState,
      },
      {
        action: params.onGoLive,
        emphasized: shift.remainingProbes === 0 && shift.canGoLive,
        label: "Go Live",
        loading: goingLive,
        loadingLabel: "Submitting...",
        number: "3",
        state: goLiveState,
      },
    ] as ActionStep[],
    timeCueLabel,
  };
}

export function useShiftConsole(initialShift: ShiftView) {
  const router = useRouter();
  const [shift, setShift] = useState(initialShift);
  const [draft, setDraft] = useState(initialShift.latestDraftSource);
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual.md");
  const [artifactContents, setArtifactContents] = useState<Partial<Record<ArtifactName, string>>>(
    {},
  );
  const [now, setNow] = useState(Date.now());
  const [savingState, setSavingState] = useState<SavingState>("idle");
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [validating, setValidating] = useState(false);
  const [runningProbe, setRunningProbe] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvingExpiryRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
      if (expiryPollTimer.current) clearTimeout(expiryPollTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (shift.status === "completed" && shift.reportPublicId) {
      router.push(`/report/${shift.reportPublicId}`);
    }
  }, [router, shift.reportPublicId, shift.status]);

  useEffect(() => {
    if (
      now < shift.expiresAt ||
      shift.status === "completed" ||
      shift.status === "expired_no_result" ||
      resolvingExpiryRef.current
    ) {
      return;
    }

    resolvingExpiryRef.current = true;

    const refreshUntilResolved = async () => {
      try {
        const result = await fetchShift(shift.id);
        if (!mountedRef.current) return;

        setShift(result.shift);
        if (result.shift.status === "completed" || result.shift.status === "expired_no_result") {
          resolvingExpiryRef.current = false;
          return;
        }
      } catch {}

      if (!mountedRef.current) return;
      expiryPollTimer.current = setTimeout(() => {
        void refreshUntilResolved();
      }, 500);
    };

    void refreshUntilResolved();

    return () => {
      if (expiryPollTimer.current) clearTimeout(expiryPollTimer.current);
      resolvingExpiryRef.current = false;
    };
  }, [now, shift.expiresAt, shift.id, shift.status]);

  useEffect(() => {
    const artifactName = activeTab === "editor" ? null : activeTab;
    if (!artifactName || artifactContents[artifactName]) return;

    let cancelled = false;
    void fetchArtifactContent(shift.id, artifactName)
      .then((content) => {
        if (!cancelled) {
          setArtifactContents((current) => ({ ...current, [artifactName]: content }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setArtifactContents((current) => ({
            ...current,
            [artifactName]: error instanceof Error ? error.message : "Artifact unavailable",
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, artifactContents, shift.id]);

  function scheduleSave(nextValue: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current);

    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await saveDraft(shift.id, nextValue);
        if (!mountedRef.current) return;
        if (!response.ok) {
          setSavingState("idle");
          return;
        }
        setSavingState("saved");
        saveResetTimer.current = setTimeout(() => {
          if (mountedRef.current) setSavingState("idle");
        }, 1200);
      } catch {
        if (mountedRef.current) setSavingState("idle");
      }
    }, 500);
  }

  async function handleAction(
    stateSetter: Dispatch<SetStateAction<boolean>>,
    action: () => Promise<void>,
  ) {
    stateSetter(true);
    setActionError("");
    setActionStatus("");
    try {
      await action();
    } finally {
      stateSetter(false);
    }
  }

  const activeProbeSummary = shift.probeEvaluations
    .filter((evaluation) => evaluation.state === "completed" && evaluation.probeSummary)
    .at(-1)?.probeSummary as ProbeSummary | undefined;
  const consoleState = deriveShiftConsoleState({
    actionStatus,
    goingLive,
    now,
    onGoLive: () => {
      void handleAction(setGoingLive, async () => {
        try {
          const result = await goLive(shift.id);
          setShift(result.shift);
          setActionStatus("Shift complete - policy submitted");
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "Go Live failed");
        }
      });
    },
    onRunProbe: () => {
      void handleAction(setRunningProbe, async () => {
        try {
          const result = await runProbe(shift.id);
          setShift(result.shift);
          setActionStatus(getProbeCompletionMessage(result.probeKind));
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "Probe failed");
        }
      });
    },
    onValidate: () => {
      setActiveTab("editor");
      void handleAction(setValidating, async () => {
        try {
          const result = await validateDraft(shift.id, draft);
          if (result.shift) setShift(result.shift);
          setActionStatus("Module validated - ready to go live");
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "Validation failed");
        }
      });
    },
    runningProbe,
    shift,
    validating,
  });

  return {
    actionError,
    activeProbeSummary,
    activeTab,
    artifactContents,
    draft,
    now,
    savingState,
    scheduleSave,
    setActiveTab,
    setDraft,
    shift,
    shiftIdShort: shift.id.slice(-6).toUpperCase(),
    ...consoleState,
  };
}
