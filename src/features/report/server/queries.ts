import { normalizeReportRecord } from '@/core/domain/normalizers'
import { fetchInternalMutation, fetchInternalQuery, internal } from '@/server/convex/client'

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

export async function submitContact (params: {
  github: string;
  name: string;
  email: string;
  reportPublicId: string;
}) {
  await fetchInternalMutation(internal.contactSubmissions.submit, params)
}
