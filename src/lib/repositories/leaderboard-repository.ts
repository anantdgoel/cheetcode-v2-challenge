import { api, asShiftId, fetchInternalMutation, fetchInternalQuery, fetchPublicQuery, internal } from "@/lib/repositories/convex-server";
import type { StoredLeaderboardRecord } from "./records";

export async function getPublicLeaderboard(): Promise<StoredLeaderboardRecord[]> {
  return fetchPublicQuery(api.leaderboard.getPublic, {});
}

export async function getLeaderboardEntryForGithub(github: string): Promise<StoredLeaderboardRecord | null> {
  return fetchInternalQuery(internal.leaderboard.getForGithub, { github });
}

export async function upsertLeaderboardEntry(entry: StoredLeaderboardRecord) {
  return fetchInternalMutation(internal.leaderboard.upsertBest, {
    entry: {
      ...entry,
      shiftId: asShiftId(entry.shiftId),
    },
  });
}
