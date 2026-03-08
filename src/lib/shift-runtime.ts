import type { ArtifactName, EvaluationKind, ProbeKind } from "./types";

export const PROBE_ORDER: ProbeKind[] = ["fit", "stress"];

export function isProbeKind(kind: EvaluationKind): kind is ProbeKind {
  return PROBE_ORDER.includes(kind as ProbeKind);
}

export function getCompletedProbeKinds(
  evaluations: Array<{ kind: EvaluationKind; state: "accepted" | "completed" }>,
): ProbeKind[] {
  return PROBE_ORDER.filter((probeKind) =>
    evaluations.some((evaluation) => evaluation.kind === probeKind && evaluation.state === "completed"),
  );
}

export function getNextProbeKind(
  evaluations: Array<{ kind: EvaluationKind; state: "accepted" | "completed" }>,
): ProbeKind | undefined {
  const completed = new Set(getCompletedProbeKinds(evaluations));
  return PROBE_ORDER.find((probeKind) => !completed.has(probeKind));
}

export function countPolicyRevision(params: {
  validatedSourceHashes: string[];
  sourceHash?: string;
  valid: boolean;
}) {
  if (!params.valid || !params.sourceHash) {
    return {
      validatedSourceHashes: params.validatedSourceHashes,
      policyRevisionDelta: 0,
    };
  }

  if (params.validatedSourceHashes.includes(params.sourceHash)) {
    return {
      validatedSourceHashes: params.validatedSourceHashes,
      policyRevisionDelta: 0,
    };
  }

  return {
    validatedSourceHashes: [...params.validatedSourceHashes, params.sourceHash],
    policyRevisionDelta: 1,
  };
}

export function recordFirstArtifactFetch(
  artifactFetches: Array<{ name: ArtifactName; at: number }>,
  name: ArtifactName,
  at: number,
) {
  if (artifactFetches.some((fetch) => fetch.name === name)) {
    return artifactFetches;
  }
  return [...artifactFetches, { name, at }];
}
