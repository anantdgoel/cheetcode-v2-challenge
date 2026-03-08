import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/repositories/convex";
import type { StoredReportRecord } from "./records";

export async function getReportByPublicId(publicId: string): Promise<StoredReportRecord | null> {
  return getConvexServerClient().query(api.reports.getReportByPublicId, { publicId });
}

export async function upsertReport(report: StoredReportRecord) {
  return getConvexServerClient().mutation(api.reports.upsertReport, {
    report,
    secret: getConvexMutationSecret(),
  });
}
