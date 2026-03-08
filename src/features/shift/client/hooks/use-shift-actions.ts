'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ShiftView } from '@/core/domain/views'
import { goLive, runProbe, validateDraft } from '../api'
import type { ActiveTab } from '../types'

function getProbeCompletionMessage (probeKind: ShiftView['nextProbeKind'] | 'fit' | 'stress') {
  return probeKind === 'fit'
    ? 'Day room read complete.'
    : 'Rush room read complete.'
}

export function useShiftActions (params: {
  draft: string;
  setActionError: Dispatch<SetStateAction<string>>;
  setActionStatus: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
  setShift: Dispatch<SetStateAction<ShiftView>>;
  shift: ShiftView;
}) {
  const [validating, setValidating] = useState(false)
  const [runningProbe, setRunningProbe] = useState(false)
  const [goingLive, setGoingLive] = useState(false)

  function toActionMessage (error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
  }

  async function runShiftAction<Result> (config: {
    fallbackError: string;
    onBeforeAction?: () => void;
    onSuccess: (result: Result) => void;
    request: () => Promise<Result>;
    stateSetter: Dispatch<SetStateAction<boolean>>;
  }) {
    config.onBeforeAction?.()
    await handleAction(config.stateSetter, async () => {
      try {
        const result = await config.request()
        config.onSuccess(result)
      } catch (error) {
        params.setActionError(toActionMessage(error, config.fallbackError))
      }
    })
  }

  async function handleAction (
    stateSetter: Dispatch<SetStateAction<boolean>>,
    action: () => Promise<void>
  ) {
    stateSetter(true)
    params.setActionError('')
    params.setActionStatus('')
    try {
      await action()
    } finally {
      stateSetter(false)
    }
  }

  return {
    goingLive,
    onGoLive: () => {
      void runShiftAction({
        fallbackError: 'Go Live failed',
        onSuccess: (result) => {
          params.setShift(result.shift)
          params.setActionStatus('Shift complete - policy submitted')
        },
        request: () => goLive(params.shift.id),
        stateSetter: setGoingLive
      })
    },
    onRunProbe: () => {
      void runShiftAction({
        fallbackError: 'Probe failed',
        onSuccess: (result) => {
          params.setShift(result.shift)
          params.setActionStatus(getProbeCompletionMessage(result.probeKind))
        },
        request: () => runProbe(params.shift.id),
        stateSetter: setRunningProbe
      })
    },
    onValidate: () => {
      void runShiftAction({
        fallbackError: 'Validation failed',
        onBeforeAction: () => {
          params.setActiveTab('editor')
        },
        onSuccess: (result) => {
          if (result.shift) params.setShift(result.shift)
          params.setActionStatus('Module validated - ready to go live')
        },
        request: () => validateDraft(params.shift.id, params.draft),
        stateSetter: setValidating
      })
    },
    runningProbe,
    validating
  }
}
