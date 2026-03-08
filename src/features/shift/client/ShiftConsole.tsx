'use client'

import type { ShiftView } from '@/core/domain/views'
import { useShiftConsole } from './hooks/use-shift-console'
import { ShiftConsoleActionBar } from './components/ShiftConsoleActionBar'
import { ShiftConsoleArtifactPanel } from './components/ShiftConsoleArtifactPanel'
import { ShiftConsoleBoardReadout } from './components/ShiftConsoleBoardReadout'
import { ShiftConsoleContextCard } from './components/ShiftConsoleContextCard'
import { ShiftConsoleHeader } from './components/ShiftConsoleHeader'

export default function ShiftConsole ({ initialShift }: { initialShift: ShiftView }) {
  const consoleState = useShiftConsole(initialShift)

  const handleDraftChange = (value: string) => {
    consoleState.setDraft(value)
    consoleState.scheduleSave(value)
  }

  const handleTabChange = consoleState.setActiveTab

  return (
    <div className='console-shell'>
      <ShiftConsoleHeader
        shift={consoleState.shift}
        shiftIdShort={consoleState.shiftIdShort}
      />

      <div className='console-body'>
        <div className='console-left'>
          <ShiftConsoleArtifactPanel
            actionStatus={consoleState.actionStatus}
            activeTab={consoleState.activeTab}
            artifactContents={consoleState.artifactContents}
            draft={consoleState.draft}
            isCompleted={consoleState.isCompleted}
            isEvaluating={consoleState.isEvaluating}
            latestValidationError={consoleState.actionError || consoleState.consoleError || consoleState.shift.latestValidationError}
            onDraftChange={handleDraftChange}
            onTabChange={handleTabChange}
            savingState={consoleState.savingState}
            shift={consoleState.shift}
          />
          <ShiftConsoleActionBar steps={consoleState.steps} />
        </div>

        <div className='console-right'>
          <ShiftConsoleBoardReadout readoutFields={consoleState.readoutFields} />
          <ShiftConsoleContextCard
            actionStatus={consoleState.actionStatus}
            activeProbeSummary={consoleState.activeProbeSummary}
            shift={consoleState.shift}
          />
        </div>
      </div>

      <div className='desktop-only-gate'>
        <h2>Desktop Required</h2>
        <p>The shift console requires a desktop browser.</p>
      </div>
    </div>
  )
}
