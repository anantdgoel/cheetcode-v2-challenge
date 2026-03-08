import type { ArtifactName, PolicyValidationResult, ProbeSummary } from "@/lib/domain/game";
import { asShiftId, fetchInternalMutation, fetchInternalQuery, internal } from "@/lib/repositories/convex-server";
import type { StoredRunKind, StoredRunRecord, StoredRunTrigger, StoredShiftRecord } from "./records";

type StartShiftArgs = {
  github: string;
  seed: string;
  artifactVersion: number;
  starterSource: string;
  starterValidation: Extract<PolicyValidationResult, { ok: true }>;
  now: number;
  phase1EndsAt: number;
  expiresAt: number;
};

export async function getLatestShiftRecord(github: string): Promise<StoredShiftRecord | null> {
  return fetchInternalQuery(internal.sessions.getCurrentOwned, {
    github,
  });
}

export async function getOwnedShiftRecord(github: string, shiftId: string): Promise<StoredShiftRecord | null> {
  return fetchInternalQuery(internal.sessions.getOwnedShift, {
    github,
    shiftId: asShiftId(shiftId),
  });
}

export async function createShiftRecord(params: StartShiftArgs) {
  return fetchInternalMutation(internal.sessions.start, params);
}

export async function saveDraftRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  savedAt: number;
}) {
  return fetchInternalMutation(internal.sessions.saveDraft, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function storeValidationRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  validation: PolicyValidationResult;
  checkedAt: number;
}) {
  return fetchInternalMutation(internal.sessions.storeValidation, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function recordArtifactFetch(params: {
  github: string;
  shiftId: string;
  name: ArtifactName;
  at: number;
}) {
  return fetchInternalMutation(internal.sessions.recordArtifactFetch, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function acceptRunRecord(params: {
  github: string;
  shiftId: string;
  run: {
    id: string;
    kind: StoredRunKind;
    trigger: StoredRunTrigger;
    acceptedAt: number;
    sourceHash: string;
    sourceSnapshot: string;
  };
}) {
  return fetchInternalMutation(internal.sessions.acceptRun, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function completeProbeRunRecord(params: {
  shiftId: string;
  runId: string;
  summary: ProbeSummary;
  resolvedAt: number;
}) {
  return fetchInternalMutation(internal.sessions.completeProbeRun, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function completeFinalRunRecord(params: {
  shiftId: string;
  runId: string;
  reportPublicId: string;
  title: StoredRunRecord["title"];
  metrics: NonNullable<StoredRunRecord["metrics"]>;
  chiefOperatorNote: string;
  resolvedAt: number;
}) {
  return fetchInternalMutation(internal.sessions.completeFinalRun, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}

export async function markExpiredNoResult(params: {
  shiftId: string;
  completedAt: number;
}) {
  return fetchInternalMutation(internal.sessions.markExpiredNoResult, {
    ...params,
    shiftId: asShiftId(params.shiftId),
  });
}
