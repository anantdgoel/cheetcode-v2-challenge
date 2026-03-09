'use client'

import { useConvexAuth, useAction, useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { ArtifactName } from '@/core/domain/game'
import type { ClientShiftRecord } from '../domain/persistence'

const myShiftQuery = api.sessions.getMyShift
const myCurrentShiftQuery = api.sessions.getMyCurrentShift
const startShiftAction = api.shiftActions.startShift
const saveDraftAction = api.shiftActions.saveDraft
const validateDraftAction = api.shiftActions.validateDraft
const artifactContentQuery = api.sessions.getArtifactContent
const requestProbeMutation = api.sessions.requestProbe
const requestGoLiveMutation = api.sessions.requestGoLive
const resolveShiftExpiryMutation = api.sessions.resolveShiftExpiry

/**
 * Reactive query for the current user's specific shift.
 * Returns a client-safe record (no seed, no hiddenScore in metrics) —
 * the caller runs shapeShiftView() to produce a ShiftView.
 */
export function useShiftRecord (shiftId: string) {
  const { isAuthenticated } = useConvexAuth()
  return useQuery(myShiftQuery, isAuthenticated ? { shiftId: shiftId as Id<'shifts'> } : 'skip') as ClientShiftRecord | null | undefined
}

/**
 * Reactive query for the current user's most recent shift.
 */
export function useMyCurrentShift () {
  const { isAuthenticated } = useConvexAuth()
  return useQuery(myCurrentShiftQuery, isAuthenticated ? {} : 'skip') as ClientShiftRecord | null | undefined
}

/**
 * Reactive query for artifact content. Returns null when loading or unavailable.
 */
export function useArtifactContent (shiftId: string, name: ArtifactName | null): string | undefined {
  const { isAuthenticated } = useConvexAuth()
  return useQuery(
    artifactContentQuery,
    isAuthenticated && name ? { shiftId: shiftId as Id<'shifts'>, name } : 'skip'
  )
}

export function useStartShift () {
  const start = useAction(startShiftAction)
  return useCallback(async () => {
    return start({})
  }, [start])
}

export function useSaveDraft () {
  const save = useAction(saveDraftAction)
  return useCallback(async (shiftId: string, source: string) => {
    return save({ shiftId: shiftId as Id<'shifts'>, source })
  }, [save])
}

export function useValidateDraft () {
  const validate = useAction(validateDraftAction)
  return useCallback(async (shiftId: string, source: string) => {
    return validate({ shiftId: shiftId as Id<'shifts'>, source })
  }, [validate])
}

export function useRunProbe () {
  const probe = useMutation(requestProbeMutation)
  return useCallback(async (shiftId: string) => {
    return probe({ shiftId: shiftId as Id<'shifts'> })
  }, [probe])
}

export function useGoLive () {
  const live = useMutation(requestGoLiveMutation)
  return useCallback(async (shiftId: string) => {
    return live({ shiftId: shiftId as Id<'shifts'> })
  }, [live])
}

export function useResolveShiftExpiry () {
  const resolve = useMutation(resolveShiftExpiryMutation)
  return useCallback(async (shiftId: string) => {
    return resolve({ shiftId: shiftId as Id<'shifts'> })
  }, [resolve])
}
