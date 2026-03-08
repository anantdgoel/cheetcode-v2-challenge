import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGameSnapshot } from "../src/lib/exchange";

describe("Convex validator wiring", () => {
  it("uses explicit completion mutation arguments instead of opaque payloads", () => {
    const submissionsSource = fs.readFileSync("convex/submissions.ts", "utf8");

    expect(submissionsSource.includes("payload: v.any()")).toBe(false);
    expect(submissionsSource.includes("probeSummary: probeSummaryValidator")).toBe(true);
    expect(submissionsSource.includes("metrics: simulationMetricsValidator")).toBe(true);
  });

  it("stores probe summaries with the shared validator shape", () => {
    const schemaSource = fs.readFileSync("convex/schema.ts", "utf8");
    const serviceSource = fs.readFileSync("src/lib/shift-service.ts", "utf8");

    expect(schemaSource.includes("probeSummary: v.optional(probeSummaryValidator)")).toBe(true);
    expect(serviceSource.includes("probeSummary: {")).toBe(true);
    expect(serviceSource.includes("metrics: {")).toBe(true);
  });

  it("does not persist oversized deterministic snapshots in Convex", () => {
    const schemaSource = fs.readFileSync("convex/schema.ts", "utf8");
    const sessionsSource = fs.readFileSync("convex/sessions.ts", "utf8");
    const typesSource = fs.readFileSync("src/lib/types.ts", "utf8");
    const snapshotBytes = Buffer.byteLength(JSON.stringify(buildGameSnapshot("size-budget-seed")));

    expect(snapshotBytes).toBeGreaterThan(1024 * 1024);
    expect(schemaSource.includes("gameSnapshot:")).toBe(false);
    expect(sessionsSource.includes("gameSnapshot: artifacts.gameSnapshot")).toBe(false);
    expect(typesSource.includes("gameSnapshot: GeneratedGameSnapshot")).toBe(true);
    expect(typesSource.includes("seed: string")).toBe(true);
  });
});
