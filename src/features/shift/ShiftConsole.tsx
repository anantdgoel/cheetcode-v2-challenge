'use client'

import type { ShiftView } from '@/lib/domain/views'
import { ShiftConsoleHeader } from './ShiftConsoleHeader'
import { ShiftConsoleActionBar } from './ShiftConsoleActionBar'
import { ShiftConsoleArtifactPanel } from './ShiftConsoleArtifactPanel'
import { ShiftConsoleBoardReadout } from './ShiftConsoleBoardReadout'
import { ShiftConsoleContextCard } from './ShiftConsoleContextCard'
import { useShiftConsole } from './shift-console-state'
import { ShiftConsoleTimingProvider } from './shift-console-timing'

export default function ShiftConsole ({ initialShift }: { initialShift: ShiftView }) {
  const consoleState = useShiftConsole(initialShift)

  return (
    <ShiftConsoleTimingProvider actionStatus={consoleState.actionStatus} shift={consoleState.shift}>
      <div className="console-shell">
        <ShiftConsoleHeader shiftIdShort={consoleState.shiftIdShort} />

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
                consoleState.setDraft(value)
                consoleState.scheduleSave(value)
              }}
              onTabChange={consoleState.setActiveTab}
              savingState={consoleState.savingState}
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
    </ShiftConsoleTimingProvider>
  )
}
