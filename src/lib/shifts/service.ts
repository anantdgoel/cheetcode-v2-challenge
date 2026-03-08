import type { ArtifactName } from "@/lib/domain/game";
import type {
  GoLiveCommand,
  GoLiveResult,
  RunProbeCommand,
  RunProbeResult,
  SaveDraftCommand,
  ValidateDraftCommand,
  ValidateDraftResult,
} from "@/lib/domain/commands";
import type { LandingView } from "@/lib/domain/views";
import { buildArtifactContent, buildStarterPolicy, validatePolicy } from "@/lib/engine";
import { getAdminSnapshotRecord } from "@/lib/repositories/admin-repository";
import { getPublicLeaderboard } from "@/lib/repositories/leaderboard-repository";
import { getReportByPublicId } from "@/lib/repositories/report-repository";
import {
  acceptRunRecord,
  createShiftRecord,
  getLatestShiftRecord,
  getOwnedShiftRecord,
  recordArtifactFetch,
  saveDraftRecord,
  storeValidationRecord,
} from "@/lib/repositories/shift-repository";
import { validateDraftSource } from "@/lib/validation";
import { canEditShift, PHASE_1_MS, PROBE_ORDER, SHIFT_MS } from "./lifecycle";
import { createRunId, ensureResolvedShift, requireValidSource } from "./resolver";
import { shapeShiftView } from "./view";

const SHIFT_ARTIFACTS = [
  "manual.md",
  "starter.js",
  "lines.json",
  "observations.jsonl",
] as const satisfies readonly ArtifactName[];

const SHIFT_ARTIFACT_TYPES: Record<ArtifactName, string> = {
  "manual.md": "text/markdown",
  "starter.js": "text/javascript",
  "lines.json": "application/json",
  "observations.jsonl": "application/x-ndjson",
};

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

export async function validateDraftForGithub(
  params: ValidateDraftCommand,
): Promise<ValidateDraftResult> {
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
  const now = Date.now();
  if (!shift) {
    throw new Error("shift not found");
  }
  if (shift.state !== "active" || now >= shift.expiresAt) {
    throw new Error("shift expired");
  }
  if (now >= shift.phase1EndsAt) {
    throw new Error("trial window closed");
  }
  if (shift.runs.some((run) => run.state === "accepted")) {
    throw new Error("evaluation already in progress");
  }

  const nextProbeKind = PROBE_ORDER.find(
    (kind) => !shift.runs.some((run) => run.kind === kind && run.state === "completed"),
  );
  if (!nextProbeKind) {
    throw new Error("all probes exhausted");
  }

  const { source, sourceHash } = requireValidSource(shift);
  const runId = createRunId();
  await acceptRunRecord({
    github: params.github,
    shiftId: params.shiftId,
    run: {
      id: runId,
      kind: nextProbeKind,
      trigger: "manual",
      acceptedAt: now,
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
    summary: completedProbe.probeSummary,
    shift: shapeShiftView(resolved, now),
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

  return {
    leaderboard: leaderboardResult.status === "fulfilled" ? leaderboardResult.value : [],
    activeShiftId: currentShiftResult.status === "fulfilled" ? currentShiftResult.value?.id ?? null : null,
    github,
  };
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
  if (!SHIFT_ARTIFACTS.includes(artifactName)) {
    return null;
  }

  await recordArtifactFetch({
    github,
    shiftId,
    name: artifactName,
    at: Date.now(),
  });

  return {
    content: buildArtifactContent(artifactName, shift.seed),
    type: SHIFT_ARTIFACT_TYPES[artifactName],
  };
}

export async function getAdminSnapshot(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
}) {
  return getAdminSnapshotRecord(params);
}
