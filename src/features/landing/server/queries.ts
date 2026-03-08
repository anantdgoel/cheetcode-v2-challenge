import { normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import { api, fetchPublicQuery } from '@/server/convex/client'

function logLandingFailure (scope: string, error: unknown) {
  console.error(`[landing] ${scope}`, error)
}

export async function getLandingLeaderboard () {
  return fetchPublicQuery(api.leaderboard.getPublic, {})
    .then((entries) => entries.map(normalizeLeaderboardRecord))
    .catch((error: unknown) => {
      logLandingFailure('failed to load leaderboard', error)
      return []
    })
}
