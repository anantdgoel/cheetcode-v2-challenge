'use client'

import { useEffect, useEffectEvent, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ShiftView } from '@/core/domain/views'
import { useResolveShiftExpiry } from '../convex-api'

export function useShiftExpiryResolution (
  shift: ShiftView,
  setConsoleError: Dispatch<SetStateAction<string>>
) {
  const resolveShiftExpiry = useResolveShiftExpiry()
  const hasRequestedResolutionRef = useRef(false)

  const requestResolution = useEffectEvent(async () => {
    hasRequestedResolutionRef.current = true
    setConsoleError('')

    try {
      await resolveShiftExpiry(shift.id)
    } catch (error) {
      hasRequestedResolutionRef.current = false
      setConsoleError(error instanceof Error ? error.message : 'Shift resolution failed')
    }
  })

  useEffect(() => {
    if (shift.status === 'completed' || shift.status === 'evaluating' || shift.finalEvaluation) {
      return
    }

    const resolveIfNeeded = () => {
      if (Date.now() < shift.expiresAt) return
      if (hasRequestedResolutionRef.current) return
      void requestResolution()
    }

    if (Date.now() >= shift.expiresAt) {
      resolveIfNeeded()
      return
    }

    const timer = setTimeout(() => {
      resolveIfNeeded()
    }, Math.max(0, shift.expiresAt - Date.now()))
    return () => {
      clearTimeout(timer)
    }
  }, [shift])
}
