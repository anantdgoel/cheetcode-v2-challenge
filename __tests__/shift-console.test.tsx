// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShiftConsole from "../src/components/ShiftConsole";
import type { ShiftView } from "../src/lib/types";

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
  vi.restoreAllMocks();
});

describe("ShiftConsole artifact loading", () => {
  it("renders raw text returned by the artifact route", async () => {
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

    expect(await screen.findByText("# Manual\nRoute the calls.")).toBeTruthy();
  });
});
