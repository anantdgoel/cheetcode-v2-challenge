"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ArtifactName, BoardCondition, ProbeSummary } from "@/lib/domain/game";
import type { ShiftView } from "@/lib/domain/views";
import {
  fetchArtifactContent,
  goLive,
  runProbe,
  saveDraft,
  validateDraft,
} from "./shift-console-api";

export type ActiveTab = ArtifactName | "editor";
export type SavingState = "idle" | "saving" | "saved";
type StepState = "completed" | "active" | "upcoming" | "disabled";

export type ActionStep = {
  action: () => void;
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

function getStepStates(shift: ShiftView): [StepState, StepState, StepState] {
  const hasValidated = !!shift.latestValidAt;
  const hasProbed = shift.probesUsed > 0;
  const hasFinal = !!shift.finalEvaluation;
  const isTerminal = shift.status === "completed" || shift.status === "expired_no_result";

  return [
    hasValidated ? "completed" : isTerminal ? "disabled" : "active",
    hasProbed
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
  onGoLive: () => void;
  onRunProbe: () => void;
  onValidate: () => void;
  runningProbe: boolean;
  shift: ShiftView;
  validating: boolean;
}) {
  const { actionStatus, goingLive, runningProbe, shift, validating } = params;
  const [validateState, probeState, goLiveState] = getStepStates(shift);
  const phaseLabel = getPhaseLabel(shift.status);
  const trialStatus =
    shift.probesUsed === 0 ? "Available" : shift.remainingProbes > 0 ? "Completed" : "Used";
  const validatedDisplay = !shift.latestValidAt
    ? "No"
    : new Date(shift.latestValidAt).toLocaleTimeString("en-US", { hour12: false });

  return {
    dotClass:
      shift.status === "completed"
        ? "console-header__dot console-header__dot--completed"
        : shift.status === "expired_no_result"
          ? "console-header__dot console-header__dot--expired"
          : "console-header__dot",
    isCompleted: shift.status === "completed" || shift.status === "expired_no_result",
    isEvaluating: shift.status === "evaluating",
    phaseLabel,
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
    statusNotice: shift.finalEvaluation
      ? "Shift complete - policy submitted"
      : actionStatus || (shift.latestValidAt && !shift.latestValidationError
        ? "Module validated - ready to go live"
        : ""),
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
        label: "Trial Shift",
        loading: runningProbe,
        loadingLabel: "Running...",
        number: "2",
        state: probeState,
      },
      {
        action: params.onGoLive,
        label: "Go Live",
        loading: goingLive,
        loadingLabel: "Submitting...",
        number: "3",
        state: goLiveState,
      },
    ] as ActionStep[],
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
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
          setActionStatus(`${result.probeKind} probe complete.`);
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
