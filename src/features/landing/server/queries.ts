import { normalizePaginatedLeaderboard } from '@/core/domain/normalizers'
import type { PaginatedLeaderboard } from '@/core/domain/views'
import { api, fetchPublicQuery } from '@/server/convex/client'

function logLandingFailure (scope: string, error: unknown) {
  console.error(`[landing] ${scope}`, error)
}

const EMPTY_LEADERBOARD: PaginatedLeaderboard = {
  topEntries: [],
  dispatchEntries: [],
  totalEntries: 0,
  dispatchPage: 0,
  totalDispatchPages: 1
}

export async function getLandingLeaderboard (): Promise<PaginatedLeaderboard> {
  return fetchPublicQuery(api.leaderboard.getPublic, {})
    .then(normalizePaginatedLeaderboard)
    .catch((error: unknown) => {
      logLandingFailure('failed to load leaderboard', error)
      return EMPTY_LEADERBOARD
    })
}
