import type { LandingView } from "@/lib/contracts/views";

export function shapeLandingView(params: {
  leaderboard: LandingView["leaderboard"];
  activeShiftId: string | null;
  github: string | null;
}): LandingView {
  return {
    leaderboard: params.leaderboard,
    activeShiftId: params.activeShiftId,
    github: params.github,
  };
}
