'use client'

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { ShiftView } from '@/core/domain/views'
import { fetchShift } from '../api'

export function useShiftExpiryResolution (
  shift: ShiftView,
  setShift: Dispatch<SetStateAction<ShiftView>>,
  mountedRef: RefObject<boolean>,
  setConsoleError: Dispatch<SetStateAction<string>>
) {
  const expiryPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvingExpiryRef = useRef(false)

  useEffect(() => {
    return () => {
      if (expiryPollTimer.current) clearTimeout(expiryPollTimer.current)
    }
  }, [])

  useEffect(() => {
    if (
      Date.now() < shift.expiresAt ||
      shift.status === 'completed' ||
      shift.status === 'expired_no_result' ||
      resolvingExpiryRef.current
    ) {
      return
    }

    resolvingExpiryRef.current = true

    const refreshUntilResolved = async () => {
      try {
        const result = await fetchShift(shift.id)
        if (!mountedRef.current) return

        setConsoleError('')
        setShift(result.shift)
        if (result.shift.status === 'completed' || result.shift.status === 'expired_no_result') {
          resolvingExpiryRef.current = false
          return
        }
      } catch (error) {
        if (mountedRef.current) {
          setConsoleError(error instanceof Error ? error.message : 'Shift refresh failed')
        }
      }

      if (!mountedRef.current) return
      expiryPollTimer.current = setTimeout(() => {
        void refreshUntilResolved()
      }, 500)
    }

    void refreshUntilResolved()

    return () => {
      if (expiryPollTimer.current) clearTimeout(expiryPollTimer.current)
      resolvingExpiryRef.current = false
    }
  }, [mountedRef, setConsoleError, setShift, shift.expiresAt, shift.id, shift.status])
}
