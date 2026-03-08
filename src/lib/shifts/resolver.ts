import type { ProbeKind } from "@/lib/domain/game";
import {
  buildFinalReport,
  createBoard,
  runFinal,
  runProbe,
  stableHash,
} from "@/lib/engine";
import { upsertReport } from "@/lib/repositories/report-repository";
import {
  acceptRunRecord,
  completeFinalRunRecord,
  completeProbeRunRecord,
  getOwnedShiftRecord,
  markExpiredNoResult,
} from "@/lib/repositories/shift-repository";
import type { StoredRunRecord, StoredShiftRecord } from "@/lib/repositories/records";
import { shouldAutoFinalize, shouldExpireWithoutResult } from "./lifecycle";
import { maybeStoreLeaderboard } from "./leaderboard";

function reportPublicIdForRun(shiftId: string, runId: string) {
  return stableHash(`${shiftId}:${runId}`).slice(0, 16);
}

export function createRunId() {
  return crypto.randomUUID();
}

async function finishProbeRun(shift: StoredShiftRecord, run: StoredRunRecord & { kind: ProbeKind }) {
  const board = createBoard(shift.seed);
  const { summary } = await runProbe({
    board,
    source: run.sourceSnapshot,
    probeKind: run.kind,
  });

  await completeProbeRunRecord({
    github: shift.github,
    shiftId: shift.id,
    runId: run.id,
    summary,
    resolvedAt: Date.now(),
  });
}

async function finishFinalRun(shift: StoredShiftRecord, run: StoredRunRecord) {
  const board = createBoard(shift.seed);
  const result = await runFinal({
    board,
    source: run.sourceSnapshot,
  });
  const achievedAt = Date.now();
  const report = buildFinalReport({
    shiftId: shift.id,
    github: shift.github,
    publicId: reportPublicIdForRun(shift.id, run.id),
    achievedAt,
    kind: run.trigger === "auto_expire" ? "auto_final" : "final",
    metrics: result.metrics,
    seed: shift.seed,
  });

  await upsertReport(report);
  await completeFinalRunRecord({
    github: shift.github,
    shiftId: shift.id,
    runId: run.id,
    reportPublicId: report.publicId,
    title: report.title,
    metrics: result.metrics,
    chiefOperatorNote: report.chiefOperatorNote,
    resolvedAt: achievedAt,
  });
  await maybeStoreLeaderboard(report);
}

export async function ensureResolvedShift(github: string, shiftId: string) {
  let shift = await getOwnedShiftRecord(github, shiftId);

  while (shift) {
    const acceptedRun = shift.runs.find((run) => run.state === "accepted");
    if (acceptedRun) {
      if (acceptedRun.kind === "final") {
        await finishFinalRun(shift, acceptedRun);
      } else {
        await finishProbeRun(shift, acceptedRun as StoredRunRecord & { kind: ProbeKind });
      }
      shift = await getOwnedShiftRecord(github, shiftId);
      continue;
    }

    const now = Date.now();
    if (shouldAutoFinalize(shift, now) && shift.latestValidSource && shift.latestValidSourceHash) {
      await acceptRunRecord({
        github,
        shiftId,
        run: {
          id: createRunId(),
          kind: "final",
          trigger: "auto_expire",
          acceptedAt: shift.expiresAt,
          sourceHash: shift.latestValidSourceHash,
          sourceSnapshot: shift.latestValidSource,
        },
      });
      shift = await getOwnedShiftRecord(github, shiftId);
      continue;
    }

    if (shouldExpireWithoutResult(shift, now)) {
      await markExpiredNoResult({
        github,
        shiftId,
        completedAt: shift.expiresAt,
      });
      shift = await getOwnedShiftRecord(github, shiftId);
      continue;
    }

    return shift;
  }

  return null;
}

export function requireValidSource(shift: StoredShiftRecord) {
  if (!shift.latestValidSource || !shift.latestValidSourceHash) {
    throw new Error("valid module required");
  }

  return {
    source: shift.latestValidSource,
    sourceHash: shift.latestValidSourceHash,
  };
}
