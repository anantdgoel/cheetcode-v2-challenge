"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ArtifactName, BoardCondition, ProbeSummary, ShiftView, Title } from "@/lib/types";
import { formatPercent, formatTitle } from "@/lib/exchange";

const ARTIFACTS: ArtifactName[] = ["manual.md", "starter.js", "lines.json", "observations.jsonl"];

const ARTIFACT_DISPLAY: Record<ArtifactName, string> = {
  "manual.md": "manual.md",
  "starter.js": "starter.js",
  "lines.json": "lines.json",
  "observations.jsonl": "call-log.jsonl",
};

type ActiveTab = ArtifactName | "editor";

type ShiftConsoleProps = {
  initialShift: ShiftView;
};

/* ── Helpers ── */

function formatCountdown(targetTime: number, now: number) {
  const remaining = Math.max(0, targetTime - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getPhaseLabel(status: ShiftView["status"]) {
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
  const d = new Date(shift.latestValidAt);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function titleToLineNumber(title: Title): string | null {
  switch (title) {
    case "chief_operator": return "01";
    case "senior_operator": return "02";
    case "operator": return "03";
    case "trainee": return "04";
    default: return null;
  }
}

function conditionDotClass(condition: BoardCondition) {
  return `console-trial__condition-dot console-trial__condition-dot--${condition === "overrun" ? "overrun" : condition === "strained" ? "strained" : "steady"}`;
}

type StepState = "completed" | "active" | "upcoming" | "disabled";

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

function formatIncidents(incidents: Array<{ second: number; note: string }>) {
  return incidents.map((i) => `t=${i.second}s — ${i.note}`).join("  ");
}

/* ── Manual renderer ── */

function renderManual(raw: string) {
  const lines = raw.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip the # title line — render separately at the top
    if (line.startsWith("# ")) {
      elements.push(<h2 key={key++} className="console-manual__title">{line.slice(2)}</h2>);
      i++;
      continue;
    }

    // ## Section heading — strip numbering like "## 1. "
    if (line.startsWith("## ")) {
      const heading = line.slice(3).replace(/^\d+\.\s*/, "");
      elements.push(<p key={key++} className="console-manual__heading">{heading}</p>);
      i++;
      continue;
    }

    // Indented code block (4 spaces)
    if (line.startsWith("    ")) {
      const codeLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) {
        codeLines.push(lines[i].slice(4));
        i++;
      }
      // trim trailing empty lines
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "") codeLines.pop();
      elements.push(<pre key={key++} className="console-manual__code">{codeLines.join("\n")}</pre>);
      continue;
    }

    // List item
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="console-manual__list">
          {items.map((item, j) => <li key={j}>{inlineCode(item)}</li>)}
        </ul>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (may span multiple non-blank lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("- ") && !lines[i].startsWith("    ")) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(<p key={key++} className="console-manual__para">{inlineCode(paraLines.join("\n"))}</p>);
  }

  return elements;
}

/** Replace `backtick` spans with <code> */
function inlineCode(text: string): React.ReactNode {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <code key={i}>{part}</code> : part,
  );
}

/* ── Notice helper ── */

function EditorNotice({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div className="console-editor__notice">
      <span className={`console-editor__notice-dot console-editor__notice-dot--${type}`} />
      <span className={`console-editor__notice-text console-editor__notice-text--${type}`}>
        {message}
      </span>
    </div>
  );
}

/* ── Context Card (right panel) ── */

function ContextCard({ shift, activeProbeSummary }: { shift: ShiftView; activeProbeSummary?: ProbeSummary }) {
  if (shift.finalEvaluation?.metrics) {
    const title = shift.finalEvaluation.title ?? "off_the_board";
    const line = titleToLineNumber(title);
    return (
      <div className="console-context-card console-context-card--final">
        <p className="console-final__eyebrow">Final Evaluation</p>
        <div className="console-final__classification">
          <span className="console-metric-label">Classification</span>
          <h2 className="console-final__title">{formatTitle(title)}</h2>
          <div className="console-final__badges">
            {line && <span className="console-final__line-badge">Line {line}</span>}
            <span className="console-final__board-certified">Board Certified</span>
          </div>
        </div>
        <hr className="console-divider" />
        <div>
          <span className="console-metric-label">Board Efficiency</span>
          <p className="console-metric-value console-metric-value--huge">
            {formatPercent(shift.finalEvaluation.metrics.efficiency)}
          </p>
        </div>
        <div className="console-final__calls">
          {[
            { label: "Connected", value: `${shift.finalEvaluation.metrics.connectedCalls} / ${shift.finalEvaluation.metrics.totalCalls}` },
            { label: "Dropped", value: String(shift.finalEvaluation.metrics.droppedCalls), danger: true },
          ].map(({ label, value, danger }) => (
            <div key={label} className="console-final__call-metric">
              <span className="console-metric-label">{label}</span>
              <span className={`console-metric-value${danger ? " console-metric-value--danger" : ""}`}>{value}</span>
            </div>
          ))}
        </div>
        <hr className="console-divider" />
        {shift.reportPublicId && (
          <Link href={`/report/${shift.reportPublicId}`} className="console-final__report-link">
            View Shift Report <span>&rarr;</span>
          </Link>
        )}
      </div>
    );
  }

  if (activeProbeSummary) {
    const trialMetrics = [
      [
        { label: "Efficiency", value: formatPercent(activeProbeSummary.metrics.efficiency), large: true },
        { label: "Connected", value: `${activeProbeSummary.metrics.connectedCalls} / ${activeProbeSummary.metrics.totalCalls}` },
      ],
      [
        { label: "Dropped", value: String(activeProbeSummary.metrics.droppedCalls), danger: true },
        { label: "Avg Hold", value: `${activeProbeSummary.metrics.avgHoldSeconds.toFixed(1)}s` },
      ],
    ];

    return (
      <div className="console-context-card">
        <p className="console-card-eyebrow">Trial Shift Results</p>
        <div className="console-trial__condition">
          <span className={conditionDotClass(activeProbeSummary.deskCondition)} />
          <span className="console-trial__condition-label">
            {activeProbeSummary.deskCondition.charAt(0).toUpperCase() + activeProbeSummary.deskCondition.slice(1)}
          </span>
        </div>
        {trialMetrics.map((row, ri) => (
          <div key={ri} className="console-trial__metrics">
            {row.map(({ label, value, large, danger }) => (
              <div key={label} className="console-trial__metric">
                <span className="console-metric-label">{label}</span>
                <span className={`console-metric-value${large ? " console-metric-value--large" : ""}${danger ? " console-metric-value--danger" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        ))}
        <hr className="console-divider" />
        <div className="console-trial__log">
          <span className="console-metric-label">Failure Log</span>
          <p className="console-trial__log-text">
            {activeProbeSummary.incidents.length > 0
              ? formatIncidents(activeProbeSummary.incidents.slice(0, 8))
              : "No incidents recorded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="console-context-card">
      <p className="console-card-eyebrow">Supervisor Console</p>
      <p className="console-supervisor__empty">
        No trial dispatched yet.{"\n"}Study the dossier. Write your policy. Validate when ready.
      </p>
    </div>
  );
}

/* ── Component ── */

export default function ShiftConsole({ initialShift }: ShiftConsoleProps) {
  const router = useRouter();
  const [shift, setShift] = useState(initialShift);
  const [draft, setDraft] = useState(initialShift.latestDraftSource);
  const [activeTab, setActiveTab] = useState<ActiveTab>("manual.md");
  const [artifactContents, setArtifactContents] = useState<Partial<Record<ArtifactName, string>>>({});
  const [now, setNow] = useState(Date.now());
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [validating, setValidating] = useState(false);
  const [runningProbe, setRunningProbe] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Mount/unmount guard + saveTimer cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect on completion
  useEffect(() => {
    if (shift.status === "completed" && shift.reportPublicId) {
      router.push(`/report/${shift.reportPublicId}`);
    }
  }, [shift.status, shift.reportPublicId, router]);

  // Artifact fetch
  const artifactToFetch = activeTab !== "editor" ? activeTab : null;
  useEffect(() => {
    if (!artifactToFetch || artifactContents[artifactToFetch]) return;

    let cancelled = false;
    const fetchArtifact = async () => {
      try {
        const response = await fetch(
          `/api/shifts/${shift.id}/artifacts/${encodeURIComponent(artifactToFetch)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const errorPayload = (await response.json()) as { error?: string };
          throw new Error(errorPayload.error ?? "Artifact unavailable");
        }
        const content = await response.text();
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
    return () => { cancelled = true; };
  }, [artifactToFetch, artifactContents, shift.id]);

  /* ── Actions ── */

  function scheduleSave(nextValue: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/shifts/${shift.id}/drafts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: nextValue }),
        });
        if (!mountedRef.current) return;
        if (response.ok) {
          setSavingState("saved");
          setTimeout(() => { if (mountedRef.current) setSavingState("idle"); }, 1200);
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
      const response = await fetch(`/api/shifts/${shift.id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Validation failed");
      setShift(data.shift);
      setActionStatus("Module validated — ready to go live");
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
      const response = await fetch(`/api/shifts/${shift.id}/probe`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Probe failed");
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
      const response = await fetch(`/api/shifts/${shift.id}/go-live`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Go Live failed");
      setShift(data.shift);
      setActionStatus("Shift complete — policy submitted");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Go Live failed");
    } finally {
      setGoingLive(false);
    }
  }

  /* ── Derived ── */

  const shiftIdShort = shift.id.slice(-6).toUpperCase();
  const phaseLabel = getPhaseLabel(shift.status);
  const trialStatus = getTrialStatus(shift);
  const validatedDisplay = getValidatedDisplay(shift);
  const canGoLiveDisplay = shift.canGoLive ? "Yes" : "No";
  const isCompleted = shift.status === "completed" || shift.status === "expired_no_result";
  const isEvaluating = shift.status === "evaluating";

  const activeProbeSummary = shift.probeEvaluations
    .filter((e) => e.state === "completed" && e.probeSummary)
    .at(-1)?.probeSummary as ProbeSummary | undefined;

  const [s1, s2, s3] = getStepStates(shift);

  const dotClass = isCompleted
    ? "console-header__dot console-header__dot--completed"
    : shift.status === "expired_no_result"
      ? "console-header__dot console-header__dot--expired"
      : "console-header__dot";

  const statusNotice = shift.finalEvaluation
    ? "Shift complete — policy submitted"
    : shift.latestValidAt && !shift.latestValidationError
      ? "Module validated — ready to go live"
      : null;

  const readoutFields = [
    [
      { label: "Phase", value: shift.status === "active_phase_1" ? "Phase 1" : shift.status === "active_phase_2" ? "Phase 2" : phaseLabel, modifier: "" },
      { label: "Trial", value: trialStatus, modifier: trialStatus !== "Available" ? " console-readout__value--green" : "" },
    ],
    [
      { label: "Validated", value: validatedDisplay, modifier: validatedDisplay === "No" ? " console-readout__value--muted" : "" },
      { label: "Can Go Live", value: canGoLiveDisplay, modifier: shift.canGoLive ? " console-readout__value--green" : " console-readout__value--muted" },
    ],
  ];

  const steps: Array<{ state: StepState; number: string; label: string; loading: boolean; loadingLabel: string; action: () => void }> = [
    { state: s1, number: "1", label: "Validate", loading: validating, loadingLabel: "Validating...", action: () => { setActiveTab("editor"); void validateDraft(); } },
    { state: s2, number: "2", label: "Trial Shift", loading: runningProbe, loadingLabel: "Running...", action: () => void runProbe() },
    { state: s3, number: "3", label: "Go Live", loading: goingLive, loadingLabel: "Submitting...", action: () => void goLive() },
  ];

  return (
    <div className="console-shell">
      {/* ── Header ── */}
      <header className="console-header">
        <div className="console-header__left">
          <span className="console-header__brand">Firecrawl</span>
          <span className="console-header__sep" />
          <span className="console-header__shift">Shift #{shiftIdShort}</span>
        </div>
        <div className="console-header__right">
          <span className="console-header__phase">
            <span className={dotClass} />
            {phaseLabel}
          </span>
          <span className="console-header__clock">
            {formatCountdown(shift.expiresAt, now)}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="console-body">
        {/* ── Left Panel ── */}
        <div className="console-left">
          <div className="console-tabs">
            {ARTIFACTS.map((name) => (
              <button
                key={name}
                type="button"
                className={`console-tab${activeTab === name ? " console-tab--active" : ""}`}
                onClick={() => setActiveTab(name)}
              >
                {ARTIFACT_DISPLAY[name]}
              </button>
            ))}
            <button
              type="button"
              className={`console-tab console-tab--editor${activeTab === "editor" ? " console-tab--editor-active" : " console-tab--editor-inactive"}`}
              onClick={() => setActiveTab("editor")}
            >
              Editor
            </button>
          </div>

          {activeTab !== "editor" ? (
            <div className="console-content">
              {artifactContents[activeTab]
                ? activeTab === "manual.md"
                  ? renderManual(artifactContents[activeTab]!)
                  : <pre>{artifactContents[activeTab]}</pre>
                : <p className="console-supervisor__empty">Loading artifact...</p>}
            </div>
          ) : (
            <div className="console-editor">
              <div className="console-editor__header">
                <span className="eyebrow">Operator Policy</span>
                {savingState !== "idle" && (
                  <span className="console-editor__save">
                    <span className={`console-editor__save-dot console-editor__save-dot--${savingState}`} />
                    {savingState === "saved" ? "Saved" : "Saving..."}
                  </span>
                )}
              </div>
              <div className="console-editor__textarea-wrap">
                <textarea
                  className={`console-editor__textarea${isCompleted ? " console-editor__textarea--readonly" : ""}`}
                  value={draft}
                  readOnly={isCompleted || isEvaluating}
                  spellCheck={false}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setDraft(nextValue);
                    scheduleSave(nextValue);
                  }}
                />
              </div>
              {actionError ? (
                <EditorNotice type="error" message={actionError} />
              ) : shift.latestValidationError ? (
                <EditorNotice type="error" message={shift.latestValidationError} />
              ) : statusNotice ? (
                <EditorNotice type="success" message={statusNotice} />
              ) : null}
            </div>
          )}

          {/* Action bar */}
          <div className="console-action-bar">
            {steps.map((step, i) => (
              <span key={step.number} style={{ display: "contents" }}>
                {i > 0 && <span className="action-bar__chevron">&rarr;</span>}
                <button
                  type="button"
                  className={`action-step action-step--${step.state}`}
                  disabled={step.state === "disabled" || step.state === "completed" || (step.state === "upcoming") || step.loading}
                  onClick={step.action}
                >
                  <span className="action-step__number">{step.number}</span>
                  {step.loading ? step.loadingLabel : step.state === "completed" ? `${step.label} \u2713` : step.label}
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="console-right">
          <div className="console-readout">
            <p className="console-card-eyebrow">Board Readout</p>
            <h2 className="console-readout__title">Operational State</h2>
            <div className="console-readout__grid">
              {readoutFields.map((row, ri) => (
                <div key={ri} className="console-readout__row">
                  {row.map(({ label, value, modifier }) => (
                    <div key={label} className="console-readout__field">
                      <span className="console-readout__label">{label}</span>
                      <span className={`console-readout__value${modifier}`}>{value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <ContextCard shift={shift} activeProbeSummary={activeProbeSummary} />
        </div>
      </div>

      <div className="desktop-only-gate">
        <h2>Desktop Required</h2>
        <p>The shift console requires a desktop browser.</p>
      </div>
    </div>
  );
}
