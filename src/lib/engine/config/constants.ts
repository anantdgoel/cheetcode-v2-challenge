import type {
  BillingMode,
  BoardProfile,
  LineFamily,
  RouteCode,
  Title,
  TrafficRegime,
  Urgency,
} from "@/lib/contracts/game";
import {
  BILLING_MODES,
  BOARD_PROFILES,
  LINE_FAMILIES,
  MAINTENANCE_BANDS,
  ROUTE_CODES,
  SUBSCRIBER_CLASSES,
  TRAFFIC_REGIMES,
  URGENCIES,
} from "@/lib/contracts/game";

/**
 * Stable product vocabulary and small constant tables used by the engine.
 * These values are not regular balance knobs and should change rarely.
 */
export {
  BILLING_MODES,
  BOARD_PROFILES,
  LINE_FAMILIES,
  MAINTENANCE_BANDS,
  ROUTE_CODES,
  SUBSCRIBER_CLASSES,
  TRAFFIC_REGIMES,
  URGENCIES,
};

export const GENERIC_LABELS = [
  "Cord Position",
  "Jack Frame",
  "Bay Terminal",
  "Patch Desk",
  "Operator Post",
  "Signal Desk",
] as const;

export const SHARED_SWITCH_MARKS = ["D-4", "N-2", "L-5", "H-6", "T-1", "P-7", "B-3", "M-4", "C-9"] as const;
export const SHARED_TAGS = [
  "residential",
  "street",
  "borough",
  "junction",
  "transit",
  "hotel",
  "continental",
  "commercial",
  "desk",
  "ledger",
  "meter",
  "trunk",
] as const;

export const DROP_THRESHOLDS: Record<RouteCode, number> = {
  local: 16,
  intercity: 26,
  relay: 22,
  priority: 12,
};

export const TITLE_THRESHOLDS: Array<{ title: Title; minScore: number }> = [
  { title: "chief_operator", minScore: 0.88 },
  { title: "senior_operator", minScore: 0.74 },
  { title: "operator", minScore: 0.58 },
  { title: "trainee", minScore: 0.42 },
  { title: "off_the_board", minScore: -1 },
];

export const SCORE_WEIGHTS = {
  connectRate: 0.62,
  dropRate: 0.2,
  holdRate: 0.1,
  trunkDiscipline: 0.08,
} as const;

export const PROFILE_ROUTE_WEIGHTS: Record<BoardProfile, Record<RouteCode, number>> = {
  switchboard: { local: 0.36, intercity: 0.2, relay: 0.22, priority: 0.22 },
  "front-office": { local: 0.24, intercity: 0.28, relay: 0.2, priority: 0.28 },
  "night-rush": { local: 0.22, intercity: 0.24, relay: 0.3, priority: 0.24 },
};

export const PROFILE_BILLING_WEIGHTS: Record<BoardProfile, Record<BillingMode, number>> = {
  switchboard: { standard: 0.54, verified: 0.24, collect: 0.22 },
  "front-office": { standard: 0.36, verified: 0.42, collect: 0.22 },
  "night-rush": { standard: 0.38, verified: 0.3, collect: 0.32 },
};

export const PROFILE_URGENCY_WEIGHTS: Record<BoardProfile, Record<Urgency, number>> = {
  switchboard: { routine: 0.78, priority: 0.22 },
  "front-office": { routine: 0.64, priority: 0.36 },
  "night-rush": { routine: 0.68, priority: 0.32 },
};

export const PROFILE_FAMILY_WEIGHTS: Record<BoardProfile, Record<LineFamily, number>> = {
  switchboard: { district: 0.48, relay: 0.28, trunk: 0.24 },
  "front-office": { district: 0.3, relay: 0.28, trunk: 0.42 },
  "night-rush": { district: 0.28, relay: 0.44, trunk: 0.28 },
};

export const TRAFFIC_REGIME_ORDER: readonly TrafficRegime[] = TRAFFIC_REGIMES;
