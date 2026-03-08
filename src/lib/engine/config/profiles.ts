import type { BillingMode, LineFamily, RouteCode, Urgency } from "@/lib/domain/game";
import { SHARED_SWITCH_MARKS, SHARED_TAGS } from "./constants";

/**
 * Board-profile priors and visible-signal weights that define how the public
 * metadata correlates with the hidden line families.
 */
export const FAMILY_SWITCH_MARK_WEIGHTS: Record<LineFamily, Record<(typeof SHARED_SWITCH_MARKS)[number], number>> = {
  district: { "D-4": 8, "N-2": 7, "L-5": 3, "H-6": 2, "T-1": 2, "P-7": 2, "B-3": 4, "M-4": 2, "C-9": 4 },
  relay: { "D-4": 2, "N-2": 2, "L-5": 8, "H-6": 7, "T-1": 4, "P-7": 3, "B-3": 2, "M-4": 3, "C-9": 2 },
  trunk: { "D-4": 2, "N-2": 2, "L-5": 4, "H-6": 3, "T-1": 8, "P-7": 7, "B-3": 2, "M-4": 6, "C-9": 2 },
  exchange: { "D-4": 1, "N-2": 2, "L-5": 3, "H-6": 6, "T-1": 3, "P-7": 8, "B-3": 2, "M-4": 3, "C-9": 7 },
  suburban: { "D-4": 7, "N-2": 4, "L-5": 6, "H-6": 3, "T-1": 2, "P-7": 1, "B-3": 7, "M-4": 2, "C-9": 3 },
};

export const FAMILY_TAG_WEIGHTS: Record<LineFamily, Record<(typeof SHARED_TAGS)[number], number>> = {
  district: {
    residential: 8,
    street: 7,
    borough: 6,
    junction: 2,
    transit: 2,
    hotel: 2,
    continental: 2,
    commercial: 4,
    desk: 3,
    ledger: 4,
    meter: 5,
    trunk: 1,
    government: 1,
  },
  relay: {
    residential: 2,
    street: 2,
    borough: 3,
    junction: 7,
    transit: 8,
    hotel: 6,
    continental: 5,
    commercial: 4,
    desk: 2,
    ledger: 2,
    meter: 2,
    trunk: 3,
    government: 2,
  },
  trunk: {
    residential: 1,
    street: 1,
    borough: 2,
    junction: 3,
    transit: 4,
    hotel: 3,
    continental: 8,
    commercial: 7,
    desk: 2,
    ledger: 2,
    meter: 3,
    trunk: 8,
    government: 3,
  },
  exchange: {
    residential: 1,
    street: 2,
    borough: 2,
    junction: 5,
    transit: 3,
    hotel: 4,
    continental: 6,
    commercial: 4,
    desk: 8,
    ledger: 6,
    meter: 1,
    trunk: 3,
    government: 8,
  },
  suburban: {
    residential: 5,
    street: 7,
    borough: 7,
    junction: 5,
    transit: 3,
    hotel: 2,
    continental: 2,
    commercial: 6,
    desk: 2,
    ledger: 3,
    meter: 5,
    trunk: 1,
    government: 1,
  },
};

type CompatibilityKey = `${RouteCode}|${BillingMode}|${Urgency}`;

export const FAMILY_COMPATIBILITY_BASE: Record<LineFamily, Partial<Record<CompatibilityKey, number>>> = {
  district: {
    "local|standard|routine": 0.95,
    "local|verified|routine": 0.8,
    "local|collect|routine": 0.82,
    "local|standard|priority": 0.74,
    "priority|standard|priority": 0.58,
  },
  relay: {
    "relay|standard|routine": 0.9,
    "relay|collect|routine": 0.86,
    "relay|collect|priority": 0.8,
    "priority|collect|priority": 0.74,
    "intercity|collect|routine": 0.76,
  },
  trunk: {
    "intercity|verified|routine": 0.92,
    "intercity|verified|priority": 0.96,
    "intercity|standard|priority": 0.82,
    "priority|verified|priority": 0.9,
    "priority|standard|priority": 0.78,
  },
  exchange: {
    "priority|verified|priority": 0.91,
    "priority|standard|priority": 0.84,
    "relay|verified|priority": 0.76,
    "intercity|verified|priority": 0.73,
    "local|verified|routine": 0.62,
  },
  suburban: {
    "local|collect|routine": 0.78,
    "local|standard|routine": 0.76,
    "relay|standard|routine": 0.72,
    "intercity|standard|routine": 0.66,
    "priority|verified|priority": 0.54,
  },
};
