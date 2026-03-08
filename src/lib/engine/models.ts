import type {
  ArtifactName,
  BillingMode,
  BoardProfile,
  FinalShiftKind,
  LineFamily,
  LoadBand,
  MaintenanceBand,
  OperatorGrade,
  PressureBand,
  PremiumReuseBand,
  ProbeKind,
  PublicLine,
  QueueBand,
  RouteCode,
  RuntimeLineView,
  SimulationMetrics,
  SubscriberClass,
  TrafficRegime,
  Urgency,
} from "@/lib/domain/game";
import type { Title } from "@/lib/domain/game";

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
  visibleFamily: LineFamily;
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
  operatorGrade: OperatorGrade;
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
    pressureBand: PressureBand;
    queueBand: QueueBand;
    premiumReuseBand: PremiumReuseBand;
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
  kind: FinalShiftKind;
  shiftPoint: number;
  durationSeconds: number;
  loadDelta: number;
  trafficDelta: Partial<Record<RouteCode, number>>;
  targetFamily: LineFamily;
  capDelta: number;
};

export type BoardHiddenTraits = {
  pressureCollapse: number;
  premiumFragility: number;
  historyReliability: number;
  finalShiftSensitivity: number;
  tempoLag: number;
};

export type BoardModel = {
  seed: string;
  boardProfile: BoardProfile;
  activeFamilies: LineFamily[];
  lines: LineModel[];
  visibleFamilyMap: Partial<Record<LineFamily, LineFamily>>;
  visibleNoiseRate: number;
  finalPhaseChanges: FinalPhaseChange[];
  hiddenTraits: BoardHiddenTraits;
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
  boardPressure: number;
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

export type ShiftArtifacts = {
  board: BoardModel;
  manualMd: string;
  starterJs: string;
  linesJson: string;
  observationsJsonl: string;
};

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
