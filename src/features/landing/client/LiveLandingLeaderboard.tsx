'use client'

import { useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { normalizePaginatedLeaderboard } from '@/core/domain/normalizers'
import type { PaginatedLeaderboard } from '@/core/domain/views'
import { LandingLeaderboard } from './LandingLeaderboard'

const PAGE_SIZE = 5

export function LiveLandingLeaderboard ({
  initialLeaderboard
}: {
  initialLeaderboard: PaginatedLeaderboard;
}) {
  const [dispatchPage, setDispatchPage] = useState(0)

  const liveData = useQuery(api.leaderboard.getPublic, {
    dispatchPage,
    dispatchPageSize: PAGE_SIZE
  })

  const leaderboard: PaginatedLeaderboard = useMemo(() => {
    if (!liveData) return initialLeaderboard
    return normalizePaginatedLeaderboard(liveData)
  }, [liveData, initialLeaderboard])

  return (
    <LandingLeaderboard
      leaderboard={leaderboard}
      onPageChange={setDispatchPage}
    />
  )
}
