// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShiftConsole from "../src/components/ShiftConsole";
import type { ShiftView } from "../src/lib/contracts/views";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const initialShift: ShiftView = {
  id: "shift_123",
  github: "operator",
  status: "active_phase_1",
  startedAt: 1,
  phase1EndsAt: 2,
  expiresAt: Date.now() + 60_000,
  artifactVersion: 1,
  latestDraftSource: "export function connect() { return { lineId: null }; }",
  latestDraftSavedAt: 1,
  currentPhase: "active",
  probesUsed: 0,
  maxProbes: 2,
  remainingProbes: 2,
  nextProbeKind: "fit",
  canGoLive: false,
  probeEvaluations: [],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  pushMock.mockReset();
});

describe("ShiftConsole", () => {
  it("loads the manual artifact on initial render", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ShiftConsole initialShift={initialShift} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/shifts/shift_123/artifacts/manual.md", {
        cache: "no-store",
      });
    });

    expect(await screen.findByText("Manual")).toBeTruthy();
    expect(await screen.findByText("Route the calls.")).toBeTruthy();
  });

  it("debounces draft autosaves", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/artifacts/manual.md")) {
        return {
          ok: true,
          text: async () => "# Manual\nRoute the calls.",
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ShiftConsole initialShift={initialShift} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Editor" })[0]!);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "export function connect() { return { lineId: 'line-1' }; }" },
    });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/shifts/shift_123/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "export function connect() { return { lineId: 'line-1' }; }" }),
    });
  });

  it("runs validate, probe, and go-live flows through the shared route contracts", async () => {
    const validatedShift: ShiftView = {
      ...initialShift,
      latestValidAt: 50,
      canGoLive: true,
    };
    const probedShift: ShiftView = {
      ...validatedShift,
      probesUsed: 1,
      remainingProbes: 1,
      probeEvaluations: [
        {
          id: "eval_probe",
          kind: "fit",
          state: "completed",
          acceptedAt: 100,
          sourceHash: "hash-1",
          sourceSnapshot: "snapshot",
          probeSummary: {
            probeKind: "fit",
            deskCondition: "steady",
            metrics: {
              connectedCalls: 6,
              totalCalls: 10,
              droppedCalls: 1,
              avgHoldSeconds: 1.5,
              premiumUsageRate: 0.2,
              efficiency: 0.6,
            },
            callBucketTable: [],
            loadBandTable: [],
            lineGroupTable: [],
            failureBuckets: [],
            incidents: [],
          },
        },
      ],
    };
    const finalShift: ShiftView = {
      ...probedShift,
      status: "completed",
      reportPublicId: "public_123",
      finalEvaluation: {
        id: "eval_final",
        kind: "final",
        state: "completed",
        acceptedAt: 200,
        sourceHash: "hash-2",
        sourceSnapshot: "snapshot",
        reportPublicId: "public_123",
        title: "operator",
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
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/artifacts/manual.md")) {
        return {
          ok: true,
          text: async () => "# Manual\nRoute the calls.",
        };
      }
      if (url.endsWith("/validate")) {
        return {
          ok: true,
          json: async () => ({
            validation: { ok: true, normalizedSource: "normalized", sourceHash: "hash-1" },
            shift: validatedShift,
          }),
        };
      }
      if (url.endsWith("/probe")) {
        return {
          ok: true,
          json: async () => ({
            probeKind: "fit",
            summary: probedShift.probeEvaluations[0]?.probeSummary,
            shift: probedShift,
          }),
        };
      }
      if (url.endsWith("/go-live")) {
        return {
          ok: true,
          json: async () => ({
            shift: finalShift,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ShiftConsole initialShift={initialShift} />);

    fireEvent.click(await screen.findByRole("button", { name: /Validate/ }));
    expect(await screen.findByText("Module validated - ready to go live")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trial Shift/ }));
    expect(await screen.findByText("fit probe complete.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Go Live/ }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/report/public_123");
    });
  });

  it("shows action errors ahead of stale validation errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/artifacts/manual.md")) {
        return {
          ok: true,
          text: async () => "# Manual\nRoute the calls.",
        };
      }
      if (url.endsWith("/validate")) {
        return {
          ok: false,
          json: async () => ({ error: "Route validation failed" }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          latestValidationError: "Old validation error",
        }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Validate/ }));

    expect(await screen.findByText("Route validation failed")).toBeTruthy();
    expect(screen.queryByText("Old validation error")).toBeNull();
  });
});
