import { api } from "@/lib/convex-server";
import type { StoredReportRecord } from "./types";
import { getDataClient } from "./client";

export async function getReportByPublicId(publicId: string): Promise<StoredReportRecord | null> {
  const { convex } = getDataClient();
  return convex.query(api.leads.getReportByPublicId, { publicId });
}

export async function upsertReport(report: StoredReportRecord) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.leads.upsertReport, { secret, report });
}
