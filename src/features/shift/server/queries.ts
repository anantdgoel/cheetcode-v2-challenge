import type { ShiftView } from '@/core/domain/views'
import { fetchInternalQuery, internal } from '@/server/convex/client'
import { shapeShiftView } from '../domain/view'

export async function getCurrentShiftForGithub (github: string): Promise<ShiftView | null> {
  const latest = await fetchInternalQuery(internal.sessions.getCurrentOwned, {
    github
  })
  if (!latest) return null

  const view = shapeShiftView(latest, Date.now())
  return view.status === 'completed' || view.status === 'expired_no_result' ? null : view
}
