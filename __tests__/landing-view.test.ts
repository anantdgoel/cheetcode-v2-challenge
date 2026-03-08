import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    query: vi.fn(),
    action: vi.fn(),
    mutation: vi.fn(),
  };
});

vi.mock("../src/lib/convex-server", () => ({
  api: {
    leaderboard: { getPublic: "leaderboard:getPublic" },
    sessions: { getCurrentOwned: "sessions:getCurrentOwned" },
  },
  getConvexMutationSecret: () => "secret",
  getConvexServerClient: () => mocks,
}));

describe("getLandingView", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.action.mockReset();
    mocks.mutation.mockReset();
  });

  it("returns leaderboard rows even if current shift lookup fails", async () => {
    const leaderboard = [
      {
        publicId: "public-1",
        github: "benchmark-agent",
        title: "chief_operator",
        boardEfficiency: 0.8,
        hiddenScore: 0.8,
        achievedAt: Date.now(),
        shiftId: "shift-1",
        connectedCalls: 200,
        totalCalls: 250,
        droppedCalls: 50,
        avgHoldSeconds: 1.2,
      },
    ];

    mocks.query.mockResolvedValue(leaderboard);
    mocks.action.mockRejectedValue(new Error("current shift unavailable"));

    const { getLandingView } = await import("../src/lib/shift-service");
    const view = await getLandingView("benchmark-agent");

    expect(view.leaderboard).toEqual(leaderboard);
    expect(view.activeShiftId).toBeNull();
    expect(view.github).toBe("benchmark-agent");
  });
});
