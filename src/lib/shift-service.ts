import type { Id } from "../../convex/_generated/dataModel";
import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/convex-server";
import { buildFinalReport, runFinal, runProbe, validatePolicy } from "@/lib/policy";
import { buildArtifactContent, buildGameSnapshot, stableHash } from "@/lib/exchange";
import { isProbeKind } from "@/lib/shift-runtime";
import type { ArtifactName, LandingView, ShiftView } from "@/lib/types";
import { validateDraftSource } from "@/lib/validation";

function toShiftId(value: string) {
  return value as Id<"shifts">;
}

function toEvaluationId(value: string) {
  return value as Id<"evaluations">;
}

function chunkTrace(trace: unknown[]) {
  const chunks: string[] = [];
  for (let index = 0; index < trace.length; index += 40) {
    chunks.push(JSON.stringify(trace.slice(index, index + 40)));
  }
  return chunks;
}

function reportPublicIdForEvaluation(shiftId: string, evaluationId: string) {
  return stableHash(`${shiftId}:${evaluationId}`).slice(0, 16);
}

const ARTIFACT_CONTENT_TYPES: Record<
  ArtifactName,
  { type: string }
> = {
  "manual.md": {
    type: "text/markdown",
  },
  "starter.js": {
    type: "text/javascript",
  },
  "lines.json": {
    type: "application/json",
  },
  "observations.jsonl": {
    type: "application/x-ndjson",
  },
};

async function getOwnedShiftRuntimeForGithub(github: string, shiftId: string) {
  const convex = getConvexServerClient();
  return convex.action(api.sessions.getOwnedShiftRuntime, {
    secret: getConvexMutationSecret(),
    github,
    shiftId: toShiftId(shiftId),
  });
}

async function resolvePendingEvaluations(github: string, shift: ShiftView) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();
  const runtime = await getOwnedShiftRuntimeForGithub(github, shift.id);
  if (!runtime) {
    throw new Error("shift runtime unavailable");
  }
  const gameSnapshot = buildGameSnapshot(runtime.seed);

  let currentShift: ShiftView | null = shift;
  while (currentShift) {
    const acceptedEvaluations = [...currentShift.probeEvaluations, currentShift.finalEvaluation]
      .filter((evaluation): evaluation is NonNullable<typeof evaluation> => !!evaluation)
      .filter((evaluation) => evaluation.state === "accepted")
      .sort((left, right) => left.acceptedAt - right.acceptedAt);

    const evaluation = acceptedEvaluations[0];
    if (!evaluation) {
      return;
    }

    if (isProbeKind(evaluation.kind)) {
      const { summary, result } = await runProbe({
        source: evaluation.sourceSnapshot,
        gameSnapshot,
        probeKind: evaluation.kind,
      });

      await convex.mutation(api.submissions.completeProbe, {
        secret,
        github,
        shiftId: toShiftId(currentShift.id),
        evaluationId: toEvaluationId(evaluation.id),
        probeSummary: {
          probeKind: summary.probeKind,
          deskCondition: summary.deskCondition,
          metrics: {
            connectedCalls: summary.metrics.connectedCalls,
            totalCalls: summary.metrics.totalCalls,
            droppedCalls: summary.metrics.droppedCalls,
            avgHoldSeconds: summary.metrics.avgHoldSeconds,
            premiumUsageRate: summary.metrics.premiumUsageRate,
            efficiency: summary.metrics.efficiency,
          },
          callBucketTable: summary.callBucketTable,
          loadBandTable: summary.loadBandTable,
          lineGroupTable: summary.lineGroupTable,
          failureBuckets: summary.failureBuckets,
          incidents: summary.incidents,
        },
        traceChunks: chunkTrace(result.trace),
      });
    } else {
      const result = await runFinal({
        source: evaluation.sourceSnapshot,
        gameSnapshot,
      });
      const report = buildFinalReport({
        shiftId: currentShift.id,
        github,
        publicId: reportPublicIdForEvaluation(currentShift.id, evaluation.id),
        achievedAt: Date.now(),
        kind: evaluation.kind === "auto_final" ? "auto_final" : "final",
        metrics: result.metrics,
        seed: gameSnapshot.seed,
      });

      await convex.mutation(api.submissions.completeFinal, {
        secret,
        github,
        shiftId: toShiftId(currentShift.id),
        evaluationId: toEvaluationId(evaluation.id),
        reportPublicId: report.publicId,
        title: report.title,
        metrics: result.metrics,
        chiefOperatorNote: report.chiefOperatorNote,
        achievedAt: report.achievedAt,
        traceChunks: chunkTrace(result.trace),
      });
    }

    currentShift = await convex.action(api.sessions.getOwnedShiftView, {
      secret,
      github,
      shiftId: toShiftId(shift.id),
    });
  }
}

export async function startShiftForGithub(github: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();
  const seed = crypto.randomUUID();

  return convex.action(api.sessions.start, {
    secret,
    github,
    seed,
    artifactVersion: 1,
  });
}

export async function getCurrentShiftForGithub(github: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();
  const shift = await convex.action(api.sessions.getCurrentOwned, {
    secret,
    github,
  });
  if (!shift) return null;
  await resolvePendingEvaluations(github, shift);
  return convex.action(api.sessions.getCurrentOwned, {
    secret,
    github,
  });
}

export async function getOwnedShiftForGithub(github: string, shiftId: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();
  const shift = await convex.action(api.sessions.getOwnedShiftView, {
    secret,
    github,
    shiftId: toShiftId(shiftId),
  });
  if (!shift) return null;
  await resolvePendingEvaluations(github, shift);
  return convex.action(api.sessions.getOwnedShiftView, {
    secret,
    github,
    shiftId: toShiftId(shiftId),
  });
}

export async function saveDraftForGithub(params: {
  github: string;
  shiftId: string;
  source: string;
  savedAt?: number;
}) {
  const draft = validateDraftSource(params.source);
  if (draft.ok === false) {
    throw new Error(draft.error);
  }

  const convex = getConvexServerClient();
  return convex.action(api.sessions.saveDraft, {
    secret: getConvexMutationSecret(),
    github: params.github,
    shiftId: toShiftId(params.shiftId),
    source: draft.value,
    savedAt: params.savedAt ?? Date.now(),
  });
}

export async function validateDraftForGithub(params: {
  github: string;
  shiftId: string;
  source: string;
}) {
  const validation = await validatePolicy(params.source);
  const convex = getConvexServerClient();

  if (validation.ok) {
    await convex.action(api.sessions.storeValidation, {
      secret: getConvexMutationSecret(),
      github: params.github,
      shiftId: toShiftId(params.shiftId),
      source: validation.normalizedSource,
      valid: true,
      sourceHash: validation.sourceHash,
      error: undefined,
      checkedAt: Date.now(),
    });
  } else {
    const invalidError = "error" in validation ? validation.error : "Validation failed";
    await convex.action(api.sessions.storeValidation, {
      secret: getConvexMutationSecret(),
      github: params.github,
      shiftId: toShiftId(params.shiftId),
      source: params.source.trim(),
      valid: false,
      sourceHash: undefined,
      error: invalidError,
      checkedAt: Date.now(),
    });
  }

  const shift = await getOwnedShiftForGithub(params.github, params.shiftId);
  return {
    validation,
    shift,
  };
}

export async function runProbeForGithub(github: string, shiftId: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();

  const accepted = await convex.action(api.sessions.acceptProbe, {
    secret,
    github,
    shiftId: toShiftId(shiftId),
  });

  const shift = await getOwnedShiftForGithub(github, shiftId);
  const summary = shift?.probeEvaluations
    .filter((evaluation) => evaluation.state === "completed")
    .sort((left, right) => right.acceptedAt - left.acceptedAt)[0]?.probeSummary;

  if (!shift || !summary) {
    throw new Error("probe summary unavailable");
  }

  return {
    probeKind: accepted.kind,
    summary,
    shift,
  };
}

export async function goLiveForGithub(github: string, shiftId: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();

  await convex.action(api.sessions.acceptFinal, {
    secret,
    github,
    shiftId: toShiftId(shiftId),
  });

  const shift = await getOwnedShiftForGithub(github, shiftId);
  if (!shift?.finalEvaluation) {
    throw new Error("final evaluation unavailable");
  }

  return shift;
}

export async function getLandingView(github: string | null): Promise<LandingView> {
  const convex = getConvexServerClient();
  const [leaderboardResult, currentShiftResult] = await Promise.allSettled([
    convex.query(api.leaderboard.getPublic, {}),
    github ? getCurrentShiftForGithub(github) : Promise.resolve(null),
  ]);

  return {
    leaderboard: leaderboardResult.status === "fulfilled" ? leaderboardResult.value : [],
    activeShiftId:
      currentShiftResult.status === "fulfilled"
        ? currentShiftResult.value?.id ?? null
        : null,
    github,
  };
}

export async function getReportView(publicId: string) {
  const convex = getConvexServerClient();
  return convex.query(api.leads.getReportByPublicId, { publicId });
}

export async function getArtifactForShift(github: string, shiftId: string, name: string) {
  const convex = getConvexServerClient();
  const secret = getConvexMutationSecret();
  const shift = await getOwnedShiftForGithub(github, shiftId);
  if (!shift) return null;
  const runtime = await getOwnedShiftRuntimeForGithub(github, shiftId);
  if (!runtime) {
    throw new Error("shift runtime unavailable");
  }

  if (shift.status !== "active_phase_1" && shift.status !== "active_phase_2") {
    return null;
  }
  const artifactMeta = ARTIFACT_CONTENT_TYPES[name as ArtifactName];
  if (!artifactMeta) {
    return null;
  }

  await convex.action(api.sessions.recordArtifactFetch, {
    secret,
    github,
    shiftId: toShiftId(shiftId),
    name: name as ArtifactName,
    at: Date.now(),
  });

  return {
    content: buildArtifactContent(name as ArtifactName, runtime.seed).content,
    type: artifactMeta.type,
  };
}

export async function getAdminSnapshot(params: {
  github?: string | null;
  shiftId?: string | null;
  publicId?: string | null;
  evaluationId?: string | null;
  tracePage?: number;
}) {
  const convex = getConvexServerClient();
  return convex.action(api.leads.adminLookup, {
    secret: getConvexMutationSecret(),
    github: params.github ?? undefined,
    shiftId: params.shiftId ? toShiftId(params.shiftId) : undefined,
    publicId: params.publicId ?? undefined,
    evaluationId: params.evaluationId ? toEvaluationId(params.evaluationId) : undefined,
    tracePage: params.tracePage ?? 0,
  });
}
