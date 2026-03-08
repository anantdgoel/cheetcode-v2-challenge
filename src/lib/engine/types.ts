import type {
  ArtifactName,
  BillingMode,
  BoardProfile,
  LineFamily,
  LoadBand,
  MaintenanceBand,
  ProbeKind,
  PublicLine,
  QueueBand,
  RouteCode,
  RuntimeLineView,
  SimulationMetrics,
  SubscriberClass,
  TrafficRegime,
  Urgency,
} from "@/lib/contracts/game";
import type { Title } from "@/lib/contracts/game";

export type TrafficEvent = {
  id: string;
  atSecond: number;
  routeCode: RouteCode;
  subscriberClass: SubscriberClass;
  billingMode: BillingMode;
  urgency: Urgency;
};

export type LineModel = PublicLine & {
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

export type FinalPhaseChange = {
  shiftPoint: number;
  loadDelta: number;
  routeProfileAfterShift: BoardProfile;
  shiftedFamily: LineFamily;
  capDelta: number;
};

export type BoardModel = {
  seed: string;
  boardProfile: BoardProfile;
  lines: LineModel[];
  visibleFamilyPermutation: Record<LineFamily, LineFamily>;
  visibleNoiseRate: number;
  finalPhaseChange: FinalPhaseChange;
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

export type SimulationResult = {
  metrics: SimulationMetrics;
  title: Title;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
};

export type ProbeRunResult = {
  result: SimulationResult;
  summary: import("@/lib/contracts/game").ProbeSummary;
};

export type ShiftArtifacts = {
  board: BoardModel;
  manualMd: string;
  starterJs: string;
  linesJson: string;
  observationsJsonl: string;
};

export type ArtifactContent = {
  name: ArtifactName;
  content: string;
};

export type RuntimeDecision = {
  lineId: string | null;
  error?: string;
};

export type RuntimeLineState = RuntimeLineView;

export type RangeTuning = {
  base: number;
  spread: number;
  min: number;
  max: number;
};

export type ClampRange = {
  min: number;
  max: number;
};
