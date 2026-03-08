'use client'

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { saveDraft } from '../api'
import type { SavingState } from '../types'

export function useDraftAutosave (
  shiftId: string,
  mountedRef: RefObject<boolean>,
  setConsoleError: Dispatch<SetStateAction<string>>
) {
  const [savingState, setSavingState] = useState<SavingState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
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
          const response = await saveDraft(shiftId, nextValue)
          if (!mountedRef.current) return
          if (!response.ok) {
            setSavingState('idle')
            setConsoleError('Draft save failed')
            return
          }
          setConsoleError('')
          setSavingState('saved')
          saveResetTimer.current = setTimeout(() => {
            if (mountedRef.current) setSavingState('idle')
          }, 1200)
        } catch (error) {
          if (mountedRef.current) {
            setSavingState('idle')
            setConsoleError(error instanceof Error ? error.message : 'Draft save failed')
          }
        }
      })()
    }, 500)
  }

  return { savingState, scheduleSave }
}
