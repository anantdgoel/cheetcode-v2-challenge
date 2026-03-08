"use client";

import { ShiftConsoleActionBar } from "@/components/shift-console/ShiftConsoleActionBar";
import { ShiftConsoleArtifactPanel } from "@/components/shift-console/ShiftConsoleArtifactPanel";
import { ShiftConsoleBoardReadout } from "@/components/shift-console/ShiftConsoleBoardReadout";
import { ShiftConsoleContextCard } from "@/components/shift-console/ShiftConsoleContextCard";
import type { ShiftView } from "@/lib/contracts/views";
import { useShiftConsoleController } from "@/components/shift-console/useShiftConsoleController";
import { formatCountdown } from "@/components/shift-console/shift-console-view-model";

type ShiftConsoleProps = {
  initialShift: ShiftView;
};

export default function ShiftConsole({ initialShift }: ShiftConsoleProps) {
  const controller = useShiftConsoleController(initialShift);

  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="console-header__left">
          <span className="console-header__brand">Firecrawl</span>
          <span className="console-header__sep" />
          <span className="console-header__shift">Shift #{controller.shiftIdShort}</span>
        </div>
        <div className="console-header__right">
          <span className="console-header__phase">
            <span className={controller.dotClass} />
            {controller.phaseLabel}
          </span>
          <span className="console-header__clock">
            {formatCountdown(controller.shift.expiresAt, controller.now)}
          </span>
        </div>
      </header>

      <div className="console-body">
        <div className="console-left">
          <ShiftConsoleArtifactPanel
            activeTab={controller.activeTab}
            artifactContents={controller.artifactContents}
            draft={controller.draft}
            isCompleted={controller.isCompleted}
            isEvaluating={controller.isEvaluating}
            latestValidationError={controller.actionError || controller.shift.latestValidationError}
            onDraftChange={(value) => {
              controller.setDraft(value);
              controller.scheduleSave(value);
            }}
            onTabChange={controller.setActiveTab}
            savingState={controller.savingState}
            statusNotice={controller.statusNotice}
          />
          <ShiftConsoleActionBar steps={controller.steps} />
        </div>

        <div className="console-right">
          <ShiftConsoleBoardReadout readoutFields={controller.readoutFields} />
          <ShiftConsoleContextCard
            shift={controller.shift}
            activeProbeSummary={controller.activeProbeSummary}
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
