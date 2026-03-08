import { normalizeReportRecord } from '@/core/domain/normalizers'
import { api, fetchPublicQuery } from '@/server/convex/client'

export async function getReportView (publicId: string) {
  const report = await fetchPublicQuery(api.reports.getReportByPublicId, { publicId })
  return report ? normalizeReportRecord(report) : null
}
