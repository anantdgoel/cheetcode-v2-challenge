import { TITLES } from './game'
import type { LeaderboardEntry, PaginatedLeaderboard, ReportView } from './views'

export function expectLiteralValue<T extends string> (
  value: string,
  allowed: readonly T[],
  field: string
): T {
  if (allowed.some((candidate) => candidate === value)) {
    return value as T
  }

  throw new Error(`invalid ${field}: ${value}`)
}

export function normalizeReportRecord (report: {
  publicId: string;
  shiftId: string;
  github: string;
  title: string;
  boardEfficiency: number;
  connectedCalls: number;
  totalCalls: number;
  droppedCalls: number;
  avgHoldSeconds: number;
  premiumTrunkUsage: number;
  chiefOperatorNote: string;
  achievedAt: number;
  hiddenScore: number;
  kind: 'final' | 'auto_final';
}): ReportView {
  return {
    ...report,
    title: expectLiteralValue(report.title, TITLES, 'report.title')
  }
}

export function normalizeLeaderboardRecord (entry: {
  github: string;
  title: string;
  boardEfficiency: number;
  hiddenScore: number;
  achievedAt: number;
  shiftId: string;
  publicId: string;
  connectedCalls?: number;
  totalCalls?: number;
  droppedCalls?: number;
  avgHoldSeconds?: number;
}): LeaderboardEntry {
  return {
    ...entry,
    title: expectLiteralValue(entry.title, TITLES, 'leaderboard.title')
  }
}

export function normalizePaginatedLeaderboard (raw: {
  topEntries: Parameters<typeof normalizeLeaderboardRecord>[0][];
  dispatchEntries: Parameters<typeof normalizeLeaderboardRecord>[0][];
  totalEntries: number;
  dispatchPage: number;
  totalDispatchPages: number;
}): PaginatedLeaderboard {
  return {
    topEntries: raw.topEntries.map(normalizeLeaderboardRecord),
    dispatchEntries: raw.dispatchEntries.map(normalizeLeaderboardRecord),
    totalEntries: raw.totalEntries,
    dispatchPage: raw.dispatchPage,
    totalDispatchPages: raw.totalDispatchPages
  }
}
