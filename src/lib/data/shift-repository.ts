import type { ArtifactName, PolicyValidationResult, ProbeSummary } from "@/lib/contracts/game";
import { api } from "@/lib/convex-server";
import type { StoredRunKind, StoredRunRecord, StoredRunTrigger, StoredShiftRecord } from "./types";
import { getDataClient } from "./client";

export async function getLatestShiftRecord(github: string): Promise<StoredShiftRecord | null> {
  const { convex, secret } = getDataClient();
  return convex.query(api.sessions.getCurrentOwned, { secret, github });
}

export async function getOwnedShiftRecord(github: string, shiftId: string): Promise<StoredShiftRecord | null> {
  const { convex, secret } = getDataClient();
  return convex.query(api.sessions.getOwnedShift, { secret, github, shiftId });
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
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.start, { secret, ...params });
}

export async function saveDraftRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  savedAt: number;
}) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.saveDraft, { secret, ...params });
}

export async function storeValidationRecord(params: {
  github: string;
  shiftId: string;
  source: string;
  validation: PolicyValidationResult;
  checkedAt: number;
}) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.storeValidation, { secret, ...params });
}

export async function recordArtifactFetch(params: {
  github: string;
  shiftId: string;
  name: ArtifactName;
  at: number;
}) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.recordArtifactFetch, { secret, ...params });
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
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.acceptRun, { secret, ...params });
}

export async function completeProbeRunRecord(params: {
  github: string;
  shiftId: string;
  runId: string;
  summary: ProbeSummary;
  resolvedAt: number;
}) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.completeProbeRun, { secret, ...params });
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
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.completeFinalRun, { secret, ...params });
}

export async function markExpiredNoResult(params: {
  github: string;
  shiftId: string;
  completedAt: number;
}) {
  const { convex, secret } = getDataClient();
  return convex.mutation(api.sessions.markExpiredNoResult, { secret, ...params });
}
