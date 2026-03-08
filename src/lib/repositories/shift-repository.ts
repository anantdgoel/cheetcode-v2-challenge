import type { ArtifactName, PolicyValidationResult, ProbeSummary } from "@/lib/domain/game";
import { api, getConvexMutationSecret, getConvexServerClient } from "@/lib/repositories/convex";
import type { StoredRunKind, StoredRunRecord, StoredRunTrigger, StoredShiftRecord } from "./records";

export async function getLatestShiftRecord(github: string): Promise<StoredShiftRecord | null> {
  return getConvexServerClient().query(api.sessions.getCurrentOwned, {
    github,
    secret: getConvexMutationSecret(),
  });
}

export async function getOwnedShiftRecord(github: string, shiftId: string): Promise<StoredShiftRecord | null> {
  return getConvexServerClient().query(api.sessions.getOwnedShift, {
    github,
    secret: getConvexMutationSecret(),
    shiftId,
  });
}

export async function createShiftRecord(params: {
  github: string;
  seed: string;
  artifactVersion: number;
  starterSource: string;
  starterValidation: Extract<PolicyValidationResult, { ok: true }>;
  now: number;
  phase1EndsAt: number;
  expiresAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.start, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function saveDraftRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  savedAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.saveDraft, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function storeValidationRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  validation: PolicyValidationResult;
  checkedAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.storeValidation, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function recordArtifactFetch(params: {
  github: string;
  shiftId: string;
  name: ArtifactName;
  at: number;
}) {
  return getConvexServerClient().mutation(api.sessions.recordArtifactFetch, {
    ...params,
    secret: getConvexMutationSecret(),
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
  return getConvexServerClient().mutation(api.sessions.acceptRun, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function completeProbeRunRecord(params: {
  github: string;
  shiftId: string;
  runId: string;
  summary: ProbeSummary;
  resolvedAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.completeProbeRun, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function completeFinalRunRecord(params: {
  github: string;
  shiftId: string;
  runId: string;
  reportPublicId: string;
  title: StoredRunRecord["title"];
  metrics: NonNullable<StoredRunRecord["metrics"]>;
  chiefOperatorNote: string;
  resolvedAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.completeFinalRun, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}

export async function markExpiredNoResult(params: {
  github: string;
  shiftId: string;
  completedAt: number;
}) {
  return getConvexServerClient().mutation(api.sessions.markExpiredNoResult, {
    ...params,
    secret: getConvexMutationSecret(),
  });
}
