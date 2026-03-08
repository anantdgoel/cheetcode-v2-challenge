import type { ArtifactName } from "@/lib/domain/game";
import type {
  GoLiveResult,
  RunProbeResult,
  ValidateDraftResult,
} from "@/lib/domain/commands";
import type { ShiftView } from "@/lib/domain/views";
import { readJsonOrThrow } from "@/lib/frontend/http";

export async function fetchArtifactContent(shiftId: string, artifactName: ArtifactName) {
  const response = await fetch(
    `/api/shifts/${shiftId}/artifacts/${encodeURIComponent(artifactName)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const data = await response.json() as { error?: string };
    throw new Error(data.error ?? "Artifact unavailable");
  }
  return response.text();
}

export async function fetchShift(shiftId: string) {
  const response = await fetch(`/api/shifts/${shiftId}`, { cache: "no-store" });
  return readJsonOrThrow<{ error?: string; shift: ShiftView }>(response, "Shift refresh failed");
}

export async function saveDraft(shiftId: string, source: string) {
  return fetch(`/api/shifts/${shiftId}/drafts`, {
    body: JSON.stringify({ source }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function validateDraft(shiftId: string, source: string) {
  const response = await fetch(`/api/shifts/${shiftId}/validate`, {
    body: JSON.stringify({ source }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return readJsonOrThrow<ValidateDraftResult & { error?: string }>(response, "Validation failed");
}

export async function runProbe(shiftId: string) {
  const response = await fetch(`/api/shifts/${shiftId}/probe`, { method: "POST" });
  return readJsonOrThrow<RunProbeResult & { error?: string }>(response, "Probe failed");
}

export async function goLive(shiftId: string) {
  const response = await fetch(`/api/shifts/${shiftId}/go-live`, { method: "POST" });
  return readJsonOrThrow<GoLiveResult & { error?: string }>(response, "Go Live failed");
}
