'use client'

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
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
  const [expired, setExpired] = useState(() => Date.now() >= shift.expiresAt)

  useEffect(() => {
    return () => {
      if (expiryPollTimer.current) clearTimeout(expiryPollTimer.current)
    }
  }, [])

  // Fire a timeout at exactly expiresAt to flip the expired flag
  useEffect(() => {
    if (expired) return
    const delay = Math.max(0, shift.expiresAt - Date.now())
    const timer = setTimeout(() => setExpired(true), delay)
    return () => clearTimeout(timer)
  }, [shift.expiresAt, expired])

  // Start polling once expired — the expired flag changing triggers this effect
  useEffect(() => {
    if (
      !expired ||
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
  }, [expired, mountedRef, setConsoleError, setShift, shift.id, shift.status])
}
