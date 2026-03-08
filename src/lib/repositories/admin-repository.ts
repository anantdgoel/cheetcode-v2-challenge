import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/repositories/convex";
import type { AdminSnapshot } from "@/lib/domain/views";

export async function getAdminSnapshotRecord(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}): Promise<AdminSnapshot> {
  return getConvexServerClient().query(api.reports.adminLookup, {
    github: params.github ?? undefined,
    shiftId: params.shiftId ?? undefined,
    publicId: params.publicId ?? undefined,
    secret: getConvexMutationSecret(),
  });
}
