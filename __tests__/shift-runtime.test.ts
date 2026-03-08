import { describe, expect, it } from "vitest";
import { getNextProbeKind } from "../src/lib/app/shift-lifecycle";

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
});
