'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ShiftView } from '@/core/domain/views'
import { useGoLive, useRunProbe, useValidateDraft } from '../convex-api'
import { getProbeCompletionMessage } from '../selectors'
import type { ActiveTab } from '../types'

export function useShiftActions (params: {
  draft: string;
  setActionError: Dispatch<SetStateAction<string>>;
  setActionStatus: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
  shift: ShiftView;
}) {
  const [validating, setValidating] = useState(false)
  const [runningProbe, setRunningProbe] = useState(false)
  const [goingLive, setGoingLive] = useState(false)

  const validateDraft = useValidateDraft()
  const runProbe = useRunProbe()
  const goLive = useGoLive()

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
    config.stateSetter(true)
    params.setActionError('')
    params.setActionStatus('')
    try {
      const result = await config.request()
      config.onSuccess(result)
    } catch (error) {
      params.setActionError(toActionMessage(error, config.fallbackError))
    } finally {
      config.stateSetter(false)
    }
  }

  return {
    goingLive,
    onGoLive: () => {
      void runShiftAction({
        fallbackError: 'Go Live failed',
        onSuccess: () => {
          params.setActionStatus('Live room engaged. Chief operator reading your board...')
        },
        request: () => goLive(params.shift.id),
        stateSetter: setGoingLive
      })
    },
    onRunProbe: () => {
      void runShiftAction({
        fallbackError: 'Probe failed',
        onSuccess: (result: { probeKind: string }) => {
          params.setActionStatus(getProbeCompletionMessage(result.probeKind as 'fit' | 'stress'))
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
        onSuccess: () => {
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
