'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useSaveDraft } from '../convex-api'
import { extractErrorMessage } from '@/lib/convex-error'
import type { SavingState } from '../types'

export function useDraftAutosave (
  shiftId: string,
  setConsoleError: Dispatch<SetStateAction<string>>
) {
  const [savingState, setSavingState] = useState<SavingState>('idle')
  const isMountedRef = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDraft = useSaveDraft()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current)
    }
  }, [])

  function scheduleSave (nextValue: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current)

    setSavingState('saving')
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await saveDraft(shiftId, nextValue)
          if (!isMountedRef.current) return
          setConsoleError('')
          setSavingState('saved')
          saveResetTimer.current = setTimeout(() => {
            if (isMountedRef.current) setSavingState('idle')
          }, 1200)
        } catch (error) {
          if (isMountedRef.current) {
            setSavingState('idle')
            setConsoleError(extractErrorMessage(error, 'Draft save failed'))
          }
        }
      })()
    }, 500)
  }

  return { savingState, scheduleSave }
}
