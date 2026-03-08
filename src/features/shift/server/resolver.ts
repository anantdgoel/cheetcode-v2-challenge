import { asShiftId, fetchInternalAction, internal } from '@/server/convex/client'
import type { StoredShiftRecord } from '../domain/persistence'

export async function ensureResolvedShift (github: string, shiftId: string): Promise<StoredShiftRecord | null> {
  return fetchInternalAction(internal.shiftResolver.resolveShift, {
    github,
    shiftId: asShiftId(shiftId)
  })
}
