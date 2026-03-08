import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredShiftRecord } from "../src/lib/repositories/records";

const mutationMock = vi.fn();
const queryMock = vi.fn();
const validatePolicyMock = vi.fn();

vi.mock("../src/lib/repositories/convex-server", () => ({
  internal: {
    sessions: {
      getOwnedShift: "sessions:getOwnedShift",
      getCurrentOwned: "sessions:getCurrentOwned",
      saveDraft: "sessions:saveDraft",
      storeValidation: "sessions:storeValidation",
      acceptRun: "sessions:acceptRun",
      completeProbeRun: "sessions:completeProbeRun",
      completeFinalRun: "sessions:completeFinalRun",
      recordArtifactFetch: "sessions:recordArtifactFetch",
      markExpiredNoResult: "sessions:markExpiredNoResult",
      start: "sessions:start",
    },
    leaderboard: {
      getPublic: "leaderboard:getPublic",
      getForGithub: "leaderboard:getForGithub",
      upsertBest: "leaderboard:upsertBest",
    },
    reports: {
      getReportByPublicId: "reports:getReportByPublicId",
      upsertReport: "reports:upsertReport",
      adminLookup: "reports:adminLookup",
    },
  },
  asShiftId: (value: string) => value,
  fetchInternalMutation: mutationMock,
  fetchInternalQuery: queryMock,
}));

vi.mock("../src/lib/engine", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/engine")>("../src/lib/engine");
  return {
    ...actual,
    validatePolicy: validatePolicyMock,
  };
});

const now = Date.now();
const baseShift: StoredShiftRecord = {
  id: "shift_123",
  github: "operator",
  seed: "seed-1",
  artifactVersion: 1,
  state: "active",
  startedAt: now - 1_000,
  phase1EndsAt: now + 60_000,
  expiresAt: now + 120_000,
  latestDraftSource: "export function connect() { return { lineId: null }; }",
  latestDraftSavedAt: now - 1_000,
  latestValidSource: "export function connect() { return { lineId: null }; }",
  latestValidSourceHash: "starter-hash",
  latestValidAt: now - 1_000,
  latestValidationCheckedAt: now - 1_000,
  artifactFetchAt: {},
  runs: [],
};

describe("shift service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reloads owned shifts and shapes the current DTO", async () => {
    queryMock.mockResolvedValue(baseShift);

    const { getOwnedShiftForGithub } = await import("../src/lib/shifts");
    const shift = await getOwnedShiftForGithub("operator", "shift_123");

    expect(queryMock).toHaveBeenCalledWith(
      "sessions:getOwnedShift",
      {
        github: "operator",
        shiftId: "shift_123",
      },
    );
    expect(shift?.id).toBe("shift_123");
    expect(shift?.status).toBe("active_phase_1");
    expect(shift?.nextProbeKind).toBe("fit");
  });

  it("hides the next probe once the trial window closes", async () => {
    queryMock.mockResolvedValue({
      ...baseShift,
      phase1EndsAt: now - 1,
    });

    const { getOwnedShiftForGithub } = await import("../src/lib/shifts");
    const shift = await getOwnedShiftForGithub("operator", "shift_123");

    expect(shift?.status).toBe("active_phase_2");
    expect(shift?.nextProbeKind).toBeUndefined();
  });

  it("stores successful validations with normalized source and refreshed shift", async () => {
    validatePolicyMock.mockResolvedValue({
      ok: true,
      normalizedSource: "normalized",
      sourceHash: "hash-1",
    });
    queryMock
      .mockResolvedValueOnce(baseShift)
      .mockResolvedValueOnce({
        ...baseShift,
        latestDraftSource: "normalized",
        latestValidSource: "normalized",
        latestValidSourceHash: "hash-1",
        latestValidAt: now,
      });
    mutationMock.mockResolvedValue(undefined);

    const { validateDraftForGithub } = await import("../src/lib/shifts");
    const result = await validateDraftForGithub({
      github: "operator",
      shiftId: "shift_123",
      source: "raw source",
    });

    expect(mutationMock).toHaveBeenCalledWith(
      "sessions:storeValidation",
      {
        github: "operator",
        shiftId: "shift_123",
        source: "normalized",
        validation: {
          ok: true,
          normalizedSource: "normalized",
          sourceHash: "hash-1",
        },
        checkedAt: expect.any(Number),
      },
    );
    expect(result.validation).toEqual({
      ok: true,
      normalizedSource: "normalized",
      sourceHash: "hash-1",
    });
    expect(result.shift?.latestValidAt).toBe(now);
  });

  it("records invalid validation errors without normalization", async () => {
    validatePolicyMock.mockResolvedValue({
      ok: false,
      error: "Validation failed",
    });
    queryMock.mockResolvedValue(baseShift);
    mutationMock.mockResolvedValue(undefined);

    const { validateDraftForGithub } = await import("../src/lib/shifts");
    const result = await validateDraftForGithub({
      github: "operator",
      shiftId: "shift_123",
      source: " raw source ",
    });

    expect(mutationMock).toHaveBeenCalledWith(
      "sessions:storeValidation",
      {
        github: "operator",
        shiftId: "shift_123",
        source: "raw source",
        validation: {
          ok: false,
          error: "Validation failed",
        },
        checkedAt: expect.any(Number),
      },
    );
    expect(result.validation).toEqual({
      ok: false,
      error: "Validation failed",
    });
  });

  it("submits probe runs and returns the completed summary", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("run_1");
    queryMock
      .mockResolvedValueOnce(baseShift)
      .mockResolvedValueOnce({
        ...baseShift,
        runs: [
          {
            id: "run_1",
            kind: "fit",
            trigger: "manual",
            state: "accepted",
            acceptedAt: now,
            sourceHash: "starter-hash",
            sourceSnapshot: baseShift.latestValidSource!,
          },
        ],
      })
      .mockResolvedValueOnce({
        ...baseShift,
        runs: [
          {
            id: "run_1",
            kind: "fit",
            trigger: "manual",
            state: "completed",
            acceptedAt: now,
            resolvedAt: now + 1,
            sourceHash: "starter-hash",
            sourceSnapshot: baseShift.latestValidSource!,
            probeSummary: {
              probeKind: "fit",
              deskCondition: "steady",
              metrics: {
                connectedCalls: 5,
                totalCalls: 10,
                droppedCalls: 1,
                avgHoldSeconds: 1,
                premiumUsageRate: 0.1,
                efficiency: 0.5,
              },
              callBucketTable: [],
              loadBandTable: [],
              lineGroupTable: [],
              failureBuckets: [],
              failureModes: ["collapse_under_pressure", "tempo_lag", "misleading_history"],
              modeConfidence: {
                collapse_under_pressure: 0.71,
                tempo_lag: 0.62,
                misleading_history: 0.58,
              },
              transferWarning: "likely_final_shift_sensitive",
              recommendedQuestions: [
                "Does the desk change shape once pressure moves from building to hot?",
                "Did the books reward the wrong desks for the live room you actually have?",
              ],
              chiefOperatorNotes: [
                "The borough desks carried neatly until the lamps stacked, then the room began dropping its poise before the callers did.",
                "The room changes pace ahead of the routing; the late board answers a beat behind the first clean read.",
                "The books praised a calmer version of the room than the probe actually found once the live desk started speaking for itself.",
                "One corner of the board was asked to answer too much of the room, and the room noticed before the policy did.",
                "The room did not ask for a new board, only a firmer reading of when the present one stops behaving politely.",
              ],
              counterfactualNotes: [
                "What seemed like a steady answer in the books lost its footing once the room heated up.",
                "What seemed like board law was partly the books talking louder than the live room.",
              ],
              incidents: [],
            },
          },
        ],
      });
    mutationMock.mockResolvedValue(undefined);

    const { runProbeForGithub } = await import("../src/lib/shifts");
    const result = await runProbeForGithub({
      github: "operator",
      shiftId: "shift_123",
    });

    expect(mutationMock).toHaveBeenCalledWith(
      "sessions:acceptRun",
      expect.objectContaining({
        github: "operator",
        shiftId: "shift_123",
        run: expect.objectContaining({
          kind: "fit",
          trigger: "manual",
          sourceHash: "starter-hash",
        }),
      }),
    );
    expect(result.probeKind).toBe("fit");
    expect(result.summary.metrics.efficiency).toBe(0.5);
  });

  it("rejects probe runs after the trial window closes", async () => {
    queryMock.mockResolvedValue({
      ...baseShift,
      phase1EndsAt: now - 1,
    });

    const { runProbeForGithub } = await import("../src/lib/shifts");

    await expect(
      runProbeForGithub({
        github: "operator",
        shiftId: "shift_123",
      }),
    ).rejects.toThrow("trial window closed");

    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("submits final runs and returns the completed shift", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("run_final");
    queryMock
      .mockResolvedValueOnce({
        ...baseShift,
        latestValidAt: now,
      })
      .mockResolvedValueOnce({
        ...baseShift,
        latestValidAt: now,
        runs: [
          {
            id: "run_final",
            kind: "final",
            trigger: "manual",
            state: "accepted",
            acceptedAt: now,
            sourceHash: "starter-hash",
            sourceSnapshot: baseShift.latestValidSource!,
          },
        ],
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseShift,
        latestValidAt: now,
        runs: [
          {
            id: "run_final",
            kind: "final",
            trigger: "manual",
            state: "completed",
            acceptedAt: now,
            resolvedAt: now + 1,
            sourceHash: "starter-hash",
            sourceSnapshot: baseShift.latestValidSource!,
            reportPublicId: "public_123",
            title: "operator",
            chiefOperatorNote: "steady shift",
            metrics: {
              connectedCalls: 8,
              totalCalls: 10,
              droppedCalls: 1,
              avgHoldSeconds: 1,
              totalHoldSeconds: 10,
              premiumUsageCount: 1,
              premiumUsageRate: 0.1,
              trunkMisuseCount: 0,
              efficiency: 0.8,
              hiddenScore: 0.75,
            },
          },
        ],
        state: "completed",
        completedAt: now + 1,
        reportPublicId: "public_123",
      });
    mutationMock.mockResolvedValue(undefined);

    const { goLiveForGithub } = await import("../src/lib/shifts");
    const result = await goLiveForGithub({
      github: "operator",
      shiftId: "shift_123",
    });

    expect(mutationMock).toHaveBeenCalledWith(
      "sessions:acceptRun",
      expect.objectContaining({
        github: "operator",
        shiftId: "shift_123",
        run: expect.objectContaining({
          kind: "final",
          trigger: "manual",
          sourceHash: "starter-hash",
        }),
      }),
    );
    expect(result.shift.status).toBe("completed");
  });
});
