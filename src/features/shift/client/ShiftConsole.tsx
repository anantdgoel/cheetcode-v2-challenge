'use client'

import type { ShiftView } from '@/core/domain/views'
import { useShiftConsole } from './hooks/use-shift-console'
import { ShiftConsoleActionBar } from './components/ShiftConsoleActionBar'
import { ShiftConsoleArtifactPanel } from './components/ShiftConsoleArtifactPanel'
import { ShiftConsoleBoardReadout } from './components/ShiftConsoleBoardReadout'
import { ShiftConsoleContextCard } from './components/ShiftConsoleContextCard'
import { ShiftConsoleHeader } from './components/ShiftConsoleHeader'

export default function ShiftConsole ({ shift }: { shift: ShiftView }) {
  return <ShiftConsoleScreen key={shift.id} shift={shift} />
}

function ShiftConsoleScreen ({ shift }: { shift: ShiftView }) {
  const consoleState = useShiftConsole(shift)

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

      {consoleState.isEvaluating && (
        <div className='console-live-modal' role='dialog' aria-modal='true' aria-labelledby='live-room-title'>
          <div className='console-live-modal__backdrop' />
          <div className='console-live-modal__card'>
            <div className='console-live-modal__signal' aria-hidden='true'>
              <span className='console-live-modal__lamp console-live-modal__lamp--primary' />
              <span className='console-live-modal__lamp console-live-modal__lamp--secondary' />
              <span className='console-live-modal__lamp console-live-modal__lamp--tertiary' />
            </div>
            <p className='console-live-modal__eyebrow'>Live Room Engaged</p>
            <h2 id='live-room-title' className='console-live-modal__title'>Chief operator reading your board</h2>
            <p className='console-live-modal__body'>
              Hold the line. Central Office is completing the final board read — your shift report will open automatically.
            </p>
          </div>
        </div>
      )}

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
