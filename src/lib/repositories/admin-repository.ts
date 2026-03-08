import { asShiftId, fetchInternalQuery, internal } from '@/lib/repositories/convex-server'
import type { AdminSnapshot } from '@/lib/domain/views'

export async function getAdminSnapshotRecord (params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}): Promise<AdminSnapshot> {
  return fetchInternalQuery(internal.reports.adminLookup, {
    github: params.github ?? undefined,
    shiftId: params.shiftId ? asShiftId(params.shiftId) : undefined,
    publicId: params.publicId ?? undefined
  })
}
