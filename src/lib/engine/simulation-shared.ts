import type { LoadBand } from "@/lib/contracts/game";
import { GAME_BALANCE } from "./config/balance";

export const LOAD_BAND_ORDER: LoadBand[] = ["low", "medium", "high", "peak"];

export function loadBandForSimulationLoad(value: number): LoadBand {
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.peak) return "peak";
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.high) return "high";
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.medium) return "medium";
  return "low";
}

export function divideAndRound(value: number, total: number, fractionDigits: number) {
  return Number((value / Math.max(total, 1)).toFixed(fractionDigits));
}
