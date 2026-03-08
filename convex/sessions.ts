import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { countPolicyRevision, getCompletedProbeKinds, getNextProbeKind, isProbeKind, PROBE_ORDER, recordFirstArtifactFetch } from "../src/lib/shift-runtime";
import { buildShiftArtifacts, bundleHashesFromArtifacts, stableHash } from "../src/lib/exchange";
import type { EvaluationRecordView, ShiftRuntimeView, ShiftView } from "../src/lib/types";
import { validateGithub } from "../src/lib/validation";

const PHASE_1_MS = 4 * 60 * 1000;
const SHIFT_MS = 10 * 60 * 1000;

const ACTIVE_STATUSES = new Set(["active_phase_1", "active_phase_2"]);

type ShiftDoc = Doc<"shifts">;
type ReadCtx = Pick<QueryCtx, "db">;
type AcceptProbeResult = {
  evaluationId: Id<"evaluations">;
  state: "accepted" | "completed";
  kind: (typeof PROBE_ORDER)[number];
};
type AcceptFinalResult = {
  evaluationId: Id<"evaluations">;
  state: "accepted" | "completed";
  kind: "final" | "auto_final";
};

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_MUTATION_SECRET;
  if (!expected) {
    throw new Error("CONVEX_MUTATION_SECRET is not configured in the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("unauthorized");
  }
}

function getPhase(shift: ShiftDoc, now: number) {
  if (shift.status === "evaluating") return "evaluating";
  if (shift.status === "completed") return "completed";
  if (shift.status === "expired_no_result") return "expired";
  return now < shift.expiresAt ? "active" : "expired";
}

async function getShiftEvaluations(ctx: ReadCtx, shiftId: Id<"shifts">) {
  return ctx.db
    .query("evaluations")
    .withIndex("by_shift_acceptedAt", (query) => query.eq("shiftId", shiftId))
    .order("asc")
    .collect();
}

async function findFinalEvaluation(ctx: ReadCtx, shiftId: Id<"shifts">) {
  const evaluations = await getShiftEvaluations(ctx, shiftId);
  return (
    evaluations.find(
      (evaluation: Doc<"evaluations">) =>
        evaluation.kind === "final" || evaluation.kind === "auto_final",
    ) ?? null
  );
}

async function syncShiftClock(ctx: MutationCtx, shiftId: Id<"shifts">, now: number) {
  const shift = await ctx.db.get(shiftId);
  if (!shift) return null;

  if (shift.status === "completed" || shift.status === "expired_no_result" || shift.status === "evaluating") {
    return shift;
  }

  if (now >= shift.expiresAt) {
    const existingFinal = await findFinalEvaluation(ctx, shiftId);
    if (shift.latestValidSource && shift.latestValidSourceHash) {
      const evaluationId =
        existingFinal?._id ??
        (await ctx.db.insert("evaluations", {
          shiftId,
          github: shift.github,
          kind: "auto_final",
          state: "accepted",
          acceptedAt: shift.expiresAt,
          sourceHash: shift.latestValidSourceHash,
          sourceSnapshot: shift.latestValidSource,
        }));

      await ctx.db.patch(shiftId, {
        status: "evaluating",
        finalAcceptedAt: shift.finalAcceptedAt || shift.expiresAt,
        finalEvaluationId: shift.finalEvaluationId || evaluationId,
      });

      return await ctx.db.get(shiftId);
    }

    await ctx.db.patch(shiftId, {
      status: "expired_no_result",
      completedAt: shift.completedAt || shift.expiresAt,
    });
    return await ctx.db.get(shiftId);
  }

  if (now >= shift.phase1EndsAt && shift.status === "active_phase_1") {
    await ctx.db.patch(shiftId, { status: "active_phase_2" });
    return await ctx.db.get(shiftId);
  }

  return shift;
}

function shapeEvaluationView(evaluation: Doc<"evaluations"> | null): EvaluationRecordView | undefined {
  if (!evaluation) return undefined;
  return {
    id: evaluation._id,
    kind: evaluation.kind,
    state: evaluation.state,
    acceptedAt: evaluation.acceptedAt,
    resolvedAt: evaluation.resolvedAt,
    sourceHash: evaluation.sourceHash,
    sourceSnapshot: evaluation.sourceSnapshot,
    probeSummary: evaluation.probeSummary ?? undefined,
    metrics: evaluation.metrics
      ? {
          connectedCalls: evaluation.metrics.connectedCalls,
          totalCalls: evaluation.metrics.totalCalls,
          droppedCalls: evaluation.metrics.droppedCalls,
          avgHoldSeconds: evaluation.metrics.avgHoldSeconds,
          totalHoldSeconds: evaluation.metrics.totalHoldSeconds,
          premiumUsageCount: evaluation.metrics.premiumUsageCount,
          premiumUsageRate: evaluation.metrics.premiumUsageRate,
          trunkMisuseCount: evaluation.metrics.trunkMisuseCount,
          efficiency: evaluation.metrics.efficiency,
          hiddenScore: evaluation.metrics.hiddenScore,
        }
      : undefined,
    title: evaluation.title,
    chiefOperatorNote: evaluation.chiefOperatorNote,
    reportPublicId: evaluation.reportPublicId,
    traceChunkCount: evaluation.traceChunkCount,
  };
}

function shapeShiftView(
  shift: ShiftDoc,
  now: number,
  evaluations: Doc<"evaluations">[],
): ShiftView {
  const probeEvaluations = evaluations
    .filter((evaluation) => isProbeKind(evaluation.kind))
    .map(shapeEvaluationView)
    .filter((evaluation): evaluation is EvaluationRecordView => evaluation !== undefined);
  const finalEvaluation =
    evaluations
      .filter((evaluation) => evaluation.kind === "final" || evaluation.kind === "auto_final")
      .map(shapeEvaluationView)
      .filter((evaluation): evaluation is EvaluationRecordView => evaluation !== undefined)
      .at(-1) ?? undefined;
  const probesUsed = new Set(
    evaluations
      .filter((e) => isProbeKind(e.kind) && (e.state === "completed" || e.state === "accepted"))
      .map((e) => e.kind),
  ).size;
  const maxProbes = PROBE_ORDER.length;

  return {
    id: shift._id,
    github: shift.github,
    status: shift.status as ShiftView["status"],
    startedAt: shift.startedAt,
    phase1EndsAt: shift.phase1EndsAt,
    expiresAt: shift.expiresAt,
    completedAt: shift.completedAt,
    artifactVersion: shift.artifactVersion,
    latestDraftSource: shift.latestDraftSource,
    latestDraftSavedAt: shift.latestDraftSavedAt,
    latestValidSource: shift.latestValidSource,
    latestValidAt: shift.latestValidAt,
    latestValidationError: shift.latestValidationError,
    latestValidationCheckedAt: shift.latestValidationCheckedAt,
    probeAcceptedAt: shift.probeAcceptedAt,
    finalAcceptedAt: shift.finalAcceptedAt,
    reportPublicId: shift.reportPublicId,
    currentPhase: getPhase(shift, now),
    probesUsed,
    maxProbes,
    remainingProbes: Math.max(0, maxProbes - probesUsed),
    nextProbeKind: getNextProbeKind(evaluations),
    canGoLive:
      ACTIVE_STATUSES.has(shift.status) &&
      now < shift.expiresAt &&
      !!shift.latestValidSource &&
      !evaluations.some((e) => e.state === "accepted"),
    probeEvaluations,
    finalEvaluation,
  };
}

export { PROBE_ORDER, getCompletedProbeKinds, getNextProbeKind };

export const getLatestShiftForGithubInternal = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("shifts")
      .withIndex("by_github_startedAt", (query) => query.eq("github", args.github))
      .order("desc")
      .first();
  },
});

export const getOwnedShiftViewInternal = internalQuery({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.github !== args.github) return null;
    const evaluations = await getShiftEvaluations(ctx, args.shiftId);
    return shapeShiftView(shift, args.now ?? Date.now(), evaluations);
  },
});

export const getOwnedShiftRuntimeInternal = internalQuery({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args): Promise<ShiftRuntimeView | null> => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.github !== args.github) return null;
    return {
      id: shift._id,
      github: shift.github,
      seed: shift.seed,
    };
  },
});

export const startShiftInternal = internalMutation({
  args: {
    github: v.string(),
    seed: v.string(),
    artifactVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const githubResult = validateGithub(args.github);
    if (githubResult.ok === false) throw new Error(githubResult.error);

    const latest = await ctx.db
      .query("shifts")
      .withIndex("by_github_startedAt", (query) => query.eq("github", githubResult.value))
      .order("desc")
      .first();

    if (latest) {
      const synced = await syncShiftClock(ctx, latest._id, Date.now());
      if (synced && ACTIVE_STATUSES.has(synced.status)) {
        throw new Error(`active shift:${synced._id}`);
      }
    }

    const now = Date.now();
    const artifacts = buildShiftArtifacts(args.seed);
    const starterHash = stableHash(artifacts.starterJs);
    const shiftId = await ctx.db.insert("shifts", {
      github: githubResult.value,
      seed: args.seed,
      status: "active_phase_1",
      artifactVersion: args.artifactVersion,
      startedAt: now,
      phase1EndsAt: now + PHASE_1_MS,
      expiresAt: now + SHIFT_MS,
      latestDraftSource: artifacts.starterJs,
      latestDraftSavedAt: now,
      latestValidSource: artifacts.starterJs,
      latestValidSourceHash: starterHash,
      latestValidAt: now,
      latestValidationCheckedAt: now,
      bundleHashes: bundleHashesFromArtifacts(artifacts),
      probesUsed: 0,
      probeResults: [],
      artifactFetches: [],
      validationAttempts: 0,
      policyRevisions: 0,
      validatedSourceHashes: [starterHash],
      probeAcceptedAt: undefined,
    });

    await ctx.scheduler.runAfter(SHIFT_MS + 1_000, internal.sessions.expireShiftInternal, {
      shiftId,
    });

    return shiftId;
  },
});

export const expireShiftInternal = internalMutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    return syncShiftClock(ctx, args.shiftId, Date.now());
  },
});

export const saveDraftInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    savedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await syncShiftClock(ctx, args.shiftId, Date.now());
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    if (!ACTIVE_STATUSES.has(shift.status)) {
      throw new Error("shift is no longer editable");
    }
    await ctx.db.patch(args.shiftId, {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.savedAt,
    });
    return await ctx.db.get(args.shiftId);
  },
});

export const storeValidationInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    valid: v.boolean(),
    sourceHash: v.optional(v.string()),
    error: v.optional(v.string()),
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await syncShiftClock(ctx, args.shiftId, Date.now());
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    if (!ACTIVE_STATUSES.has(shift.status)) {
      throw new Error("shift is no longer editable");
    }

    const telemetry = countPolicyRevision({
      validatedSourceHashes: shift.validatedSourceHashes,
      sourceHash: args.sourceHash,
      valid: args.valid,
    });

    const patch: Record<string, unknown> = {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.checkedAt,
      latestValidationCheckedAt: args.checkedAt,
      validationAttempts: shift.validationAttempts + 1,
      validatedSourceHashes: telemetry.validatedSourceHashes,
      policyRevisions: shift.policyRevisions + telemetry.policyRevisionDelta,
    };

    if (args.valid) {
      patch.latestValidationError = undefined;
      patch.latestValidSource = args.source;
      patch.latestValidSourceHash = args.sourceHash;
      patch.latestValidAt = args.checkedAt;
    } else {
      patch.latestValidationError = args.error ?? "Validation failed";
    }

    await ctx.db.patch(args.shiftId, patch);
    return await ctx.db.get(args.shiftId);
  },
});

export const recordArtifactFetchInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    name: v.union(
      v.literal("manual.md"),
      v.literal("starter.js"),
      v.literal("lines.json"),
      v.literal("observations.jsonl"),
    ),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    await ctx.db.patch(args.shiftId, {
      artifactFetches: recordFirstArtifactFetch(shift.artifactFetches, args.name, args.at),
    });
    return await ctx.db.get(args.shiftId);
  },
});

export const acceptProbeInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const shift = await syncShiftClock(ctx, args.shiftId, Date.now());
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    if (!ACTIVE_STATUSES.has(shift.status) || Date.now() >= shift.expiresAt) {
      throw new Error("shift expired");
    }
    if (!shift.latestValidSource || !shift.latestValidSourceHash) {
      throw new Error("valid module required");
    }

    const evaluations = await getShiftEvaluations(ctx, args.shiftId);
    const activeEvaluation = evaluations.find(
      (evaluation: Doc<"evaluations">) => evaluation.state === "accepted",
    );
    if (activeEvaluation) {
      throw new Error("evaluation already in progress");
    }

    const nextProbeKind = getNextProbeKind(evaluations);
    if (!nextProbeKind) {
      throw new Error("all probes exhausted");
    }

    const acceptedAt = Date.now();
    const evaluationId = await ctx.db.insert("evaluations", {
      shiftId: args.shiftId,
      github: args.github,
      kind: nextProbeKind,
      state: "accepted",
      acceptedAt,
      sourceHash: shift.latestValidSourceHash,
      sourceSnapshot: shift.latestValidSource,
    });

    await ctx.db.patch(args.shiftId, {
      probeAcceptedAt: acceptedAt,
    });

    return { evaluationId, state: "accepted" as const, kind: nextProbeKind };
  },
});

export const acceptFinalInternal = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args): Promise<AcceptFinalResult> => {
    const shift = await syncShiftClock(ctx, args.shiftId, Date.now());
    if (!shift || shift.github !== args.github) throw new Error("shift not found");

    const existing = await findFinalEvaluation(ctx, args.shiftId);
    if (existing) {
      return {
        evaluationId: existing._id,
        state: existing.state as AcceptFinalResult["state"],
        kind: existing.kind as AcceptFinalResult["kind"],
      };
    }

    if (!ACTIVE_STATUSES.has(shift.status) || Date.now() >= shift.expiresAt) {
      throw new Error("shift expired");
    }
    if (!shift.latestValidSource || !shift.latestValidSourceHash) {
      throw new Error("valid module required");
    }

    const evaluations = await getShiftEvaluations(ctx, args.shiftId);
    if (evaluations.some((evaluation: Doc<"evaluations">) => evaluation.state === "accepted")) {
      throw new Error("evaluation already in progress");
    }

    const acceptedAt = Date.now();
    const evaluationId = await ctx.db.insert("evaluations", {
      shiftId: args.shiftId,
      github: args.github,
      kind: "final",
      state: "accepted",
      acceptedAt,
      sourceHash: shift.latestValidSourceHash,
      sourceSnapshot: shift.latestValidSource,
    });

    await ctx.db.patch(args.shiftId, {
      status: "evaluating",
      finalAcceptedAt: acceptedAt,
      finalEvaluationId: evaluationId,
    });

    return { evaluationId, state: "accepted", kind: "final" };
  },
});

export const start = action({
  args: {
    secret: v.string(),
    github: v.string(),
    seed: v.string(),
    artifactVersion: v.number(),
  },
  handler: async (ctx, args): Promise<ShiftView | null> => {
    assertSecret(args.secret);
    const shiftId = await ctx.runMutation(internal.sessions.startShiftInternal, {
      github: args.github,
      seed: args.seed,
      artifactVersion: args.artifactVersion,
    });
    return ctx.runQuery(internal.sessions.getOwnedShiftViewInternal, {
      github: args.github,
      shiftId,
      now: Date.now(),
    });
  },
});

export const getCurrentOwned = action({
  args: { secret: v.string(), github: v.string() },
  handler: async (ctx, args): Promise<ShiftView | null> => {
    assertSecret(args.secret);
    const latest: ShiftDoc | null = await ctx.runQuery(internal.sessions.getLatestShiftForGithubInternal, {
      github: args.github,
    });
    if (!latest) return null;

    await ctx.runMutation(internal.sessions.expireShiftInternal, { shiftId: latest._id });
    const view: ShiftView | null = await ctx.runQuery(internal.sessions.getOwnedShiftViewInternal, {
      github: args.github,
      shiftId: latest._id,
      now: Date.now(),
    });
    if (!view) return null;
    return ACTIVE_STATUSES.has(view.status) || view.status === "evaluating" ? view : null;
  },
});

export const getOwnedShiftView = action({
  args: { secret: v.string(), github: v.string(), shiftId: v.id("shifts") },
  handler: async (ctx, args): Promise<ShiftView | null> => {
    assertSecret(args.secret);
    await ctx.runMutation(internal.sessions.expireShiftInternal, { shiftId: args.shiftId });
    return ctx.runQuery(internal.sessions.getOwnedShiftViewInternal, {
      github: args.github,
      shiftId: args.shiftId,
      now: Date.now(),
    });
  },
});

export const getOwnedShiftRuntime = action({
  args: { secret: v.string(), github: v.string(), shiftId: v.id("shifts") },
  handler: async (ctx, args): Promise<ShiftRuntimeView | null> => {
    assertSecret(args.secret);
    await ctx.runMutation(internal.sessions.expireShiftInternal, { shiftId: args.shiftId });
    return ctx.runQuery(internal.sessions.getOwnedShiftRuntimeInternal, {
      github: args.github,
      shiftId: args.shiftId,
    });
  },
});

export const saveDraft = action({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    savedAt: v.number(),
  },
  handler: async (ctx, args): Promise<ShiftDoc | null> => {
    assertSecret(args.secret);
    return ctx.runMutation(internal.sessions.saveDraftInternal, {
      github: args.github,
      shiftId: args.shiftId,
      source: args.source,
      savedAt: args.savedAt,
    });
  },
});

export const storeValidation = action({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    valid: v.boolean(),
    sourceHash: v.optional(v.string()),
    error: v.optional(v.string()),
    checkedAt: v.number(),
  },
  handler: async (ctx, args): Promise<ShiftDoc | null> => {
    assertSecret(args.secret);
    return ctx.runMutation(internal.sessions.storeValidationInternal, {
      github: args.github,
      shiftId: args.shiftId,
      source: args.source,
      valid: args.valid,
      sourceHash: args.sourceHash,
      error: args.error,
      checkedAt: args.checkedAt,
    });
  },
});

export const recordArtifactFetch = action({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
    name: v.union(
      v.literal("manual.md"),
      v.literal("starter.js"),
      v.literal("lines.json"),
      v.literal("observations.jsonl"),
    ),
    at: v.number(),
  },
  handler: async (ctx, args): Promise<ShiftDoc | null> => {
    assertSecret(args.secret);
    return ctx.runMutation(internal.sessions.recordArtifactFetchInternal, {
      github: args.github,
      shiftId: args.shiftId,
      name: args.name,
      at: args.at,
    });
  },
});

export const acceptProbe = action({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args): Promise<AcceptProbeResult> => {
    assertSecret(args.secret);
    return ctx.runMutation(internal.sessions.acceptProbeInternal, {
      github: args.github,
      shiftId: args.shiftId,
    });
  },
});

export const acceptFinal = action({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args): Promise<AcceptFinalResult> => {
    assertSecret(args.secret);
    const result = await ctx.runMutation(internal.sessions.acceptFinalInternal, {
      github: args.github,
      shiftId: args.shiftId,
    });
    return result as AcceptFinalResult;
  },
});

export const expireIfNeeded = action({
  args: { secret: v.string(), shiftId: v.id("shifts") },
  handler: async (ctx, args): Promise<ShiftDoc | null> => {
    assertSecret(args.secret);
    return ctx.runMutation(internal.sessions.expireShiftInternal, {
      shiftId: args.shiftId,
    });
  },
});
