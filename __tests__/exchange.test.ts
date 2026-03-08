import { describe, expect, it } from "vitest";
import {
  buildArtifactContent,
  buildReport,
  buildShiftArtifacts,
  computeHiddenScore,
  createBoard,
  createObservations,
  createPressureCurve,
  createTraffic,
  getTitleForScore,
} from "../src/lib/engine/index";

function buildBoardSnapshot(seed: string) {
  const board = createBoard(seed);
  return {
    ...board,
    finalShift: board.finalPhaseChange,
    probePressureCurves: {
      fit: createPressureCurve(board, "fit"),
      stress: createPressureCurve(board, "stress"),
    },
    probeTrafficPlans: {
      fit: createTraffic(board, "fit"),
      stress: createTraffic(board, "stress"),
    },
    finalTrafficPlan: createTraffic(board, "final"),
    observations: createObservations(board),
  };
}

describe("exchange artifacts", () => {
  it("builds deterministic v3 artifacts for a fixed seed", () => {
    const first = buildShiftArtifacts("madison-seed");
    const second = buildShiftArtifacts("madison-seed");
    const firstSnapshot = buildBoardSnapshot("madison-seed");
    const secondSnapshot = buildBoardSnapshot("madison-seed");

    expect(first.manualMd).toBe(second.manualMd);
    expect(first.starterJs).toBe(second.starterJs);
    expect(first.linesJson).toBe(second.linesJson);
    expect(first.observationsJsonl).toBe(second.observationsJsonl);
    expect(firstSnapshot.probeTrafficPlans.fit).toEqual(secondSnapshot.probeTrafficPlans.fit);
    expect(firstSnapshot.probeTrafficPlans.stress).toEqual(secondSnapshot.probeTrafficPlans.stress);
    expect(firstSnapshot.finalTrafficPlan).toEqual(secondSnapshot.finalTrafficPlan);
    expect(firstSnapshot.visibleFamilyPermutation).toEqual(secondSnapshot.visibleFamilyPermutation);
    expect(firstSnapshot.visibleNoiseRate).toBe(secondSnapshot.visibleNoiseRate);
    expect(firstSnapshot.finalShift).toEqual(secondSnapshot.finalShift);
  });

  it("uses two probes and one final plan", () => {
    const snapshot = buildBoardSnapshot("probe-layout");
    expect(Object.keys(snapshot.probePressureCurves)).toEqual(["fit", "stress"]);
    expect(Object.keys(snapshot.probeTrafficPlans)).toEqual(["fit", "stress"]);
    expect(snapshot.probeTrafficPlans.fit.length).toBeGreaterThan(90);
    expect(snapshot.probeTrafficPlans.stress.length).toBeGreaterThan(90);
    expect(snapshot.finalTrafficPlan.length).toBeGreaterThan(300);
    expect(snapshot.finalShift.shiftPoint).toBeGreaterThanOrEqual(150);
    expect(snapshot.finalShift.shiftPoint).toBeLessThanOrEqual(270);
  });

  it("includes public line groups and board-specific observations", () => {
    const artifacts = buildShiftArtifacts("obs-seed");
    const lines = JSON.parse(artifacts.linesJson);
    const firstObservation = JSON.parse(artifacts.observationsJsonl.split("\n")[0]!);
    const lineGroupIds = new Set(lines.map((line: { lineGroupId: string }) => line.lineGroupId));

    expect(lines[0].lineGroupId).toBeTruthy();
    expect(firstObservation.historicalLineGroup).toBeTruthy();
    expect(firstObservation.context.loadBand).toMatch(/low|medium|high|peak/);
    expect(lineGroupIds.has(firstObservation.historicalLineGroup)).toBe(true);
  });

  it("keeps server-only board metadata out of public artifacts", () => {
    const artifacts = buildShiftArtifacts("manual-seed");
    const manual = artifacts.manualMd;
    const publicBlob = `${manual}\n${artifacts.linesJson}\n${artifacts.observationsJsonl}`;
    expect(manual).not.toContain("district");
    expect(manual).not.toContain("relay");
    expect(publicBlob).not.toContain("visibleFamilyPermutation");
    expect(publicBlob).not.toContain("visibleNoiseRate");
    expect(publicBlob).not.toContain("finalShift");
  });

  it("keeps hidden board metadata out of artifact route content", () => {
    const snapshot = createBoard("route-seed");
    const publicBlob = [
      buildArtifactContent("manual.md", snapshot).content,
      buildArtifactContent("starter.js", snapshot).content,
      buildArtifactContent("lines.json", snapshot).content,
      buildArtifactContent("observations.jsonl", snapshot).content,
    ].join("\n");

    expect(publicBlob).not.toContain("visibleFamilyPermutation");
    expect(publicBlob).not.toContain("visibleNoiseRate");
    expect(publicBlob).not.toContain("finalShift");
  });

  it("keeps the visible rotation noisy but bounded", () => {
    const seenPermutations = new Set<string>();
    for (const seed of ["alpha-switch", "broadway-night", "uptown-rush", "vermont-wire", "switchyard-7"]) {
      const snapshot = createBoard(seed);
      seenPermutations.add(JSON.stringify(snapshot.visibleFamilyPermutation));
      expect(snapshot.visibleNoiseRate).toBeGreaterThanOrEqual(0.18);
      expect(snapshot.visibleNoiseRate).toBeLessThanOrEqual(0.22);
    }

    expect(seenPermutations.size).toBeGreaterThan(1);
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
