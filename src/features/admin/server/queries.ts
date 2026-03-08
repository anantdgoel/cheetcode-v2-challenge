import type { AdminSnapshot } from '@/core/domain/views'
import { asShiftId, fetchInternalQuery, internal } from '@/server/convex/client'

export async function getAdminSnapshot (params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}) {
  const queryArgs: {
    github?: string;
    shiftId?: ReturnType<typeof asShiftId>;
    publicId?: string;
  } = {}

  if (params.github) {
    queryArgs.github = params.github
  }
  if (params.shiftId) {
    queryArgs.shiftId = asShiftId(params.shiftId)
  }
  if (params.publicId) {
    queryArgs.publicId = params.publicId
  }

  return fetchInternalQuery(internal.reports.adminLookup, queryArgs) as Promise<AdminSnapshot>
}
