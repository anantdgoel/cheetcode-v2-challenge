import { describe, expect, it } from "vitest";
import { buildShiftArtifacts, buildStarterPolicy, simulateExchange, summarizeProbe, validatePolicy } from "../src/lib/engine/index";
import {
  BENCHMARK_SEEDS,
  buildHiringBarPolicySource,
  buildOldHeuristicPolicySource,
  buildSnapshotPolicySource,
  createHiringBarDecision,
  oldHeuristicDecision,
  snapshotDecision,
} from "../scripts/v3-agent-policies.mjs";

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("simulation signal", () => {
  it("returns structured probe summaries without hidden score leakage", async () => {
    const result = await simulateExchange({
      seed: "trial-seed",
      mode: "fit",
      decide: (input) => Promise.resolve(snapshotDecision(input)),
    });

    const summary = summarizeProbe(result, "fit");
    expect(summary.deskCondition).toMatch(/steady|strained|overrun/);
    expect("hiddenScore" in summary.metrics).toBe(false);
    expect(summary.callBucketTable.length).toBeGreaterThan(0);
    expect(summary.incidents.length).toBeLessThanOrEqual(8);
  });

  it("keeps the shipped starter under ten percent on the fixed benchmark suite", async () => {
    expect((await validatePolicy(buildStarterPolicy())).ok).toBe(true);
    const efficiencies: number[] = [];
    for (const seed of BENCHMARK_SEEDS) {
      const result = await simulateExchange({
        seed,
        mode: "final",
        decide: () => Promise.resolve({ lineId: null }),
      });
      efficiencies.push(result.metrics.efficiency);
    }
    expect(average(efficiencies)).toBeLessThan(0.1);
  });

  it("keeps the snapshot vanilla policy around thirty percent", async () => {
    expect((await validatePolicy(buildSnapshotPolicySource())).ok).toBe(true);
    const efficiencies: number[] = [];
    for (const seed of BENCHMARK_SEEDS) {
      const result = await simulateExchange({
        seed,
        mode: "final",
        decide: (input) => Promise.resolve(snapshotDecision(input)),
      });
      efficiencies.push(result.metrics.efficiency);
    }
    const avg = average(efficiencies);
    expect(avg).toBeGreaterThan(0.25);
    expect(avg).toBeLessThan(0.35);
  });

  it("drops the old heuristic and recovers with the artifact-driven hiring-bar policy", async () => {
    const sampleArtifacts = buildShiftArtifacts("alpha-switch");
    expect((await validatePolicy(buildOldHeuristicPolicySource())).ok).toBe(true);
    expect((await validatePolicy(buildHiringBarPolicySource(sampleArtifacts))).ok).toBe(true);

    const oldEfficiencies: number[] = [];
    const efficiencies: number[] = [];
    for (const seed of BENCHMARK_SEEDS) {
      const artifacts = buildShiftArtifacts(seed);
      const decide = createHiringBarDecision(artifacts);
      const oldResult = await simulateExchange({
        seed,
        mode: "final",
        decide: (input) => Promise.resolve(oldHeuristicDecision(input)),
      });
      const result = await simulateExchange({
        seed,
        mode: "final",
        decide: (input) => Promise.resolve(decide(input)),
      });
      oldEfficiencies.push(oldResult.metrics.efficiency);
      efficiencies.push(result.metrics.efficiency);
    }
    const oldAvg = average(oldEfficiencies);
    const avg = average(efficiencies);
    expect(oldAvg).toBeLessThanOrEqual(0.4);
    expect(avg).toBeGreaterThan(0.75);
    expect(avg).toBeLessThan(0.85);
  });
});
