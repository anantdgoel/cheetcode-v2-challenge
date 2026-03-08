import type { ProbeKind, ProbeSummary, SimulationMetrics, Title } from '../domain/game'
import type { LeaderboardEntry, ReportView } from '../domain/views'

export type StoredShiftState = 'active' | 'completed' | 'expired';
export type StoredRunKind = ProbeKind | 'final';
export type StoredRunTrigger = 'manual' | 'auto_expire';
export type StoredRunState = 'accepted' | 'completed';

export type StoredRunRecord = {
  id: string;
  kind: StoredRunKind;
  trigger: StoredRunTrigger;
  state: StoredRunState;
  acceptedAt: number;
  resolvedAt?: number;
  sourceHash: string;
  sourceSnapshot: string;
  probeSummary?: ProbeSummary;
  metrics?: SimulationMetrics;
  title?: Title;
  chiefOperatorNote?: string;
  reportPublicId?: string;
};

export type StoredShiftRecord = {
  id: string;
  github: string;
  seed: string;
  artifactVersion: number;
  state: StoredShiftState;
  startedAt: number;
  phase1EndsAt: number;
  expiresAt: number;
  completedAt?: number;
  latestDraftSource: string;
  latestDraftSavedAt: number;
  latestValidSource?: string;
  latestValidSourceHash?: string;
  latestValidAt?: number;
  latestValidationError?: string;
  latestValidationCheckedAt?: number;
  artifactFetchAt: {
    manualMd?: number;
    starterJs?: number;
    linesJson?: number;
    observationsJsonl?: number;
  };
  runs: StoredRunRecord[];
  reportPublicId?: string;
};

export type StoredReportRecord = ReportView;
export type StoredLeaderboardRecord = LeaderboardEntry;
