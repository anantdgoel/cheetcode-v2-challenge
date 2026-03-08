"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { LeaderboardEntry } from "@/lib/domain/views";
import { LandingLeaderboard } from "./LandingLeaderboard";

export function LiveLandingLeaderboard({
  initialLeaderboard,
}: {
  initialLeaderboard: LeaderboardEntry[];
}) {
  const liveLeaderboard = useQuery(api.leaderboard.getPublic, {});
  return <LandingLeaderboard leaderboard={liveLeaderboard ?? initialLeaderboard} />;
}
