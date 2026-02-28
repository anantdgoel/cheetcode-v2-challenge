import { beforeEach, describe, expect, it } from "vitest";
import { PROBLEM_BANK } from "../server/problems";
import { createSession, getLeaderboard, resetStore, submitResults } from "../src/server/store";

describe("leaderboard", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns entries sorted by ELO desc", async () => {
    const a = createSession("alice");
    const b = createSession("bob");
    await submitResults({
      sessionId: a.sessionId,
      github: "alice",
      timeElapsed: 20_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    await submitResults({
      sessionId: b.sessionId,
      github: "bob",
      timeElapsed: 5_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    const rows = getLeaderboard();
    expect(rows[0].elo).toBeGreaterThanOrEqual(rows[1].elo);
  });

  it("one entry per github", async () => {
    const session = createSession("single");
    await submitResults({
      sessionId: session.sessionId,
      github: "single",
      timeElapsed: 40_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    await submitResults({
      sessionId: session.sessionId,
      github: "single",
      timeElapsed: 10_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    expect(getLeaderboard().filter((entry) => entry.github === "single")).toHaveLength(1);
  });

  it("max 100 entries", () => {
    expect(getLeaderboard().length).toBeLessThanOrEqual(100);
  });
});
