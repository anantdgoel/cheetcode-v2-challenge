export type ShiftStatus = "active_phase_1" | "active_phase_2" | "evaluating" | "completed" | "expired_no_result";

export type ProbeKind = "fit" | "stress";

export type EvaluationKind = ProbeKind | "final" | "auto_final";

export type EvaluationState = "accepted" | "completed";

export type Title =
  | "chief_operator"
  | "senior_operator"
  | "operator"
  | "trainee"
  | "off_the_board";

export type RouteCode = "local" | "intercity" | "relay" | "priority";
export type SubscriberClass = "residence" | "business" | "hotel" | "government";
export type BillingMode = "standard" | "verified" | "collect";
export type Urgency = "routine" | "priority";
export type MaintenanceBand = "steady" | "temperamental" | "recently_serviced";
export type BoardProfile = "switchboard" | "front-office" | "night-rush";
export type LineFamily = "district" | "relay" | "trunk";
export type BoardCondition = "steady" | "strained" | "overrun";
export type LoadBand = "low" | "medium" | "high" | "peak";
export type QueueBand = "short" | "rising" | "long";
export type TrafficRegime = "lunchtime" | "closing_bell" | "storm_hour" | "late_quiet";

export type ArtifactName = "manual.md" | "starter.js" | "lines.json" | "observations.jsonl";

export type VisibleLine = {
  id: string;
  label: string;
  switchMark: string;
  classTags: string[];
  lineGroupId: string;
  isPremiumTrunk: boolean;
  maintenanceBand: MaintenanceBand;
};

export type LiveLine = VisibleLine & {
  status: "idle" | "busy" | "fault";
  secondsUntilBusyClears: number;
  secondsUntilFaultClears: number;
};

export type ExchangeCall = {
  id: string;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
  queuedForSeconds: number;
  attempt: number;
};

export type PolicyClock = {
  second: number;
  remainingSeconds: number;
};

export type PolicyBoard = {
  load: number;
  queueDepth: number;
  callsHandled: number;
};

export type PolicyInput = {
  clock: PolicyClock;
  board: PolicyBoard;
  call: ExchangeCall;
  lines: LiveLine[];
};

export type PolicyInitContext = {
  shift: {
    durationSeconds: number;
    probeKind: ProbeKind | "final";
  };
  board: {
    lineCount: number;
    premiumCount: number;
    lineGroups: Array<{
      groupId: string;
      label: string;
      lineIds: string[];
    }>;
  };
};

export type TrafficEvent = {
  id: string;
  atSecond: number;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
};

export type HiddenLineProfile = VisibleLine & {
  historicalAlias: string;
  family: LineFamily;
  qualityOffset: number;
  loadSoftCap: number;
  loadSlope: number;
  premiumBoost: number;
  maintenanceOffset: number;
  compatibility: Record<string, number>;
};

export type PressureCurve = {
  duration: number;
  points: number[];
};

export type ObservationRow = {
  logId: string;
  shiftBucket: string;
  trafficRegime: TrafficRegime;
  historicalLineAlias: string;
  historicalLineGroup: string;
  call: {
    routeCode: RouteCode;
    subscriberClass: SubscriberClass;
    billingMode: BillingMode;
    urgency: Urgency;
  };
  context: {
    loadBand: LoadBand;
    queueBand: QueueBand;
    recentIncidentsNearLine: number;
  };
  decision: {
    action: "route" | "hold";
    usedPremium: boolean;
  };
  outcome: {
    result: "connected" | "held" | "fault" | "dropped";
    holdBand?: "brief" | "moderate" | "long";
  };
};

export type GeneratedGameSnapshot = {
  seed: string;
  boardProfile: BoardProfile;
  lines: HiddenLineProfile[];
  probePressureCurves: Record<ProbeKind, PressureCurve>;
  probeTrafficPlans: Record<ProbeKind, TrafficEvent[]>;
  pressureCurveFinal: PressureCurve;
  finalTrafficPlan: TrafficEvent[];
  observations: ObservationRow[];
};

export type FailureReason =
  | "policy_hold"
  | "dropped_on_hold"
  | "busy_line"
  | "faulted_line"
  | "invalid_line"
  | "low_margin_fault";

export type FailureEvent = {
  atSecond: number;
  callId: string;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
  queueDepth: number;
  loadBand: LoadBand;
  lineGroupId: string | null;
  lineId: string | null;
  reason: FailureReason;
  detail: string;
};

export type SimulationTraceEvent = {
  atSecond: number;
  callId: string;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
  queuedForSeconds: number;
  boardLoad: number;
  queueDepth: number;
  selectedLineId: string | null;
  selectedLineGroupId: string | null;
  selectedLinePremium: boolean;
  selectedLineAvailable: boolean;
  outcome: "connected" | "held" | "dropped" | "fault";
  lineId: string | null;
  reason: string;
};

export type SimulationMetrics = {
  connectedCalls: number;
  totalCalls: number;
  droppedCalls: number;
  avgHoldSeconds: number;
  totalHoldSeconds: number;
  premiumUsageCount: number;
  premiumUsageRate: number;
  trunkMisuseCount: number;
  efficiency: number;
  hiddenScore: number;
};

export type ProbeTableRow = {
  bucketId: string;
  attempts: number;
  connectRate: number;
  dropRate: number;
  avgHoldSeconds: number;
  premiumUsageRate: number;
};

export type ProbeSummary = {
  probeKind: ProbeKind;
  deskCondition: BoardCondition;
  metrics: {
    connectedCalls: number;
    totalCalls: number;
    droppedCalls: number;
    avgHoldSeconds: number;
    premiumUsageRate: number;
    efficiency: number;
  };
  callBucketTable: Array<
    ProbeTableRow & {
      routeCode: RouteCode;
      billingMode: BillingMode;
      urgency: Urgency;
    }
  >;
  loadBandTable: Array<
    ProbeTableRow & {
      loadBand: LoadBand;
    }
  >;
  lineGroupTable: Array<{
    lineGroupId: string;
    usageCount: number;
    connectRate: number;
    faultRate: number;
    premiumUsageRate: number;
  }>;
  failureBuckets: Array<{
    bucketId: string;
    count: number;
    dominantReason: "hold_too_long" | "fault_under_load" | "premium_misuse" | "low_margin_routing";
    confidence: number;
  }>;
  incidents: Array<{
    second: number;
    note: string;
  }>;
};

export type ProbeResult = {
  kind: ProbeKind;
  at: number;
  efficiency: number;
  sourceHash: string;
};

export type FinalReport = {
  publicId: string;
  shiftId: string;
  github: string;
  title: Title;
  boardEfficiency: number;
  connectedCalls: number;
  totalCalls: number;
  droppedCalls: number;
  avgHoldSeconds: number;
  premiumTrunkUsage: number;
  chiefOperatorNote: string;
  achievedAt: number;
  hiddenScore: number;
  kind: Exclude<EvaluationKind, ProbeKind>;
};

export type ShiftArtifacts = {
  gameSnapshot: GeneratedGameSnapshot;
  manualMd: string;
  starterJs: string;
  linesJson: string;
  observationsJsonl: string;
};

export type PolicyValidationResult =
  | {
      ok: true;
      normalizedSource: string;
      sourceHash: string;
    }
  | {
      ok: false;
      error: string;
    };

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
  traceChunkCount?: number;
};

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
  currentPhase: "active" | "evaluating" | "completed" | "expired";
  probesUsed: number;
  maxProbes: number;
  remainingProbes: number;
  nextProbeKind?: ProbeKind;
  canGoLive: boolean;
  probeEvaluations: EvaluationRecordView[];
  finalEvaluation?: EvaluationRecordView;
};

export type ShiftRuntimeView = {
  id: string;
  github: string;
  seed: string;
};

export type ReportView = FinalReport;

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
};

export type LandingView = {
  leaderboard: LeaderboardEntry[];
  activeShiftId?: string | null;
  github?: string | null;
};
