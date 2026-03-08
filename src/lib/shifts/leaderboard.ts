import {
  getLeaderboardEntryForGithub,
  upsertLeaderboardEntry,
} from "@/lib/repositories/leaderboard-repository";
import type { StoredReportRecord } from "@/lib/repositories/records";

export async function maybeStoreLeaderboard(report: StoredReportRecord | null) {
  if (!report) return;

  const current = await getLeaderboardEntryForGithub(report.github);
  if (
    current &&
    (report.hiddenScore < current.hiddenScore ||
      (report.hiddenScore === current.hiddenScore &&
        (report.boardEfficiency < current.boardEfficiency ||
          (report.boardEfficiency === current.boardEfficiency &&
            report.achievedAt >= current.achievedAt))))
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
