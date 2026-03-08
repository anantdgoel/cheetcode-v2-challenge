import { api } from "@/lib/convex-server";
import type { StoredLeaderboardRecord } from "./types";
import { getDataClient } from "./client";

export async function getPublicLeaderboard(): Promise<StoredLeaderboardRecord[]> {
  const { convex } = getDataClient();
  return convex.query(api.leaderboard.getPublic, {});
}

export async function getLeaderboardEntryForGithub(github: string): Promise<StoredLeaderboardRecord | null> {
  const { convex, secret } = getDataClient();
  return convex.query(api.leaderboard.getForGithub, { secret, github });
}

export async function upsertLeaderboardEntry(entry: StoredLeaderboardRecord) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.leaderboard.upsertBest, { secret, entry });
}
