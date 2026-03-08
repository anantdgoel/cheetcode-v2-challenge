import { beforeEach, describe, expect, it, vi } from "vitest";

const requireShiftGithubMock = vi.fn();
const getErrorMessageMock = vi.fn((error: unknown, fallback: string) => error instanceof Error ? error.message : fallback);
const jsonErrorMock = vi.fn((error: string, status: number) => Response.json({ error }, { status }));
const validateDraftForGithubMock = vi.fn();
const runProbeForGithubMock = vi.fn();
const goLiveForGithubMock = vi.fn();

vi.mock("../src/app/api/shifts/_utils", () => ({
  requireShiftGithub: requireShiftGithubMock,
  getErrorMessage: getErrorMessageMock,
  jsonError: jsonErrorMock,
}));

vi.mock("@/lib/shifts", () => ({
  validateDraftForGithub: validateDraftForGithubMock,
  runProbeForGithub: runProbeForGithubMock,
  goLiveForGithub: goLiveForGithubMock,
}));

describe("shift routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireShiftGithubMock.mockResolvedValue({ github: "operator" });
  });

  it("returns validate results from the service contract", async () => {
    validateDraftForGithubMock.mockResolvedValue({
      validation: { ok: true, normalizedSource: "normalized", sourceHash: "hash" },
      shift: { id: "shift_123" },
    });

    const { POST } = await import("../src/app/api/shifts/[shiftId]/validate/route");
    const response = await POST(
      new Request("http://localhost/api/shifts/shift_123/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "draft" }),
      }),
      { params: Promise.resolve({ shiftId: "shift_123" }) },
    );

    expect(validateDraftForGithubMock).toHaveBeenCalledWith({
      github: "operator",
      shiftId: "shift_123",
      source: "draft",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      validation: { ok: true, normalizedSource: "normalized", sourceHash: "hash" },
      shift: { id: "shift_123" },
    });
  });

  it("returns probe results from the service contract", async () => {
    runProbeForGithubMock.mockResolvedValue({
      probeKind: "fit",
      summary: { metrics: { efficiency: 0.5 } },
      shift: { id: "shift_123" },
    });

    const { POST } = await import("../src/app/api/shifts/[shiftId]/probe/route");
    const response = await POST(
      new Request("http://localhost/api/shifts/shift_123/probe", { method: "POST" }),
      { params: Promise.resolve({ shiftId: "shift_123" }) },
    );

    expect(runProbeForGithubMock).toHaveBeenCalledWith({
      github: "operator",
      shiftId: "shift_123",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      probeKind: "fit",
      summary: { metrics: { efficiency: 0.5 } },
      shift: { id: "shift_123" },
    });
  });

  it("returns go-live results from the service contract", async () => {
    goLiveForGithubMock.mockResolvedValue({
      shift: { id: "shift_123", status: "completed" },
    });

    const { POST } = await import("../src/app/api/shifts/[shiftId]/go-live/route");
    const response = await POST(
      new Request("http://localhost/api/shifts/shift_123/go-live", { method: "POST" }),
      { params: Promise.resolve({ shiftId: "shift_123" }) },
    );

    expect(goLiveForGithubMock).toHaveBeenCalledWith({
      github: "operator",
      shiftId: "shift_123",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      shift: { id: "shift_123", status: "completed" },
    });
  });
});
