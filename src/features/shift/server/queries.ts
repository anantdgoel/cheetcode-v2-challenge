import type { ShiftView } from '@/core/domain/views'
import { fetchInternalQuery, internal } from '@/server/convex/client'
import { shapeShiftView } from '../domain/view'
import { ensureResolvedShift } from './resolver'

export async function getCurrentShiftForGithub (github: string): Promise<ShiftView | null> {
  const latest = await fetchInternalQuery(internal.sessions.getCurrentOwned, {
    github
  })
  if (!latest) return null

  const view = shapeShiftView(latest, Date.now())
  return view.status === 'completed' || view.status === 'expired_no_result' ? null : view
}

export async function getOwnedShiftForGithub (github: string, shiftId: string): Promise<ShiftView | null> {
  const shift = await ensureResolvedShift(github, shiftId)
  return shift ? shapeShiftView(shift, Date.now()) : null
}
