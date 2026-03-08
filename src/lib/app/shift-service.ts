import type { ArtifactName, ProbeKind, ProbeSummary } from "@/lib/contracts/game";
import type { GoLiveCommand, GoLiveResult, RunProbeCommand, RunProbeResult, SaveDraftCommand, ValidateDraftCommand, ValidateDraftResult } from "@/lib/contracts/api";
import type { LandingView } from "@/lib/contracts/views";
import { buildArtifactContent, buildFinalReport, buildStarterPolicy, createBoard, runFinal, runProbe, stableHash, validatePolicy } from "@/lib/engine";
import { validateDraftSource } from "@/lib/validation";
import { getAdminSnapshotRecord } from "@/lib/data/admin-repository";
import { getLeaderboardEntryForGithub, getPublicLeaderboard, upsertLeaderboardEntry } from "@/lib/data/leaderboard-repository";
import { getReportByPublicId, upsertReport } from "@/lib/data/report-repository";
import {
  acceptRunRecord,
  completeFinalRunRecord,
  completeProbeRunRecord,
  createShiftRecord,
  getLatestShiftRecord,
  getOwnedShiftRecord,
  markExpiredNoResult,
  recordArtifactFetch,
  saveDraftRecord,
  storeValidationRecord,
} from "@/lib/data/shift-repository";
import type { StoredRunRecord, StoredShiftRecord } from "@/lib/data/types";
import { shapeLandingView } from "./landing-view";
import { canEditShift, PHASE_1_MS, PROBE_ORDER, SHIFT_MS, shouldAutoFinalize, shouldExpireWithoutResult } from "./shift-lifecycle";
import { shapeShiftView } from "./shift-view";

/**
 * Application service for the shift flow. This is the only backend layer that
 * combines lifecycle rules, persistence, engine execution, and DTO shaping.
 */
function reportPublicIdForRun(shiftId: string, runId: string) {
  return stableHash(`${shiftId}:${runId}`).slice(0, 16);
}

function createRunId() {
  return crypto.randomUUID();
}

function isBetterLeaderboardCandidate(
  current: Awaited<ReturnType<typeof getLeaderboardEntryForGithub>>,
  candidate: {
    hiddenScore: number;
    boardEfficiency: number;
    achievedAt: number;
  },
) {
  if (!current) return true;
  if (candidate.hiddenScore !== current.hiddenScore) return candidate.hiddenScore > current.hiddenScore;
  if (candidate.boardEfficiency !== current.boardEfficiency) return candidate.boardEfficiency > current.boardEfficiency;
  return candidate.achievedAt < current.achievedAt;
}

async function maybeStoreLeaderboard(report: Awaited<ReturnType<typeof getReportByPublicId>>) {
  if (!report) return;
  const current = await getLeaderboardEntryForGithub(report.github);
  if (
    !isBetterLeaderboardCandidate(current, {
      hiddenScore: report.hiddenScore,
      boardEfficiency: report.boardEfficiency,
      achievedAt: report.achievedAt,
    })
  ) {
    return;
  }
  await upsertLeaderboardEntry({
    github: report.github,
    title: report.title,
    boardEfficiency: report.boardEfficiency,
    hiddenScore: report.hiddenScore,
    achievedAt: report.achievedAt,
    shiftId: report.shiftId,
    publicId: report.publicId,
    connectedCalls: report.connectedCalls,
    totalCalls: report.totalCalls,
    droppedCalls: report.droppedCalls,
    avgHoldSeconds: report.avgHoldSeconds,
  });
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

async function ensureResolvedShift(github: string, shiftId: string) {
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

function requireValidSource(shift: StoredShiftRecord) {
  if (!shift.latestValidSource || !shift.latestValidSourceHash) {
    throw new Error("valid module required");
  }
  return {
    source: shift.latestValidSource,
    sourceHash: shift.latestValidSourceHash,
  };
}

export async function startShiftForGithub(github: string) {
  const current = await getCurrentShiftForGithub(github);
  if (current) {
    throw new Error(`active shift:${current.id}`);
  }

  const now = Date.now();
  const starterSource = buildStarterPolicy();
  const starterValidation = await validatePolicy(starterSource);
  if (!starterValidation.ok) {
    throw new Error("starter policy invalid");
  }

  const shift = await createShiftRecord({
    github,
    seed: crypto.randomUUID(),
    artifactVersion: 1,
    starterSource,
    starterValidation,
    now,
    phase1EndsAt: now + PHASE_1_MS,
    expiresAt: now + SHIFT_MS,
  });

  return shift ? shapeShiftView(shift, Date.now()) : null;
}

export async function getCurrentShiftForGithub(github: string) {
  const latest = await getLatestShiftRecord(github);
  if (!latest) return null;
  const shift = await ensureResolvedShift(github, latest.id);
  if (!shift) return null;

  const view = shapeShiftView(shift, Date.now());
  return view.status === "completed" || view.status === "expired_no_result" ? null : view;
}

export async function getOwnedShiftForGithub(github: string, shiftId: string) {
  const shift = await ensureResolvedShift(github, shiftId);
  return shift ? shapeShiftView(shift, Date.now()) : null;
}

export async function saveDraftForGithub(params: SaveDraftCommand) {
  const shift = await ensureResolvedShift(params.github, params.shiftId);
  if (!shift || !canEditShift(shift, Date.now())) {
    throw new Error("shift is no longer editable");
  }
  const draft = validateDraftSource(params.source);
  if (draft.ok === false) {
    throw new Error(draft.error);
  }
  await saveDraftRecord({
    github: params.github,
    shiftId: params.shiftId,
    source: draft.value,
    savedAt: params.savedAt ?? Date.now(),
  });
  return getOwnedShiftForGithub(params.github, params.shiftId);
}

export async function validateDraftForGithub(params: ValidateDraftCommand): Promise<ValidateDraftResult> {
  const shift = await ensureResolvedShift(params.github, params.shiftId);
  if (!shift || !canEditShift(shift, Date.now())) {
    throw new Error("shift is no longer editable");
  }
  const validation = await validatePolicy(params.source);
  await storeValidationRecord({
    github: params.github,
    shiftId: params.shiftId,
    source: validation.ok ? validation.normalizedSource : params.source.trim(),
    validation,
    checkedAt: Date.now(),
  });

  return {
    validation,
    shift: await getOwnedShiftForGithub(params.github, params.shiftId),
  };
}

export async function runProbeForGithub(params: RunProbeCommand): Promise<RunProbeResult> {
  const shift = await ensureResolvedShift(params.github, params.shiftId);
  if (!shift) {
    throw new Error("shift not found");
  }
  if (shift.state !== "active" || Date.now() >= shift.expiresAt) {
    throw new Error("shift expired");
  }
  if (shift.runs.some((run) => run.state === "accepted")) {
    throw new Error("evaluation already in progress");
  }

  const nextProbeKind = PROBE_ORDER.find((kind) => !shift.runs.some((run) => run.kind === kind && run.state === "completed"));
  if (!nextProbeKind) {
    throw new Error("all probes exhausted");
  }

  const { source, sourceHash } = requireValidSource(shift);
  const acceptedAt = Date.now();
  const runId = createRunId();
  await acceptRunRecord({
    github: params.github,
    shiftId: params.shiftId,
    run: {
      id: runId,
      kind: nextProbeKind,
      trigger: "manual",
      acceptedAt,
      sourceHash,
      sourceSnapshot: source,
    },
  });

  const resolved = await ensureResolvedShift(params.github, params.shiftId);
  if (!resolved) {
    throw new Error("probe summary unavailable");
  }
  const completedProbe = resolved.runs.find((run) => run.id === runId && run.probeSummary);
  if (!completedProbe?.probeSummary) {
    throw new Error("probe summary unavailable");
  }

  return {
    probeKind: nextProbeKind,
    summary: completedProbe.probeSummary as ProbeSummary,
    shift: shapeShiftView(resolved, Date.now()),
  };
}

export async function goLiveForGithub(params: GoLiveCommand): Promise<GoLiveResult> {
  const shift = await ensureResolvedShift(params.github, params.shiftId);
  if (!shift) {
    throw new Error("shift not found");
  }
  if (shift.runs.some((run) => run.state === "accepted")) {
    throw new Error("evaluation already in progress");
  }
  if (shift.runs.some((run) => run.kind === "final")) {
    const resolved = await ensureResolvedShift(params.github, params.shiftId);
    if (!resolved) {
      throw new Error("final evaluation unavailable");
    }
    return { shift: shapeShiftView(resolved, Date.now()) };
  }

  const { source, sourceHash } = requireValidSource(shift);
  await acceptRunRecord({
    github: params.github,
    shiftId: params.shiftId,
    run: {
      id: createRunId(),
      kind: "final",
      trigger: "manual",
      acceptedAt: Date.now(),
      sourceHash,
      sourceSnapshot: source,
    },
  });

  const resolved = await ensureResolvedShift(params.github, params.shiftId);
  if (!resolved || !resolved.runs.some((run) => run.kind === "final" && run.state === "completed")) {
    throw new Error("final evaluation unavailable");
  }

  return { shift: shapeShiftView(resolved, Date.now()) };
}

export async function getLandingView(github: string | null): Promise<LandingView> {
  const [leaderboardResult, currentShiftResult] = await Promise.allSettled([
    getPublicLeaderboard(),
    github ? getCurrentShiftForGithub(github) : Promise.resolve(null),
  ]);

  return shapeLandingView({
    leaderboard: leaderboardResult.status === "fulfilled" ? leaderboardResult.value : [],
    activeShiftId: currentShiftResult.status === "fulfilled" ? currentShiftResult.value?.id ?? null : null,
    github,
  });
}

export async function getReportView(publicId: string) {
  return getReportByPublicId(publicId);
}

export async function getArtifactForShift(github: string, shiftId: string, name: string) {
  const shift = await ensureResolvedShift(github, shiftId);
  if (!shift) return null;

  const view = shapeShiftView(shift, Date.now());
  if (view.status !== "active_phase_1" && view.status !== "active_phase_2") {
    return null;
  }

  const artifactName = name as ArtifactName;
  if (!["manual.md", "starter.js", "lines.json", "observations.jsonl"].includes(artifactName)) {
    return null;
  }

  await recordArtifactFetch({
    github,
    shiftId,
    name: artifactName,
    at: Date.now(),
  });

  const content = buildArtifactContent(artifactName, createBoard(shift.seed));
  const type =
    artifactName === "manual.md"
      ? "text/markdown"
      : artifactName === "starter.js"
        ? "text/javascript"
        : artifactName === "lines.json"
          ? "application/json"
          : "application/x-ndjson";

  return { content: content.content, type };
}

export async function getAdminSnapshot(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}) {
  return getAdminSnapshotRecord(params);
}
