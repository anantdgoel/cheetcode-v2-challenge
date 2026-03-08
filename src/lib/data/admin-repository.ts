import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/convex-server";
import type { AdminSnapshot } from "@/lib/contracts/views";

export async function getAdminSnapshotRecord(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}): Promise<AdminSnapshot> {
  return getConvexServerClient().query(api.leads.adminLookup, {
    github: params.github ?? undefined,
    shiftId: params.shiftId ?? undefined,
    publicId: params.publicId ?? undefined,
    secret: getConvexMutationSecret(),
  });
}
