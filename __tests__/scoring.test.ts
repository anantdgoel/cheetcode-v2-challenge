import { beforeEach, describe, expect, it } from "vitest";
import { PROBLEM_BANK } from "../server/problems";
import { createSession, resetStore, submitResults } from "../src/server/store";
import { computeElo } from "../src/lib/scoring";

describe("scoring", () => {
  beforeEach(() => {
    resetStore();
  });

  it("elo formula matches spec", () => {
    expect(computeElo({ solvedCount: 3, timeRemainingSecs: 10, difficultyBonus: 250 })).toBe(
      750,
    );
  });

  it("0 solved does not crash submit path", async () => {
    const session = createSession("no-solve");
    const result = await submitResults({
      sessionId: session.sessionId,
      github: "no-solve",
      timeElapsed: 30_000,
      submissions: session.problems.map((problem) => ({
        problemId: problem.id,
        code: "function noop() { return 0; }",
      })),
    });
    expect(result.solved).toBe(0);
  });

  it("faster 10/10 scores higher", () => {
    const slow = computeElo({ solvedCount: 10, timeRemainingSecs: 15, difficultyBonus: 450 });
    const fast = computeElo({ solvedCount: 10, timeRemainingSecs: 30, difficultyBonus: 450 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("higher retry replaces old score, lower does not", async () => {
    const session = createSession("retry");
    const first = await submitResults({
      sessionId: session.sessionId,
      github: "retry",
      timeElapsed: 35_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    const second = await submitResults({
      sessionId: session.sessionId,
      github: "retry",
      timeElapsed: 10_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    expect(second.elo).toBeGreaterThan(first.elo);

    const third = await submitResults({
      sessionId: session.sessionId,
      github: "retry",
      timeElapsed: 44_000,
      submissions: [{ problemId: PROBLEM_BANK[0].id, code: PROBLEM_BANK[0].solution }],
    });
    expect(third.elo).toBeLessThan(second.elo);
  });
});
