'use client'

import { usePaginatedQuery } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../../../convex/_generated/api'
import { normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import type { LeaderboardEntry } from '@/core/domain/views'
import { LandingLeaderboard } from './LandingLeaderboard'

const leaderboardQuery = api.leaderboard.list

export function LiveLandingLeaderboard ({
  initialEntries
}: {
  initialEntries: LeaderboardEntry[];
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    leaderboardQuery,
    {},
    { initialNumItems: 10 }
  )

  const entries: LeaderboardEntry[] = useMemo(() => {
    if (status === 'LoadingFirstPage') return initialEntries
    return (results as Parameters<typeof normalizeLeaderboardRecord>[0][]).map(normalizeLeaderboardRecord)
  }, [results, status, initialEntries])

  return (
    <LandingLeaderboard
      entries={entries}
      status={status}
      loadMore={loadMore}
    />
  )
}
