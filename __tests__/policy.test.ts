import { describe, expect, it } from "vitest";
import { buildShiftArtifacts, buildStarterPolicy, runFinal, validatePolicy } from "../src/lib/engine/index";
import { buildHiringBarPolicySource } from "../scripts/v3-agent-policies.mjs";

describe("policy validation", () => {
  it("accepts the shipped starter policy", async () => {
    const result = await validatePolicy(buildStarterPolicy());
    expect(result.ok).toBe(true);
  });

  it("rejects drafts without connect()", async () => {
    const result = await validatePolicy("function nope() { return { lineId: null }; }");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid return shapes", async () => {
    const result = await validatePolicy(`
      function connect() {
        return "line-01";
      }
    `);
    expect(result.ok).toBe(false);
  });

  it("rejects obvious infinite-loop patterns before evaluation", async () => {
    const result = await validatePolicy(`
      function connect() {
        while (true) {}
      }
    `);
    expect(result.ok).toBe(false);
  });

  it("can execute the same submitted policy across a full shift", async () => {
    const artifacts = buildShiftArtifacts("alpha-switch");
    const result = await runFinal({
      source: buildHiringBarPolicySource(artifacts),
      seed: "alpha-switch",
    });

    expect(result.metrics.efficiency).toBeGreaterThan(0.45);
    expect(result.metrics.connectedCalls).toBeGreaterThan(150);
  });
});
