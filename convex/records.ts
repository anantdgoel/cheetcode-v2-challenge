import type { Doc, Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export type ShiftDoc = Doc<"shifts">;
export type ShiftRunDoc = ShiftDoc["runs"][number];
type ShiftId = Id<"shifts">;

export function toShiftRecord(doc: ShiftDoc | null) {
  if (!doc) return null;
  return {
    id: doc._id,
    github: doc.github,
    seed: doc.seed,
    artifactVersion: doc.artifactVersion,
    state: doc.state,
    startedAt: doc.startedAt,
    phase1EndsAt: doc.phase1EndsAt,
    expiresAt: doc.expiresAt,
    completedAt: doc.completedAt,
    latestDraftSource: doc.latestDraftSource,
    latestDraftSavedAt: doc.latestDraftSavedAt,
    latestValidSource: doc.latestValidSource,
    latestValidSourceHash: doc.latestValidSourceHash,
    latestValidAt: doc.latestValidAt,
    latestValidationError: doc.latestValidationError,
    latestValidationCheckedAt: doc.latestValidationCheckedAt,
    artifactFetchAt: doc.artifactFetchAt,
    runs: doc.runs,
    reportPublicId: doc.reportPublicId,
  };
}

export async function loadShift(db: DatabaseReader, shiftId: string) {
  return db.get(shiftId as ShiftId);
}

export async function loadOwnedShift(db: DatabaseReader, github: string, shiftId: string) {
  const doc = await loadShift(db, shiftId);
  if (!doc || doc.github !== github) return null;
  return doc;
}
