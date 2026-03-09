import { normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import type { LeaderboardEntry } from '@/core/domain/views'
import { api, fetchPublicQuery } from '@/server/convex/client'

function logLandingFailure (scope: string, error: unknown) {
  console.error(`[landing] ${scope}`, error)
}

export async function getLandingLeaderboard (): Promise<LeaderboardEntry[]> {
  return fetchPublicQuery(api.leaderboard.list, {
    paginationOpts: { cursor: null, numItems: 10 }
  })
    .then((result) => result.page.map(normalizeLeaderboardRecord))
    .catch((error: unknown) => {
      logLandingFailure('failed to load leaderboard', error)
      return []
    })
}
