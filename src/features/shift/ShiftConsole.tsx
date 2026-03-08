"use client";

import type { ShiftView } from "@/lib/domain/views";
import { ShiftConsoleActionBar } from "./ShiftConsoleActionBar";
import { ShiftConsoleArtifactPanel } from "./ShiftConsoleArtifactPanel";
import { ShiftConsoleBoardReadout } from "./ShiftConsoleBoardReadout";
import { ShiftConsoleContextCard } from "./ShiftConsoleContextCard";
import { formatCountdown, useShiftConsole } from "./shift-console-state";

export default function ShiftConsole({ initialShift }: { initialShift: ShiftView }) {
  const consoleState = useShiftConsole(initialShift);

  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="console-header__left">
          <span className="console-header__brand">Firecrawl</span>
          <span className="console-header__sep" />
          <span className="console-header__shift">Shift #{consoleState.shiftIdShort}</span>
        </div>
        <div className="console-header__right">
          <span className="console-header__phase">
            <span className={consoleState.dotClass} />
            {consoleState.phaseLabel}
          </span>
          <span className="console-header__clock">
            {formatCountdown(consoleState.shift.expiresAt, consoleState.now)}
          </span>
        </div>
      </header>

      <div className="console-body">
        <div className="console-left">
          <ShiftConsoleArtifactPanel
            activeTab={consoleState.activeTab}
            artifactContents={consoleState.artifactContents}
            draft={consoleState.draft}
            isCompleted={consoleState.isCompleted}
            isEvaluating={consoleState.isEvaluating}
            latestValidationError={consoleState.actionError || consoleState.shift.latestValidationError}
            onDraftChange={(value) => {
              consoleState.setDraft(value);
              consoleState.scheduleSave(value);
            }}
            onTabChange={consoleState.setActiveTab}
            savingState={consoleState.savingState}
            statusNotice={consoleState.statusNotice}
          />
          <ShiftConsoleActionBar steps={consoleState.steps} />
        </div>

        <div className="console-right">
          <ShiftConsoleBoardReadout readoutFields={consoleState.readoutFields} />
          <ShiftConsoleContextCard
            shift={consoleState.shift}
            activeProbeSummary={consoleState.activeProbeSummary}
          />
        </div>
      </div>

      <div className="desktop-only-gate">
        <h2>Desktop Required</h2>
        <p>The shift console requires a desktop browser.</p>
      </div>
    </div>
  );
}
