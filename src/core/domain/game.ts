export const PROBE_KINDS = ['fit', 'stress'] as const
export const TITLES = [
  'chief_operator',
  'senior_operator',
  'operator',
  'trainee',
  'off_the_board'
] as const
export const ROUTE_CODES = ['local', 'intercity', 'relay', 'priority'] as const
export const SUBSCRIBER_CLASSES = ['residence', 'business', 'hotel', 'government'] as const
export const BILLING_MODES = ['standard', 'verified', 'collect'] as const
export const URGENCIES = ['routine', 'priority'] as const
export const MAINTENANCE_BANDS = ['steady', 'temperamental', 'recently_serviced'] as const
export const BOARD_PROFILES = [
  'switchboard',
  'front-office',
  'night-rush',
  'civic-desk',
  'commuter-belt',
  'storm-watch'
] as const
export const LINE_FAMILIES = ['district', 'relay', 'trunk', 'exchange', 'suburban'] as const
export const BOARD_CONDITIONS = ['steady', 'strained', 'overrun'] as const
export const BOARD_TEMPOS = ['steady', 'surging', 'cooling'] as const
export const LOAD_BANDS = ['low', 'medium', 'high', 'peak'] as const
export const QUEUE_BANDS = ['short', 'rising', 'long'] as const
export const TRAFFIC_REGIMES = ['lunchtime', 'closing_bell', 'storm_hour', 'late_quiet'] as const
export const OPERATOR_GRADES = ['senior', 'operator', 'trainee'] as const
export const PRESSURE_BANDS = ['calm', 'building', 'hot'] as const
export const PREMIUM_REUSE_BANDS = ['fresh', 'warm', 'hot'] as const
export const FINAL_SHIFT_KINDS = ['traffic_mix', 'cap_swing'] as const
export const ARTIFACT_NAMES = ['manual.md', 'starter.js', 'lines.json', 'observations.jsonl'] as const
export const PROBE_RECOMMENDED_QUESTION_COUNT = 2 as const
export const PROBE_CHIEF_OPERATOR_NOTE_COUNT = 5 as const
export const PROBE_COUNTERFACTUAL_NOTE_COUNT = 2 as const
export const FAILURE_MODES = [
  'collapse_under_pressure',
  'premium_thrash',
  'overholding',
  'false_generalist',
  'tempo_lag',
  'misleading_history'
] as const
export const TRANSFER_WARNINGS = ['stable', 'stress_only', 'likely_final_shift_sensitive'] as const

export type ProbeKind = (typeof PROBE_KINDS)[number]
export type Title = (typeof TITLES)[number]
export type RouteCode = (typeof ROUTE_CODES)[number]
export type SubscriberClass = (typeof SUBSCRIBER_CLASSES)[number]
export type BillingMode = (typeof BILLING_MODES)[number]
export type Urgency = (typeof URGENCIES)[number]
export type MaintenanceBand = (typeof MAINTENANCE_BANDS)[number]
export type BoardProfile = (typeof BOARD_PROFILES)[number]
export type LineFamily = (typeof LINE_FAMILIES)[number]
export type BoardCondition = (typeof BOARD_CONDITIONS)[number]
export type BoardTempo = (typeof BOARD_TEMPOS)[number]
export type LoadBand = (typeof LOAD_BANDS)[number]
export type QueueBand = (typeof QUEUE_BANDS)[number]
export type TrafficRegime = (typeof TRAFFIC_REGIMES)[number]
export type OperatorGrade = (typeof OPERATOR_GRADES)[number]
export type PressureBand = (typeof PRESSURE_BANDS)[number]
export type PremiumReuseBand = (typeof PREMIUM_REUSE_BANDS)[number]
export type FinalShiftKind = (typeof FINAL_SHIFT_KINDS)[number]
export type ArtifactName = (typeof ARTIFACT_NAMES)[number]
export type FailureMode = (typeof FAILURE_MODES)[number]
export type TransferWarning = (typeof TRANSFER_WARNINGS)[number]

export type PublicLine = {
  id: string;
  label: string;
  switchMark: string;
  classTags: string[];
  lineGroupId: string;
  isPremiumTrunk: boolean;
  maintenanceBand: MaintenanceBand;
}

export type RuntimeLineView = PublicLine & {
  status: 'idle' | 'busy' | 'fault';
  secondsUntilBusyClears: number;
  secondsUntilFaultClears: number;
}

export type ExchangeCall = {
  id: string;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
  queuedForSeconds: number;
  attempt: number;
}

export type PolicyClock = {
  second: number;
  remainingSeconds: number;
}

export type PolicyBoard = {
  load: number;
  pressure: number;
  queueDepth: number;
  callsHandled: number;
  tempo: BoardTempo;
}

export type PolicyInput = {
  clock: PolicyClock;
  board: PolicyBoard;
  call: ExchangeCall;
  lines: RuntimeLineView[];
}

export type PolicyInitContext = {
  shift: {
    durationSeconds: number;
    probeKind: ProbeKind | 'final';
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
}

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
}

export type ProbeTableRow = {
  bucketId: string;
  attempts: number;
  connectRate: number;
  dropRate: number;
  avgHoldSeconds: number;
  premiumUsageRate: number;
}

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
    dominantReason: 'hold_too_long' | 'fault_under_load' | 'premium_misuse' | 'low_margin_routing';
    confidence: number;
  }>;
  failureModes: FailureMode[];
  modeConfidence: Partial<Record<FailureMode, number>>;
  transferWarning: TransferWarning;
  recommendedQuestions: [string, string];
  chiefOperatorNotes: [string, string, string, string, string];
  counterfactualNotes: [string, string];
  incidents: Array<{
    second: number;
    note: string;
  }>;
}

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
  kind: 'final' | 'auto_final';
}

export type PolicyValidationResult =
  | {
    ok: true;
    normalizedSource: string;
    sourceHash: string;
  }
  | {
    ok: false;
    error: string;
  }
