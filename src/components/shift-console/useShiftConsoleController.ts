"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ArtifactName, ProbeSummary } from "@/lib/contracts/game";
import type { ShiftView } from "@/lib/contracts/views";
import { fetchArtifactContent, goLive as submitGoLive, runProbe as submitProbe, saveDraft as submitDraftSave, validateDraft as submitValidate } from "./shift-console-api";
import { getShiftConsoleViewModel } from "./shift-console-view-model";
import type { ActiveTab, SavingState } from "./types";

export const ARTIFACTS: ArtifactName[] = ["manual.md", "starter.js", "lines.json", "observations.jsonl"];

export const ARTIFACT_DISPLAY: Record<ArtifactName, string> = {
  "manual.md": "manual.md",
  "starter.js": "starter.js",
  "lines.json": "lines.json",
  "observations.jsonl": "call-log.jsonl",
};

export function useShiftConsoleController(initialShift: ShiftView) {
  const router = useRouter();
  const [shift, setShift] = useState(initialShift);
  const [draft, setDraft] = useState(initialShift.latestDraftSource);
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual.md");
  const [artifactContents, setArtifactContents] = useState<Partial<Record<ArtifactName, string>>>({});
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

  const artifactToFetch = activeTab !== "editor" ? activeTab : null;
  useEffect(() => {
    if (!artifactToFetch || artifactContents[artifactToFetch]) return;

    let cancelled = false;
    const fetchArtifact = async () => {
      try {
        const content = await fetchArtifactContent(shift.id, artifactToFetch);
        if (!cancelled) {
          setArtifactContents((current) => ({ ...current, [artifactToFetch]: content }));
        }
      } catch (error) {
        if (!cancelled) {
          setArtifactContents((current) => ({
            ...current,
            [artifactToFetch]: error instanceof Error ? error.message : "Artifact unavailable",
          }));
        }
      }
    };

    void fetchArtifact();
    return () => {
      cancelled = true;
    };
  }, [artifactContents, artifactToFetch, shift.id]);

  function scheduleSave(nextValue: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await submitDraftSave(shift.id, nextValue);
        if (!mountedRef.current) return;
        if (response.ok) {
          setSavingState("saved");
          saveResetTimer.current = setTimeout(() => {
            if (mountedRef.current) setSavingState("idle");
          }, 1200);
        } else {
          setSavingState("idle");
        }
      } catch {
        if (!mountedRef.current) return;
        setSavingState("idle");
      }
    }, 500);
  }

  async function validateDraft() {
    setValidating(true);
    setActionError("");
    setActionStatus("");
    try {
      const data = await submitValidate(shift.id, draft);
      const nextShift = data.shift;
      if (nextShift) setShift(nextShift);
      setActionStatus("Module validated - ready to go live");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function runProbe() {
    setRunningProbe(true);
    setActionError("");
    setActionStatus("");
    try {
      const data = await submitProbe(shift.id);
      setShift(data.shift);
      setActionStatus(`${data.probeKind} probe complete.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Probe failed");
    } finally {
      setRunningProbe(false);
    }
  }

  async function goLive() {
    setGoingLive(true);
    setActionError("");
    setActionStatus("");
    try {
      const data = await submitGoLive(shift.id);
      setShift(data.shift);
      setActionStatus("Shift complete - policy submitted");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Go Live failed");
    } finally {
      setGoingLive(false);
    }
  }

  const shiftIdShort = shift.id.slice(-6).toUpperCase();
  const activeProbeSummary = shift.probeEvaluations
    .filter((evaluation) => evaluation.state === "completed" && evaluation.probeSummary)
    .at(-1)?.probeSummary as ProbeSummary | undefined;
  const { dotClass, isCompleted, isEvaluating, phaseLabel, readoutFields, statusNotice, steps } =
    getShiftConsoleViewModel({
      shift,
      now,
      validating,
      runningProbe,
      goingLive,
      actionStatus,
      onValidate: () => {
        setActiveTab("editor");
        void validateDraft();
      },
      onRunProbe: () => void runProbe(),
      onGoLive: () => void goLive(),
    });

  return {
    actionError,
    activeProbeSummary,
    activeTab,
    artifactContents,
    dotClass,
    draft,
    isCompleted,
    isEvaluating,
    now,
    phaseLabel,
    readoutFields,
    savingState,
    setActiveTab,
    setDraft,
    shift,
    shiftIdShort,
    statusNotice,
    steps,
    scheduleSave,
  };
}
