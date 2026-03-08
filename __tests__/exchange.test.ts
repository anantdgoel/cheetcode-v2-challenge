import { describe, expect, it } from "vitest";
import {
  buildGameSnapshot,
  buildReport,
  buildShiftArtifacts,
  computeHiddenScore,
  getTitleForScore,
} from "../src/lib/exchange";

describe("exchange artifacts", () => {
  it("builds deterministic v3 artifacts for a fixed seed", () => {
    const first = buildShiftArtifacts("madison-seed");
    const second = buildShiftArtifacts("madison-seed");

    expect(first.manualMd).toBe(second.manualMd);
    expect(first.starterJs).toBe(second.starterJs);
    expect(first.linesJson).toBe(second.linesJson);
    expect(first.observationsJsonl).toBe(second.observationsJsonl);
    expect(first.gameSnapshot.probeTrafficPlans.fit).toEqual(second.gameSnapshot.probeTrafficPlans.fit);
    expect(first.gameSnapshot.probeTrafficPlans.stress).toEqual(second.gameSnapshot.probeTrafficPlans.stress);
    expect(first.gameSnapshot.finalTrafficPlan).toEqual(second.gameSnapshot.finalTrafficPlan);
  });

  it("uses two probes and one final plan", () => {
    const snapshot = buildGameSnapshot("probe-layout");
    expect(Object.keys(snapshot.probePressureCurves)).toEqual(["fit", "stress"]);
    expect(Object.keys(snapshot.probeTrafficPlans)).toEqual(["fit", "stress"]);
    expect(snapshot.probeTrafficPlans.fit.length).toBeGreaterThan(90);
    expect(snapshot.probeTrafficPlans.stress.length).toBeGreaterThan(90);
    expect(snapshot.finalTrafficPlan.length).toBeGreaterThan(300);
  });

  it("includes public line groups and family-level observations", () => {
    const artifacts = buildShiftArtifacts("obs-seed");
    const lines = JSON.parse(artifacts.linesJson);
    const firstObservation = JSON.parse(artifacts.observationsJsonl.split("\n")[0]!);

    expect(lines[0].lineGroupId).toBeTruthy();
    expect(firstObservation.historicalLineGroup).toBeTruthy();
    expect(firstObservation.context.loadBand).toMatch(/low|medium|high|peak/);
  });

  it("keeps the manual thematic without exposing hidden family names", () => {
    const manual = buildShiftArtifacts("manual-seed").manualMd;
    expect(manual).not.toContain("district");
    expect(manual).not.toContain("relay");
  });
});

describe("exchange scoring", () => {
  it("maps scores into the expected title bands", () => {
    expect(getTitleForScore(0.89)).toBe("chief_operator");
    expect(getTitleForScore(0.8)).toBe("senior_operator");
    expect(getTitleForScore(0.6)).toBe("operator");
    expect(getTitleForScore(0.43)).toBe("trainee");
    expect(getTitleForScore(0.2)).toBe("off_the_board");
  });

  it("computes a normalized hidden score", () => {
    const score = computeHiddenScore({
      connectedCalls: 280,
      totalCalls: 400,
      droppedCalls: 64,
      totalHoldSeconds: 1200,
      trunkMisuseCount: 12,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("builds a public final report", () => {
    const report = buildReport({
      shiftId: "shift-1",
      github: "operator",
      publicId: "report-1",
      achievedAt: 1_716_000_000_000,
      kind: "final",
      seed: "report-seed",
      metrics: {
        connectedCalls: 310,
        totalCalls: 400,
        droppedCalls: 45,
        avgHoldSeconds: 9.2,
        totalHoldSeconds: 3680,
        premiumUsageCount: 58,
        premiumUsageRate: 0.145,
        trunkMisuseCount: 7,
        efficiency: 0.775,
        hiddenScore: 0.802,
      },
    });

    expect(report.title).toBe("senior_operator");
    expect(report.chiefOperatorNote.length).toBeGreaterThan(10);
    expect(report.kind).toBe("final");
  });
});
