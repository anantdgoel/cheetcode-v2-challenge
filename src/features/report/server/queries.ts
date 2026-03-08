import { normalizeReportRecord } from '@/core/domain/normalizers'
import { api, fetchInternalMutation, fetchPublicQuery, internal } from '@/server/convex/client'

export async function getReportView (publicId: string) {
  const report = await fetchPublicQuery(api.reports.getReportByPublicId, { publicId })
  return report ? normalizeReportRecord(report) : null
}

export async function getContactSubmission (reportPublicId: string) {
  return fetchPublicQuery(api.contactSubmissions.getByReportPublicId, { reportPublicId })
}

export async function submitContact (params: {
  github: string;
  name: string;
  email: string;
  reportPublicId: string;
}) {
  await fetchInternalMutation(internal.contactSubmissions.submit, params)
}
