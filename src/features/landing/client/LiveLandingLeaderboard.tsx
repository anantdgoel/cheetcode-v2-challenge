'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { normalizeLeaderboardRecord } from '@/core/domain/normalizers'
import type { LeaderboardEntry } from '@/core/domain/views'
import { LandingLeaderboard } from './LandingLeaderboard'

const EMPTY_QUERY_ARGS = {}

export function LiveLandingLeaderboard ({
  initialLeaderboard
}: {
  initialLeaderboard: LeaderboardEntry[];
}) {
  const liveLeaderboard = useQuery(api.leaderboard.getPublic, EMPTY_QUERY_ARGS)
  const leaderboard = liveLeaderboard
    ? liveLeaderboard.map(normalizeLeaderboardRecord)
    : initialLeaderboard

  return <LandingLeaderboard leaderboard={leaderboard} />
}
