import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { loadOwnedShift, loadShiftById, toShiftRecord, type ShiftDoc, type ShiftRunDoc } from "./records";
import {
  policyValidationResultValidator,
  probeSummaryValidator,
  simulationMetricsValidator,
  storedRunKindValidator,
  storedRunTriggerValidator,
  titleValidator,
} from "./validators";

function artifactFieldName(name: "manual.md" | "starter.js" | "lines.json" | "observations.jsonl") {
  switch (name) {
    case "manual.md":
      return "manualMd";
    case "starter.js":
      return "starterJs";
    case "lines.json":
      return "linesJson";
    case "observations.jsonl":
      return "observationsJsonl";
  }
}

function getAcceptedRun(shift: Pick<ShiftDoc, "runs">) {
  return shift.runs.find((run) => run.state === "accepted");
}

function getRunById(shift: Pick<ShiftDoc, "runs">, runId: string) {
  return shift.runs.find((run) => run.id === runId);
}

function hasFinalRun(shift: Pick<ShiftDoc, "runs">) {
  return shift.runs.some((run) => run.kind === "final");
}

function ensureOwnedShift(shift: ShiftDoc | null, github: string) {
  if (!shift || shift.github !== github) {
    throw new Error("shift not found");
  }
  return shift;
}

function ensureEditableShift(shift: ShiftDoc) {
  if (shift.state !== "active" || Date.now() >= shift.expiresAt || getAcceptedRun(shift)) {
    throw new Error("shift is no longer editable");
  }
}

export const getCurrentOwned = internalQuery({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("shifts")
      .withIndex("by_github_and_startedAt", (query) => query.eq("github", args.github))
      .order("desc")
      .first();
    return toShiftRecord(doc);
  },
});

export const getOwnedShift = internalQuery({
  args: { github: v.string(), shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    return toShiftRecord(await loadOwnedShift(ctx.db, args.github, args.shiftId));
  },
});

export const start = internalMutation({
  args: {
    github: v.string(),
    seed: v.string(),
    artifactVersion: v.number(),
    starterSource: v.string(),
    starterValidation: v.object({
      ok: v.literal(true),
      normalizedSource: v.string(),
      sourceHash: v.string(),
    }),
    now: v.number(),
    phase1EndsAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shiftId = await ctx.db.insert("shifts", {
      github: args.github,
      seed: args.seed,
      artifactVersion: args.artifactVersion,
      state: "active",
      startedAt: args.now,
      phase1EndsAt: args.phase1EndsAt,
      expiresAt: args.expiresAt,
      latestDraftSource: args.starterSource,
      latestDraftSavedAt: args.now,
      latestValidSource: args.starterValidation.normalizedSource,
      latestValidSourceHash: args.starterValidation.sourceHash,
      latestValidAt: args.now,
      latestValidationCheckedAt: args.now,
      artifactFetchAt: {},
      runs: [],
      reportPublicId: undefined,
    });

    return toShiftRecord(await loadShiftById(ctx.db, shiftId));
  },
});

export const saveDraft = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    savedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github);
    ensureEditableShift(shift);
    await ctx.db.patch(shift._id, {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.savedAt,
    });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const storeValidation = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    source: v.string(),
    validation: policyValidationResultValidator,
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github);
    ensureEditableShift(shift);
    const patch: Record<string, unknown> = {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.checkedAt,
      latestValidationCheckedAt: args.checkedAt,
    };
    if (args.validation.ok) {
      patch.latestValidSource = args.validation.normalizedSource;
      patch.latestValidSourceHash = args.validation.sourceHash;
      patch.latestValidAt = args.checkedAt;
      patch.latestValidationError = undefined;
    } else if ("error" in args.validation) {
      patch.latestValidationError = args.validation.error;
    }
    await ctx.db.patch(shift._id, patch);
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const recordArtifactFetch = internalMutation({
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
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github);
    if (shift.state !== "active") {
      throw new Error("shift not found");
    }
    await ctx.db.patch(shift._id, {
      artifactFetchAt: {
        ...shift.artifactFetchAt,
        [artifactFieldName(args.name)]: shift.artifactFetchAt?.[artifactFieldName(args.name)] ?? args.at,
      },
    });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const acceptRun = internalMutation({
  args: {
    github: v.string(),
    shiftId: v.id("shifts"),
    run: v.object({
      id: v.string(),
      kind: storedRunKindValidator,
      trigger: storedRunTriggerValidator,
      acceptedAt: v.number(),
      sourceHash: v.string(),
      sourceSnapshot: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const shift = ensureOwnedShift(await loadOwnedShift(ctx.db, args.github, args.shiftId), args.github);
    if (shift.state !== "active") {
      throw new Error("shift expired");
    }
    if (args.run.trigger === "manual" && Date.now() >= shift.expiresAt) {
      throw new Error("shift expired");
    }
    if (getAcceptedRun(shift)) {
      throw new Error("evaluation already in progress");
    }
    if (args.run.kind === "final" && hasFinalRun(shift)) {
      throw new Error("final evaluation unavailable");
    }
    if (args.run.kind !== "final" && shift.runs.some((run) => run.kind === args.run.kind)) {
      throw new Error("probe already submitted");
    }
    const nextRuns = [
      ...shift.runs.filter((existingRun) => existingRun.id !== args.run.id),
      {
        ...args.run,
        state: "accepted" as const,
      },
    ];
    await ctx.db.patch(shift._id, { runs: nextRuns });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const completeProbeRun = internalMutation({
  args: {
    shiftId: v.id("shifts"),
    runId: v.string(),
    summary: probeSummaryValidator,
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId);
    if (!shift) {
      throw new Error("shift not found");
    }
    const run = getRunById(shift, args.runId);
    if (!run || run.state !== "accepted" || run.kind === "final") {
      throw new Error("accepted probe run not found");
    }

    const runs = shift.runs.map((candidate: ShiftRunDoc) =>
      candidate.id === args.runId
        ? { ...candidate, state: "completed" as const, resolvedAt: args.resolvedAt, probeSummary: args.summary }
        : candidate,
    );
    await ctx.db.patch(shift._id, { runs });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const completeFinalRun = internalMutation({
  args: {
    shiftId: v.id("shifts"),
    runId: v.string(),
    reportPublicId: v.string(),
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId);
    if (!shift) {
      throw new Error("shift not found");
    }
    const run = getRunById(shift, args.runId);
    if (!run || run.state !== "accepted" || run.kind !== "final") {
      throw new Error("accepted final run not found");
    }

    const runs = shift.runs.map((candidate: ShiftRunDoc) =>
      candidate.id === args.runId
        ? {
            ...candidate,
            state: "completed" as const,
            resolvedAt: args.resolvedAt,
            reportPublicId: args.reportPublicId,
            title: args.title,
            metrics: args.metrics,
            chiefOperatorNote: args.chiefOperatorNote,
          }
        : candidate,
    );
    await ctx.db.patch(shift._id, {
      runs,
      state: "completed",
      completedAt: args.resolvedAt,
      reportPublicId: args.reportPublicId,
    });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});

export const markExpiredNoResult = internalMutation({
  args: {
    shiftId: v.id("shifts"),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const shift = await loadShiftById(ctx.db, args.shiftId);
    if (!shift) {
      throw new Error("shift not found");
    }
    if (shift.state !== "active" || hasFinalRun(shift) || getAcceptedRun(shift)) {
      return toShiftRecord(shift);
    }
    await ctx.db.patch(shift._id, {
      state: "expired",
      completedAt: args.completedAt,
    });
    return toShiftRecord(await loadShiftById(ctx.db, shift._id));
  },
});
