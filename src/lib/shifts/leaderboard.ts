import {
  getLeaderboardEntryForGithub,
  upsertLeaderboardEntry,
} from "@/lib/repositories/leaderboard-repository";
import type { StoredReportRecord } from "@/lib/repositories/records";

function isBetterLeaderboardCandidate(
  current: Awaited<ReturnType<typeof getLeaderboardEntryForGithub>>,
  candidate: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  },
) {
  if (!current) return true;
  if (candidate.hiddenScore !== current.hiddenScore) return candidate.hiddenScore > current.hiddenScore;
  if (candidate.boardEfficiency !== current.boardEfficiency) return candidate.boardEfficiency > current.boardEfficiency;
  return candidate.achievedAt < current.achievedAt;
}

export async function maybeStoreLeaderboard(report: StoredReportRecord | null) {
  if (!report) return;

  const current = await getLeaderboardEntryForGithub(report.github);
  if (
    !isBetterLeaderboardCandidate(current, {
      hiddenScore: report.hiddenScore,
      boardEfficiency: report.boardEfficiency,
      achievedAt: report.achievedAt,
    })
  ) {
    return;
  }

  await upsertLeaderboardEntry({
    github: report.github,
    title: report.title,
    boardEfficiency: report.boardEfficiency,
    hiddenScore: report.hiddenScore,
    achievedAt: report.achievedAt,
    shiftId: report.shiftId,
    publicId: report.publicId,
    connectedCalls: report.connectedCalls,
    totalCalls: report.totalCalls,
    droppedCalls: report.droppedCalls,
    avgHoldSeconds: report.avgHoldSeconds,
  });
}
