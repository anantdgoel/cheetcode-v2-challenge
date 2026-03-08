'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import type { ShiftView } from '@/lib/domain/views'
import {
  formatCountdown,
  getAmbientNotice,
  getClockTone,
  getPhaseLabel,
  getTimeCueLabel
} from './shift-console-state'

type ShiftConsoleTimingState = {
  clockTone: ReturnType<typeof getClockTone>;
  countdownLabel: string;
  dotClass: string;
  phaseLabel: string;
  statusNotice: string;
  statusNoticeTone: 'success' | 'warning';
  timeCueLabel: string;
};

const ShiftConsoleTimingContext = createContext<ShiftConsoleTimingState | null>(null)

function useShiftNow () {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return now
}

export function ShiftConsoleTimingProvider ({
  actionStatus,
  children,
  shift
}: {
  actionStatus: string;
  children: ReactNode;
  shift: ShiftView;
}) {
  const now = useShiftNow()
  const phaseLabel = getPhaseLabel(shift.status)
  const clockTone = getClockTone(shift, now)
  const ambientNotice = getAmbientNotice({ actionStatus, clockTone, shift })

  return (
    <ShiftConsoleTimingContext.Provider
      value={{
        clockTone,
        countdownLabel: formatCountdown(shift.expiresAt, now),
        dotClass:
          shift.status === 'completed'
            ? 'console-header__dot console-header__dot--completed'
            : shift.status === 'expired_no_result'
              ? 'console-header__dot console-header__dot--expired'
              : 'console-header__dot',
        phaseLabel,
        statusNotice: ambientNotice.message,
        statusNoticeTone: ambientNotice.tone,
        timeCueLabel: getTimeCueLabel(shift, clockTone)
      }}
    >
      {children}
    </ShiftConsoleTimingContext.Provider>
  )
}

export function useShiftConsoleTiming () {
  const value = useContext(ShiftConsoleTimingContext)
  if (!value) {
    throw new Error('useShiftConsoleTiming must be used within ShiftConsoleTimingProvider')
  }
  return value
}
