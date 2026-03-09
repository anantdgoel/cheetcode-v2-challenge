'use client'

import { usePaginatedQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import type { LeaderboardEntry } from '@/core/domain/views'
import { LandingLeaderboard } from './LandingLeaderboard'

const leaderboardQuery = api.leaderboard.list
const PAGE_SIZE = 7

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

  const [page, setPage] = useState(0)

  const topEntries = entries.slice(0, 3)
  const allDispatch = entries.slice(3)
  const dispatchEntries = allDispatch.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Prefetch: ensure the next page's data is loaded ahead of time
  useEffect(() => {
    if (allDispatch.length <= (page + 1) * PAGE_SIZE && status === 'CanLoadMore') {
      loadMore(PAGE_SIZE)
    }
  }, [allDispatch.length, page, status, loadMore])

  const exhausted = status === 'Exhausted'
  const canPrev = page > 0
  const canNext = allDispatch.length > (page + 1) * PAGE_SIZE

  function goNext () {
    if (canNext) setPage(p => p + 1)
  }

  return (
    <LandingLeaderboard
      topEntries={topEntries}
      dispatchEntries={dispatchEntries}
      page={page}
      totalPages={exhausted ? Math.max(1, Math.ceil(allDispatch.length / PAGE_SIZE)) : null}
      totalEntries={exhausted ? entries.length : null}
      canPrev={canPrev}
      canNext={canNext && allDispatch.length > 0}
      onPrev={() => { setPage(p => p - 1) }}
      onNext={goNext}
    />
  )
}
