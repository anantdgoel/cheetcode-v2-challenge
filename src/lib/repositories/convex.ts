import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export function getConvexServerClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  return new ConvexHttpClient(url);
}

export function getConvexMutationSecret() {
  const secret = process.env.CONVEX_MUTATION_SECRET;
  if (!secret) throw new Error("CONVEX_MUTATION_SECRET is not configured");
  return secret;
}

export { api };
