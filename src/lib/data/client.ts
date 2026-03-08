import { getConvexMutationSecret, getConvexServerClient } from "@/lib/convex-server";

export function getDataClient() {
  return {
    convex: getConvexServerClient(),
    secret: getConvexMutationSecret(),
  };
}
