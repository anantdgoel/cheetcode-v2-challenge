import { api } from "@/lib/convex-server";
import type { AdminSnapshot } from "@/lib/contracts/views";
import { getDataClient } from "./client";

export async function getAdminSnapshotRecord(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}): Promise<AdminSnapshot> {
  const { convex, secret } = getDataClient();
  return convex.query(api.leads.adminLookup, {
    secret,
    github: params.github ?? undefined,
    shiftId: params.shiftId ?? undefined,
    publicId: params.publicId ?? undefined,
  });
}
