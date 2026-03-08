import { describe, expect, it } from "vitest";
import { buildShiftArtifacts, createBoard, runFinal, simulateExchange } from "../src/lib/engine/index";
import {
  BENCHMARK_SEEDS,
  buildHiringBarPolicySource,
  createHiringBarDecision,
  inferHiringBarModelFromArtifacts,
} from "../scripts/v3-agent-policies.mjs";

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function expectHiringBarParity(seed: string, options?: { useTempo?: boolean }) {
  const board = createBoard(seed);
  const artifacts = buildShiftArtifacts(board);
  const source = buildHiringBarPolicySource(artifacts, options);
  const decide = createHiringBarDecision(artifacts, options);

  const generated = await runFinal({
    source,
    board,
  });
  const local = await simulateExchange({
    board,
    mode: "final",
    decide: (input) => Promise.resolve(decide(input)),
  });

  expect(local.metrics).toEqual(generated.metrics);
  expect(local.title).toBe(generated.title);
}

describe("artifact-driven hiring-bar agent", () => {
  it("builds a board-specific policy source", () => {
    const artifacts = buildShiftArtifacts("alpha-switch");
    const source = buildHiringBarPolicySource(artifacts);

    expect(source).toContain("function connect(input)");
    expect(source).toContain("__MODEL__");
    expect(source.length).toBeLessThan(40_000);
  });

  it("keeps generated hiring-bar policies under the 16 KB validation limit", () => {
    for (const seed of BENCHMARK_SEEDS) {
      const source = buildHiringBarPolicySource(buildShiftArtifacts(seed));
      expect(new TextEncoder().encode(source).length).toBeLessThan(16_000);
    }
  });

  it("recovers the visible-to-hidden rotation on most benchmark boards", () => {
    let recovered = 0;

    for (const seed of BENCHMARK_SEEDS) {
      const board = createBoard(seed);
      const artifacts = buildShiftArtifacts(board);
      const inferred = inferHiringBarModelFromArtifacts(artifacts);
      const expected = Object.fromEntries(
        Object.entries(board.visibleFamilyPermutation).map(([hiddenFamily, visibleFamily]) => [
          visibleFamily,
          hiddenFamily,
        ]),
      );

      const matchedAll = Object.entries(expected).every(
        ([visibleFamily, hiddenFamily]) =>
          inferred.inferredHiddenFamilyByVisibleFamily[visibleFamily] === hiddenFamily,
      );

      if (matchedAll) recovered += 1;
    }

    expect(recovered / BENCHMARK_SEEDS.length).toBeGreaterThanOrEqual(0.7);
  });

  it("uses tempo-aware adaptation to beat the non-adaptive version on finals", async () => {
    const adaptiveEfficiencies: number[] = [];
    const staticEfficiencies: number[] = [];

    for (const seed of BENCHMARK_SEEDS) {
      const artifacts = buildShiftArtifacts(seed);
      const adaptive = createHiringBarDecision(artifacts, { useTempo: true });
      const nonAdaptive = createHiringBarDecision(artifacts, { useTempo: false });

      const adaptiveResult = await simulateExchange({
        seed,
        mode: "final",
        decide: (input) => Promise.resolve(adaptive(input)),
      });
      const staticResult = await simulateExchange({
        seed,
        mode: "final",
        decide: (input) => Promise.resolve(nonAdaptive(input)),
      });

      adaptiveEfficiencies.push(adaptiveResult.metrics.efficiency);
      staticEfficiencies.push(staticResult.metrics.efficiency);
    }

    expect(average(adaptiveEfficiencies) - average(staticEfficiencies)).toBeGreaterThanOrEqual(0.08);
  });

  it("matches generated-source behavior for the tempo-aware policy", async () => {
    await expectHiringBarParity("alpha-switch");
  });

  it("matches generated-source behavior when tempo adaptation is disabled", async () => {
    await expectHiringBarParity("broadway-night", { useTempo: false });
  });
});
