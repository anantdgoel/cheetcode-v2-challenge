import type { ArtifactName } from "@/lib/contracts/game";
import type { GoLiveResult, RunProbeResult, ValidateDraftResult } from "@/lib/contracts/api";

export async function fetchArtifactContent(shiftId: string, artifactName: ArtifactName) {
  const response = await fetch(
    `/api/shifts/${shiftId}/artifacts/${encodeURIComponent(artifactName)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    const errorPayload = await response.json() as { error?: string };
    throw new Error(errorPayload.error ?? "Artifact unavailable");
  }
  return response.text();
}

export async function saveDraft(shiftId: string, source: string) {
  return fetch(`/api/shifts/${shiftId}/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
}

export async function validateDraft(shiftId: string, source: string) {
  const response = await fetch(`/api/shifts/${shiftId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const data = await response.json() as ValidateDraftResult | { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Validation failed");
  }
  return data as ValidateDraftResult;
}

export async function runProbe(shiftId: string) {
  const response = await fetch(`/api/shifts/${shiftId}/probe`, { method: "POST" });
  const data = await response.json() as RunProbeResult | { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Probe failed");
  }
  return data as RunProbeResult;
}

export async function goLive(shiftId: string) {
  const response = await fetch(`/api/shifts/${shiftId}/go-live`, { method: "POST" });
  const data = await response.json() as GoLiveResult | { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Go Live failed");
  }
  return data as GoLiveResult;
}
