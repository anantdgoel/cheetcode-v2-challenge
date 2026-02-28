import { beforeEach, describe, expect, it } from "vitest";
import { PROBLEM_BANK } from "../server/problems";
import {
  createSession,
  getLeadByGithub,
  resetStore,
  submitLead,
  submitResults,
} from "../src/server/store";

describe("leads", () => {
  beforeEach(() => {
    resetStore();
  });

  async function solveThree(sessionId: string, github: string) {
    const solved = PROBLEM_BANK.slice(0, 3).map((problem) => ({
      problemId: problem.id,
      code: problem.solution,
    }));
    await submitResults({
      sessionId,
      github,
      timeElapsed: 10_000,
      submissions: solved,
    });
  }

  it("3+ solved can submit", async () => {
    const session = createSession("lead-ok");
    await solveThree(session.sessionId, "lead-ok");
    expect(
      submitLead({
        github: "lead-ok",
        email: "test@example.com",
        sessionId: session.sessionId,
      }).ok,
    ).toBe(true);
  });

  it("0-2 solved is rejected", () => {
    const session = createSession("lead-no");
    expect(() =>
      submitLead({
        github: "lead-no",
        email: "test@example.com",
        sessionId: session.sessionId,
      }),
    ).toThrow();
  });

  it("email required", async () => {
    const session = createSession("lead-email");
    await solveThree(session.sessionId, "lead-email");
    expect(() =>
      submitLead({
        github: "lead-email",
        email: "",
        sessionId: session.sessionId,
      }),
    ).toThrow();
  });

  it("flag field stored as-is and duplicate github upserts", async () => {
    const session = createSession("lead-flag");
    await solveThree(session.sessionId, "lead-flag");
    submitLead({
      github: "lead-flag",
      email: "one@example.com",
      flag: "🔥{sample}",
      sessionId: session.sessionId,
    });
    submitLead({
      github: "lead-flag",
      email: "two@example.com",
      flag: "🔥{updated}",
      sessionId: session.sessionId,
    });

    const lead = getLeadByGithub("lead-flag");
    expect(lead?.flag).toBe("🔥{updated}");
    expect(lead?.email).toBe("two@example.com");
  });
});
