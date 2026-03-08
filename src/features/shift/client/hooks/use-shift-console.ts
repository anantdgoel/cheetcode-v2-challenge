'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ShiftView } from '@/core/domain/views'
import { deriveShiftConsoleState } from '../selectors'
import type { ActiveTab } from '../types'
import { useDraftAutosave } from './use-draft-autosave'
import { useMountedRef } from './use-mounted-ref'
import { useShiftActions } from './use-shift-actions'
import { useShiftArtifacts } from './use-shift-artifacts'
import { useShiftExpiryResolution } from './use-expiry-resolution'

function useCompletionRedirect (
  reportPublicId: string | undefined,
  status: ShiftView['status']
) {
  const router = useRouter()

  useEffect(() => {
    if (status === 'completed' && reportPublicId) {
      router.push(`/report/${reportPublicId}`)
    }
  }, [reportPublicId, router, status])
}

export function useShiftConsole (initialShift: ShiftView) {
  const mountedRef = useMountedRef()
  const [shift, setShift] = useState(initialShift)
  const [draft, setDraft] = useState(initialShift.latestDraftSource)
  const [activeTab, setActiveTab] = useState<ActiveTab>('manual.md')
  const [actionError, setActionError] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [consoleError, setConsoleError] = useState('')
  const artifactContents = useShiftArtifacts(shift.id, activeTab)
  const { savingState, scheduleSave } = useDraftAutosave(shift.id, mountedRef, setConsoleError)

  useCompletionRedirect(shift.reportPublicId, shift.status)
  useShiftExpiryResolution(shift, setShift, mountedRef, setConsoleError)

  const actions = useShiftActions({
    draft,
    setActionError,
    setActionStatus,
    setActiveTab,
    setShift,
    shift
  })

  const activeProbeSummary = shift.probeEvaluations
    .filter((evaluation) => evaluation.state === 'completed' && evaluation.probeSummary)
    .at(-1)?.probeSummary
  const consoleState = deriveShiftConsoleState({
    goingLive: actions.goingLive,
    onGoLive: actions.onGoLive,
    onRunProbe: actions.onRunProbe,
    onValidate: actions.onValidate,
    runningProbe: actions.runningProbe,
    shift,
    validating: actions.validating
  })

  return {
    actionError,
    actionStatus,
    activeProbeSummary,
    activeTab,
    artifactContents,
    draft,
    consoleError,
    savingState,
    scheduleSave,
    setActiveTab,
    setDraft,
    shift,
    shiftIdShort: shift.id.slice(-6).toUpperCase(),
    ...consoleState
  }
}
