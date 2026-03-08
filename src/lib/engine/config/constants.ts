import type {
  BillingMode,
  BoardProfile,
  LineFamily,
  RouteCode,
  Title,
  TrafficRegime,
  Urgency
} from '@/lib/domain/game'
import {
  BILLING_MODES,
  BOARD_PROFILES,
  LINE_FAMILIES,
  MAINTENANCE_BANDS,
  ROUTE_CODES,
  SUBSCRIBER_CLASSES,
  TRAFFIC_REGIMES,
  URGENCIES
} from '@/lib/domain/game'

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
  URGENCIES
}

export const GENERIC_LABELS = [
  'Cord Position',
  'Jack Frame',
  'Bay Terminal',
  'Patch Desk',
  'Operator Post',
  'Signal Desk'
] as const

export const SHARED_SWITCH_MARKS = ['D-4', 'N-2', 'L-5', 'H-6', 'T-1', 'P-7', 'B-3', 'M-4', 'C-9'] as const
export const SHARED_TAGS = [
  'residential',
  'street',
  'borough',
  'junction',
  'transit',
  'hotel',
  'continental',
  'commercial',
  'desk',
  'ledger',
  'meter',
  'trunk',
  'government'
] as const

export const DROP_THRESHOLDS: Record<RouteCode, number> = {
  local: 16,
  intercity: 26,
  relay: 22,
  priority: 12
}

export const TITLE_THRESHOLDS: Array<{ title: Title; minScore: number }> = [
  { title: 'chief_operator', minScore: 0.88 },
  { title: 'senior_operator', minScore: 0.74 },
  { title: 'operator', minScore: 0.58 },
  { title: 'trainee', minScore: 0.42 },
  { title: 'off_the_board', minScore: -1 }
]

export const SCORE_WEIGHTS = {
  connectRate: 0.62,
  dropRate: 0.2,
  holdRate: 0.1,
  trunkDiscipline: 0.08
} as const

export const PROFILE_ROUTE_WEIGHTS: Record<BoardProfile, Record<RouteCode, number>> = {
  switchboard: { local: 0.36, intercity: 0.2, relay: 0.22, priority: 0.22 },
  'front-office': { local: 0.24, intercity: 0.28, relay: 0.2, priority: 0.28 },
  'night-rush': { local: 0.22, intercity: 0.24, relay: 0.3, priority: 0.24 },
  'civic-desk': { local: 0.2, intercity: 0.18, relay: 0.24, priority: 0.38 },
  'commuter-belt': { local: 0.34, intercity: 0.16, relay: 0.3, priority: 0.2 },
  'storm-watch': { local: 0.16, intercity: 0.28, relay: 0.24, priority: 0.32 }
}

export const PROFILE_BILLING_WEIGHTS: Record<BoardProfile, Record<BillingMode, number>> = {
  switchboard: { standard: 0.54, verified: 0.24, collect: 0.22 },
  'front-office': { standard: 0.36, verified: 0.42, collect: 0.22 },
  'night-rush': { standard: 0.38, verified: 0.3, collect: 0.32 },
  'civic-desk': { standard: 0.24, verified: 0.5, collect: 0.26 },
  'commuter-belt': { standard: 0.48, verified: 0.2, collect: 0.32 },
  'storm-watch': { standard: 0.28, verified: 0.42, collect: 0.3 }
}

export const PROFILE_URGENCY_WEIGHTS: Record<BoardProfile, Record<Urgency, number>> = {
  switchboard: { routine: 0.78, priority: 0.22 },
  'front-office': { routine: 0.64, priority: 0.36 },
  'night-rush': { routine: 0.68, priority: 0.32 },
  'civic-desk': { routine: 0.54, priority: 0.46 },
  'commuter-belt': { routine: 0.76, priority: 0.24 },
  'storm-watch': { routine: 0.52, priority: 0.48 }
}

export const PROFILE_FAMILY_WEIGHTS: Record<BoardProfile, Record<LineFamily, number>> = {
  switchboard: { district: 0.34, relay: 0.2, trunk: 0.16, exchange: 0.12, suburban: 0.18 },
  'front-office': { district: 0.18, relay: 0.18, trunk: 0.28, exchange: 0.22, suburban: 0.14 },
  'night-rush': { district: 0.16, relay: 0.3, trunk: 0.18, exchange: 0.12, suburban: 0.24 },
  'civic-desk': { district: 0.14, relay: 0.2, trunk: 0.18, exchange: 0.32, suburban: 0.16 },
  'commuter-belt': { district: 0.26, relay: 0.18, trunk: 0.12, exchange: 0.1, suburban: 0.34 },
  'storm-watch': { district: 0.12, relay: 0.18, trunk: 0.28, exchange: 0.24, suburban: 0.18 }
}

export const TRAFFIC_REGIME_ORDER: readonly TrafficRegime[] = TRAFFIC_REGIMES
