import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("benchmark script separation", () => {
  it("keeps the hiring-bar benchmark offline", () => {
    const source = fs.readFileSync("scripts/run-hiring-bar-agent.mjs", "utf8");

    expect(source.includes("simulateExchange")).toBe(true);
    expect(source.includes("/api/shifts/")).toBe(false);
  });

  it("adds a separate user-flow harness that uses authenticated app routes", () => {
    const source = fs.readFileSync("scripts/run-user-flow-agent.mjs", "utf8");

    expect(source.includes('encode({')).toBe(true);
    expect(source.includes('"/api/shifts/start"')).toBe(true);
    expect(source.includes('"/api/shifts/')).toBe(true);
    expect(source.includes("buildHiringBarPolicySource")).toBe(true);
  });
});
