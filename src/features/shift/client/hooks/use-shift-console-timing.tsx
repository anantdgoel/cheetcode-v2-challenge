'use client'

import {
  startTransition,
  useSyncExternalStore
} from 'react'
import type { ShiftView } from '@/core/domain/views'
import {
  formatCountdown,
  getAmbientNotice,
  getClockTone,
  getPhaseLabel,
  getTimeCueLabel
} from '../selectors'

type ShiftConsoleTimingParams = {
  actionStatus: string;
  shift: ShiftView;
}

export type ShiftConsoleTimingState = {
  clockTone: ReturnType<typeof getClockTone>;
  countdownLabel: string;
  dotClass: string;
  phaseLabel: string;
  statusNotice: string;
  statusNoticeTone: 'success' | 'warning';
  timeCueLabel: string;
}

let currentNow = Date.now()
let nowTimer: ReturnType<typeof setInterval> | null = null
const nowListeners = new Set<() => void>()

function getNowSnapshot () {
  return currentNow
}

function publishNow () {
  currentNow = Date.now()
  startTransition(() => {
    nowListeners.forEach((listener) => listener())
  })
}

function subscribeToNow (listener: () => void) {
  nowListeners.add(listener)

  if (nowListeners.size === 1) {
    currentNow = Date.now()
    nowTimer = setInterval(publishNow, 1000)
  }

  return () => {
    nowListeners.delete(listener)
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer)
      nowTimer = null
    }
  }
}

function useShiftNow () {
  return useSyncExternalStore(subscribeToNow, getNowSnapshot, getNowSnapshot)
}

export function useShiftConsoleTiming ({
  actionStatus,
  shift
}: ShiftConsoleTimingParams): ShiftConsoleTimingState {
  const now = useShiftNow()
  const phaseLabel = getPhaseLabel(shift.status)
  const clockTone = getClockTone(shift, now)
  const ambientNotice = getAmbientNotice({ actionStatus, clockTone, shift })

  return {
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
  }
}
