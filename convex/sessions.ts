import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertSecret } from "./auth";
import { loadOwnedShift, loadShift, toShiftRecord, type ShiftRunDoc } from "./shift_records";
import { policyValidationResultValidator, probeSummaryValidator, simulationMetricsValidator, storedRunKindValidator, storedRunTriggerValidator, titleValidator } from "./validators";

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

export const getCurrentOwned = query({
  args: { secret: v.string(), github: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db
      .query("shifts")
      .withIndex("by_github_startedAt", (query) => query.eq("github", args.github))
      .order("desc")
      .first();
    return toShiftRecord(doc);
  },
});

export const getOwnedShift = query({
  args: { secret: v.string(), github: v.string(), shiftId: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return toShiftRecord(await loadOwnedShift(ctx.db, args.github, args.shiftId));
  },
});

export const start = mutation({
  args: {
    secret: v.string(),
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
    assertSecret(args.secret);
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
    return toShiftRecord(await loadShift(ctx.db, shiftId));
  },
});

export const saveDraft = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    source: v.string(),
    savedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    await ctx.db.patch(shift._id, {
      latestDraftSource: args.source,
      latestDraftSavedAt: args.savedAt,
    });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const storeValidation = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    source: v.string(),
    validation: policyValidationResultValidator,
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
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
    } else if (args.validation.ok === false) {
      patch.latestValidationError = args.validation.error;
    }
    await ctx.db.patch(shift._id, patch);
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const recordArtifactFetch = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    name: v.union(
      v.literal("manual.md"),
      v.literal("starter.js"),
      v.literal("lines.json"),
      v.literal("observations.jsonl"),
    ),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    await ctx.db.patch(shift._id, {
      artifactFetchAt: {
        ...shift.artifactFetchAt,
        [artifactFieldName(args.name)]: shift.artifactFetchAt?.[artifactFieldName(args.name)] ?? args.at,
      },
    });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const acceptRun = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
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
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    const nextRuns = [
      ...shift.runs.filter((run: ShiftRunDoc) => run.id !== args.run.id),
      {
        ...args.run,
        state: "accepted",
      },
    ];
    await ctx.db.patch(shift._id, { runs: nextRuns });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const completeProbeRun = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    runId: v.string(),
    summary: probeSummaryValidator,
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    const runs = shift.runs.map((run: ShiftRunDoc) =>
      run.id === args.runId
        ? { ...run, state: "completed", resolvedAt: args.resolvedAt, probeSummary: args.summary }
        : run,
    );
    await ctx.db.patch(shift._id, { runs });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const completeFinalRun = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    runId: v.string(),
    reportPublicId: v.string(),
    title: titleValidator,
    metrics: simulationMetricsValidator,
    chiefOperatorNote: v.string(),
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    const runs = shift.runs.map((run: ShiftRunDoc) =>
      run.id === args.runId
        ? {
            ...run,
            state: "completed",
            resolvedAt: args.resolvedAt,
            reportPublicId: args.reportPublicId,
            title: args.title,
            metrics: args.metrics,
            chiefOperatorNote: args.chiefOperatorNote,
          }
        : run,
    );
    await ctx.db.patch(shift._id, {
      runs,
      state: "completed",
      completedAt: args.resolvedAt,
      reportPublicId: args.reportPublicId,
    });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});

export const markExpiredNoResult = mutation({
  args: {
    secret: v.string(),
    github: v.string(),
    shiftId: v.string(),
    completedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const shift = await loadOwnedShift(ctx.db, args.github, args.shiftId);
    if (!shift || shift.github !== args.github) throw new Error("shift not found");
    await ctx.db.patch(shift._id, {
      state: "expired",
      completedAt: args.completedAt,
    });
    return toShiftRecord(await loadShift(ctx.db, shift._id));
  },
});
