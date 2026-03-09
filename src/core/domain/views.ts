import type { FinalReport, ProbeKind, ProbeSummary, SimulationMetrics, Title } from './game'

export type ShiftStatus = 'active_phase_1' | 'active_phase_2' | 'evaluating' | 'completed' | 'expired_no_result'
export type EvaluationKind = ProbeKind | 'final' | 'auto_final'
export type EvaluationState = 'accepted' | 'completed'

export type EvaluationRecordView = {
  id: string;
  kind: EvaluationKind;
  state: EvaluationState;
  acceptedAt: number;
  resolvedAt?: number;
  sourceHash: string;
  sourceSnapshot: string;
  probeSummary?: ProbeSummary;
  metrics?: SimulationMetrics;
  title?: Title;
  chiefOperatorNote?: string;
  reportPublicId?: string;
}

export type ShiftView = {
  id: string;
  github: string;
  status: ShiftStatus;
  startedAt: number;
  phase1EndsAt: number;
  expiresAt: number;
  completedAt?: number;
  artifactVersion: number;
  latestDraftSource: string;
  latestDraftSavedAt: number;
  latestValidSource?: string;
  latestValidAt?: number;
  latestValidationError?: string;
  latestValidationCheckedAt?: number;
  probeAcceptedAt?: number;
  finalAcceptedAt?: number;
  reportPublicId?: string;
  currentPhase: 'active' | 'evaluating' | 'completed' | 'expired';
  probesUsed: number;
  maxProbes: number;
  remainingProbes: number;
  nextProbeKind?: ProbeKind;
  canGoLive: boolean;
  probeEvaluations: EvaluationRecordView[];
  finalEvaluation?: EvaluationRecordView;
}

export type ReportView = FinalReport

export type LeaderboardEntry = {
  github: string;
  title: Title;
  boardEfficiency: number;
  hiddenScore: number;
  achievedAt: number;
  shiftId: string;
  publicId: string;
  connectedCalls?: number;
  totalCalls?: number;
  droppedCalls?: number;
  avgHoldSeconds?: number;
}

export type PaginatedLeaderboard = {
  topEntries: LeaderboardEntry[];
  dispatchEntries: LeaderboardEntry[];
  totalEntries: number;
  dispatchPage: number;
  totalDispatchPages: number;
}

export type LandingView = {
  leaderboard: LeaderboardEntry[];
  activeShiftId?: string | null;
  github?: string | null;
}

export type AdminRunView = {
  id: string;
  kind: EvaluationKind;
  state: EvaluationState;
  acceptedAt: number;
  resolvedAt?: number;
}

export type AdminSnapshot = {
  leaderboardRow: LeaderboardEntry | null;
  report: ReportView | null;
  shift: {
    id: string;
    github: string;
    state: string;
    expiresAt: number;
  } | null;
  runs: AdminRunView[];
  contact?: { name: string; email: string; submittedAt: number } | null;
}

export type AdminCandidateRow = {
  github: string;
  title: Title;
  hiddenScore: number;
  boardEfficiency: number;
  achievedAt: number;
  publicId: string;
  shiftCount: number;
  hasContact: boolean;
  lastActive: number;
  connectedCalls?: number;
  totalCalls?: number;
  droppedCalls?: number;
  avgHoldSeconds?: number;
}

export type AdminCandidatePage = {
  rows: AdminCandidateRow[];
  totalEntries: number;
  page: number;
  totalPages: number;
}

export type AdminDetailRun = {
  id: string;
  kind: string;
  trigger: string;
  state: string;
  acceptedAt: number;
  resolvedAt?: number;
  sourceSnapshot: string;
  metrics?: SimulationMetrics;
  title?: Title;
  chiefOperatorNote?: string;
  probeSummary?: {
    metrics: {
      connectedCalls: number;
      totalCalls: number;
      droppedCalls: number;
      avgHoldSeconds: number;
      premiumUsageRate: number;
      efficiency: number;
    };
    failureModes: string[];
    deskCondition: string;
    probeKind: string;
  };
}

export type AdminDetailShift = {
  id: string;
  state: string;
  startedAt: number;
  completedAt?: number;
  expiresAt: number;
  runs: AdminDetailRun[];
}

export type AdminCandidateDetail = {
  github: string;
  leaderboardRow: LeaderboardEntry | null;
  shifts: AdminDetailShift[];
  contact: { name: string; email: string; submittedAt: number } | null;
  summary: { summary: string; generatedAt: number } | null;
}
