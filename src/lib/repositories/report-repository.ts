import { api, asShiftId, fetchInternalMutation, fetchPublicQuery, internal } from '@/lib/repositories/convex-server'
import type { StoredReportRecord } from './records'

export async function getReportByPublicId (publicId: string): Promise<StoredReportRecord | null> {
  return fetchPublicQuery(api.reports.getReportByPublicId, { publicId })
}

export async function upsertReport (report: StoredReportRecord) {
  return fetchInternalMutation(internal.reports.upsertReport, {
    report: {
      ...report,
      shiftId: asShiftId(report.shiftId)
    }
  })
}
