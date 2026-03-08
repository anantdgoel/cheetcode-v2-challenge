import type { LoadBand, ProbeKind } from "@/lib/domain/game";
import { GAME_BALANCE } from "./config/balance";
import type { TrafficEvent } from "./models";

export type SimulationMode = ProbeKind | "final";
export type Rng = () => number;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(input: string) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

export function stableHash(input: string) {
  const next = hashSeed(input);
  return Array.from({ length: 4 }, () => next().toString(16).padStart(8, "0")).join("");
}

export function createRng(seed: string): Rng {
  const initial = hashSeed(seed)();
  let state = initial;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function weightedPick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const total = (Object.values(weights) as number[]).reduce((sum, value) => sum + value, 0);
  let roll = rng() * total;
  for (const [key, value] of Object.entries(weights) as Array<[T, number]>) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return Object.keys(weights)[0] as T;
}

export function shuffle<T>(rng: Rng, items: T[]) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function jitter(rng: Rng, value: number, spread: number, min = 0, max = 1) {
  return clamp(value + (rng() * spread * 2 - spread), min, max);
}

export function premiumEligible(call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">) {
  return (
    (call.routeCode === "intercity" && call.billingMode === "verified") ||
    (call.routeCode === "priority" && call.urgency === "priority")
  );
}

export function loadBandForSimulationLoad(value: number): LoadBand {
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.peak) return "peak";
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.high) return "high";
  if (value >= GAME_BALANCE.runtimePenalties.loadBandThresholds.medium) return "medium";
  return "low";
}

export function divideAndRound(value: number, total: number, fractionDigits: number) {
  return Number((value / Math.max(total, 1)).toFixed(fractionDigits));
}
