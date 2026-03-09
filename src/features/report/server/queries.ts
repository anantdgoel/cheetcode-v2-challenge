import { normalizeReportRecord } from '@/core/domain/normalizers'
import { fetchInternalQuery, internal } from '@/server/convex/client'

export async function getReportView (publicId: string) {
  const report = await fetchInternalQuery(internal.reports.getByPublicIdInternal, { publicId })
  if (!report) return null
  const normalized = normalizeReportRecord(report)
  const leaderboardPosition = await fetchInternalQuery(internal.leaderboard.getPositionForGithub, { github: report.github })
  return { ...normalized, leaderboardPosition }
}

export async function getContactSubmission (reportPublicId: string): Promise<{ submitted: true } | null> {
  return fetchInternalQuery(internal.contactSubmissions.getByReportPublicId, { reportPublicId })
}
