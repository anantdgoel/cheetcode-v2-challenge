import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/convex-server";
import type { StoredReportRecord } from "./types";

export async function getReportByPublicId(publicId: string): Promise<StoredReportRecord | null> {
  return getConvexServerClient().query(api.leads.getReportByPublicId, { publicId });
}

export async function upsertReport(report: StoredReportRecord) {
  return getConvexServerClient().mutation(api.leads.upsertReport, {
    report,
    secret: getConvexMutationSecret(),
  });
}
