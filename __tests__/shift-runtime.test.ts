import { describe, expect, it } from "vitest";
import { getNextProbeKind, recordFirstArtifactFetch } from "../src/lib/shift-runtime";

describe("shift runtime helpers", () => {
  it("advances through the two v3 probes", () => {
    expect(getNextProbeKind([])).toBe("fit");
    expect(getNextProbeKind([{ kind: "fit", state: "completed" }])).toBe("stress");
    expect(
      getNextProbeKind([
        { kind: "fit", state: "completed" },
        { kind: "stress", state: "completed" },
      ]),
    ).toBeUndefined();
  });

  it("records each artifact fetch only once", () => {
    const first = recordFirstArtifactFetch([], "manual.md", 10);
    const second = recordFirstArtifactFetch(first, "manual.md", 20);
    const third = recordFirstArtifactFetch(second, "observations.jsonl", 30);

    expect(third).toEqual([
      { name: "manual.md", at: 10 },
      { name: "observations.jsonl", at: 30 },
    ]);
  });
});
