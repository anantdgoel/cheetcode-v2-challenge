// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShiftConsole from "../src/features/shift/ShiftConsole";
import type { ShiftView } from "../src/lib/domain/views";

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
  phase1EndsAt: Date.now() + 120_000,
  expiresAt: Date.now() + 5 * 60_000,
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
  it("shows a calm early-phase clock cue before the room tightens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ShiftConsole initialShift={initialShift} />);

    expect(await screen.findByText("Board open")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial Shift \(2\)/ })).toBeTruthy();
  });

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

    expect(screen.getByRole("button", { name: /Trial Shift \(2\)/ })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Validate/ }));
    expect(await screen.findByText("Module validated - ready to go live")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trial Shift \(2\)/ }));
    expect(await screen.findByText("Day room read complete.")).toBeTruthy();
    expect(await screen.findByText("Chief Operator Notes")).toBeTruthy();
    expect(await screen.findByText("Likely final-shift sensitive")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial Shift \(1\)/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Go Live/ }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/report/public_123");
    });
  });

  it("keeps the trial action active while a second probe remains", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          latestValidAt: 25,
          canGoLive: true,
          probesUsed: 1,
          remainingProbes: 1,
          nextProbeKind: "stress",
        }}
      />,
    );

    expect(await screen.findByRole("button", { name: /Trial Shift \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial Shift \(1\)/ }).hasAttribute("disabled")).toBe(false);
  });

  it("shows zero trials after both probes are spent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          latestValidAt: 25,
          canGoLive: true,
          probesUsed: 2,
          remainingProbes: 0,
          nextProbeKind: undefined,
        }}
      />,
    );

    expect(await screen.findByRole("button", { name: /Trial Shift \(0\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial Shift \(0\)/ }).hasAttribute("disabled")).toBe(true);
  });

  it("redirects to the report after expiry auto-submits a valid draft", async () => {
    const completedShift: ShiftView = {
      ...initialShift,
      status: "completed",
      reportPublicId: "public_auto",
      finalEvaluation: {
        id: "eval_auto",
        kind: "auto_final",
        state: "completed",
        acceptedAt: 200,
        sourceHash: "hash-auto",
        sourceSnapshot: "snapshot",
        reportPublicId: "public_auto",
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
      if (url.endsWith("/api/shifts/shift_123")) {
        return {
          ok: true,
          json: async () => ({ shift: completedShift }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          status: "active_phase_2",
          phase1EndsAt: Date.now() - 30_000,
          latestValidAt: 25,
          latestValidSource: "function connect() { return { lineId: null }; }",
          expiresAt: Date.now() - 1_000,
        }}
      />,
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/report/public_auto");
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

  it("warns about auto-submit during the final minute", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          status: "active_phase_2",
          nextProbeKind: undefined,
          latestValidAt: 25,
          latestValidSource: "function connect() { return { lineId: null }; }",
          canGoLive: true,
          expiresAt: Date.now() + 9_000,
        }}
      />,
    );

    expect(await screen.findByText("Last bell armed")).toBeTruthy();
    expect(
      await screen.findByText("Last bell. The last valid draft goes live at the whistle."),
    ).toBeTruthy();
  });

  it("closes the trial action in phase two", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Manual\nRoute the calls.",
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShiftConsole
        initialShift={{
          ...initialShift,
          status: "active_phase_2",
          phase1EndsAt: Date.now() - 1_000,
          nextProbeKind: undefined,
          latestValidAt: 25,
          canGoLive: true,
        }}
      />,
    );

    expect(await screen.findByText("Trial floor closed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial Shift/ }).hasAttribute("disabled")).toBe(true);
  });
});
