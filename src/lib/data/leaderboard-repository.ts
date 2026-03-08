import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/convex-server";
import type { StoredLeaderboardRecord } from "./types";

export async function getPublicLeaderboard(): Promise<StoredLeaderboardRecord[]> {
  return getConvexServerClient().query(api.leaderboard.getPublic, {});
}

export async function getLeaderboardEntryForGithub(github: string): Promise<StoredLeaderboardRecord | null> {
  return getConvexServerClient().query(api.leaderboard.getForGithub, {
    github,
    secret: getConvexMutationSecret(),
  });
}

export async function upsertLeaderboardEntry(entry: StoredLeaderboardRecord) {
  return getConvexServerClient().mutation(api.leaderboard.upsertBest, {
    entry,
    secret: getConvexMutationSecret(),
  });
}
