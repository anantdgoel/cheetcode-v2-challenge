'use client'

import { useShiftConsoleTiming } from './shift-console-timing'

export function ShiftConsoleHeader ({ shiftIdShort }: { shiftIdShort: string }) {
  const timing = useShiftConsoleTiming()

  return (
    <header className={`console-header console-header--${timing.clockTone}`}>
      <div className="console-header__left">
        <span className="console-header__brand">Firecrawl</span>
        <span className="console-header__sep" />
        <span className="console-header__shift">Shift #{shiftIdShort}</span>
      </div>
      <div className="console-header__right">
        <div className="console-header__meta">
          <span className="console-header__phase">
            <span className={timing.dotClass} />
            {timing.phaseLabel}
          </span>
          {timing.timeCueLabel && (
            <span className={`console-header__cue console-header__cue--${timing.clockTone}`}>
              {timing.timeCueLabel}
            </span>
          )}
        </div>
        <span className={`console-header__clock console-header__clock--${timing.clockTone}`}>
          {timing.countdownLabel}
        </span>
      </div>
    </header>
  )
}
