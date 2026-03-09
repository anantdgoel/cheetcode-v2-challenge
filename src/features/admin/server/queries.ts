import type { AdminCandidateDetail, AdminCandidatePage, AdminSnapshot } from '@/core/domain/views'
import { asShiftId, fetchInternalAction, fetchInternalQuery, internal } from '@/server/convex/client'

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

export async function getCandidates (page: number) {
  return fetchInternalQuery(internal.admin.getCandidates, {
    page,
    pageSize: 25
  }) as Promise<AdminCandidatePage>
}

export async function getCandidateDetail (github: string) {
  return fetchInternalQuery(internal.admin.getCandidateDetail, {
    github
  }) as Promise<AdminCandidateDetail>
}

export async function triggerSummaryGeneration (github: string) {
  return fetchInternalAction(internal.adminAgent.generateSummary, {
    github
  }) as Promise<{ throttled: boolean; summary: string }>
}
