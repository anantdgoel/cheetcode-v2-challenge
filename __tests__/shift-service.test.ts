import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredShiftRecord } from "../src/lib/repositories/records";

const mutationMock = vi.fn();
const queryMock = vi.fn();
const validatePolicyMock = vi.fn();

vi.mock("../src/lib/repositories/convex", () => ({
  api: {
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
  getConvexMutationSecret: () => "secret",
  getConvexServerClient: () => ({
    mutation: mutationMock,
    query: queryMock,
  }),
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

    expect(queryMock).toHaveBeenCalledWith("sessions:getOwnedShift", {
      secret: "secret",
      github: "operator",
      shiftId: "shift_123",
    });
    expect(shift?.id).toBe("shift_123");
    expect(shift?.status).toBe("active_phase_1");
    expect(shift?.nextProbeKind).toBe("fit");
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

    expect(mutationMock).toHaveBeenCalledWith("sessions:storeValidation", {
      secret: "secret",
      github: "operator",
      shiftId: "shift_123",
      source: "normalized",
      validation: {
        ok: true,
        normalizedSource: "normalized",
        sourceHash: "hash-1",
      },
      checkedAt: expect.any(Number),
    });
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

    expect(mutationMock).toHaveBeenCalledWith("sessions:storeValidation", {
      secret: "secret",
      github: "operator",
      shiftId: "shift_123",
      source: "raw source",
      validation: {
        ok: false,
        error: "Validation failed",
      },
      checkedAt: expect.any(Number),
    });
    expect(result.validation).toEqual({
      ok: false,
      error: "Validation failed",
    });
  });
});
