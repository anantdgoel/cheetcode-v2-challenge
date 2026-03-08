import type {
  BillingMode,
  BoardCondition,
  LoadBand,
  ProbeKind,
  ProbeSummary,
  RouteCode,
  Urgency,
} from "@/lib/domain/game";
import { GAME_BALANCE } from "./config/balance";
import { clamp } from "./shared";
import { divideAndRound, loadBandForSimulationLoad } from "./shared";
import type { FailureEvent, SimulationResult } from "./models";

const LOAD_BAND_ORDER: LoadBand[] = ["low", "medium", "high", "peak"];

type ProbeBucketAccumulator = {
  routeCode: RouteCode;
  billingMode: BillingMode;
  urgency: Urgency;
  attempts: number;
  connected: number;
  dropped: number;
  holdSeconds: number;
  premium: number;
};

type LoadBucketAccumulator = {
  attempts: number;
  connected: number;
  dropped: number;
  holdSeconds: number;
  premium: number;
};

type LineGroupAccumulator = {
  usageCount: number;
  connected: number;
  faults: number;
  premium: number;
};

function describeIncident(event: FailureEvent) {
  return `${event.reason.replace(/_/g, " ")}: ${event.routeCode}/${event.billingMode}/${event.urgency} at ${event.atSecond}s${event.lineId ? ` on ${event.lineId}` : ""}. ${event.detail}`;
}

function getFailureBucketReason(
  event: FailureEvent,
): ProbeSummary["failureBuckets"][number]["dominantReason"] {
  if (event.reason === "dropped_on_hold") return "hold_too_long";
  if (event.reason === "low_margin_fault") return "fault_under_load";
  if (event.reason === "policy_hold" || event.reason === "invalid_line" || event.reason === "busy_line") {
    return "low_margin_routing";
  }
  return "premium_misuse";
}

function dominantFailureBuckets(events: FailureEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const bucketId = `${event.routeCode}|${event.billingMode}|${event.urgency}`;
    counts.set(bucketId, (counts.get(bucketId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
}

function dominantReason(events: FailureEvent[]) {
  const counts = new Map<ProbeSummary["failureBuckets"][number]["dominantReason"], number>();
  for (const event of events) {
    const reason = getFailureBucketReason(event);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "low_margin_routing";
}

function summarizeProbeMetrics(result: SimulationResult): ProbeSummary["metrics"] {
  return {
    connectedCalls: result.metrics.connectedCalls,
    totalCalls: result.metrics.totalCalls,
    droppedCalls: result.metrics.droppedCalls,
    avgHoldSeconds: result.metrics.avgHoldSeconds,
    premiumUsageRate: result.metrics.premiumUsageRate,
    efficiency: result.metrics.efficiency,
  };
}

function toProbeTableRow(row: ProbeBucketAccumulator) {
  return {
    bucketId: `${row.routeCode}|${row.billingMode}|${row.urgency}`,
    routeCode: row.routeCode,
    billingMode: row.billingMode,
    urgency: row.urgency,
    attempts: row.attempts,
    connectRate: divideAndRound(row.connected, row.attempts, 3),
    dropRate: divideAndRound(row.dropped, row.attempts, 3),
    avgHoldSeconds: divideAndRound(row.holdSeconds, row.attempts, 2),
    premiumUsageRate: divideAndRound(row.premium, row.attempts, 3),
  };
}

function toLoadBandRow(loadBand: LoadBand, row: LoadBucketAccumulator) {
  return {
    loadBand,
    bucketId: loadBand,
    attempts: row.attempts,
    connectRate: divideAndRound(row.connected, row.attempts, 3),
    dropRate: divideAndRound(row.dropped, row.attempts, 3),
    avgHoldSeconds: divideAndRound(row.holdSeconds, row.attempts, 2),
    premiumUsageRate: divideAndRound(row.premium, row.attempts, 3),
  };
}

function toLineGroupRow([lineGroupId, row]: [string, LineGroupAccumulator]) {
  return {
    lineGroupId,
    usageCount: row.usageCount,
    connectRate: divideAndRound(row.connected, row.usageCount, 3),
    faultRate: divideAndRound(row.faults, row.usageCount, 3),
    premiumUsageRate: divideAndRound(row.premium, row.usageCount, 3),
  };
}

export function summarizeProbe(result: SimulationResult, mode: ProbeKind): ProbeSummary {
  const deskCondition: BoardCondition =
    result.metrics.hiddenScore >= GAME_BALANCE.scoring.deskConditionThresholds.steady
      ? "steady"
      : result.metrics.hiddenScore >= GAME_BALANCE.scoring.deskConditionThresholds.strained
        ? "strained"
        : "overrun";

  const callBuckets = new Map<string, ProbeBucketAccumulator>();
  const loadBuckets = new Map<LoadBand, LoadBucketAccumulator>();
  const lineGroups = new Map<string, LineGroupAccumulator>();

  for (const event of result.trace) {
    const bucketId = `${event.routeCode}|${event.billingMode}|${event.urgency}`;
    const callBucket = callBuckets.get(bucketId) ?? {
      routeCode: event.routeCode,
      billingMode: event.billingMode,
      urgency: event.urgency,
      attempts: 0,
      connected: 0,
      dropped: 0,
      holdSeconds: 0,
      premium: 0,
    };
    callBucket.attempts += 1;
    if (event.outcome === "connected") callBucket.connected += 1;
    if (event.outcome === "dropped" || event.outcome === "fault") callBucket.dropped += 1;
    callBucket.holdSeconds += event.queuedForSeconds;
    if (event.selectedLinePremium) callBucket.premium += 1;
    callBuckets.set(bucketId, callBucket);

    const loadBand = loadBandForSimulationLoad(event.boardLoad);
    const loadBucket = loadBuckets.get(loadBand) ?? {
      attempts: 0,
      connected: 0,
      dropped: 0,
      holdSeconds: 0,
      premium: 0,
    };
    loadBucket.attempts += 1;
    if (event.outcome === "connected") loadBucket.connected += 1;
    if (event.outcome === "dropped" || event.outcome === "fault") loadBucket.dropped += 1;
    loadBucket.holdSeconds += event.queuedForSeconds;
    if (event.selectedLinePremium) loadBucket.premium += 1;
    loadBuckets.set(loadBand, loadBucket);

    if (event.selectedLineGroupId) {
      const lineGroup = lineGroups.get(event.selectedLineGroupId) ?? {
        usageCount: 0,
        connected: 0,
        faults: 0,
        premium: 0,
      };
      lineGroup.usageCount += 1;
      if (event.outcome === "connected") lineGroup.connected += 1;
      if (event.outcome === "fault") lineGroup.faults += 1;
      if (event.selectedLinePremium) lineGroup.premium += 1;
      lineGroups.set(event.selectedLineGroupId, lineGroup);
    }
  }

  const failureBuckets = dominantFailureBuckets(result.failures).map(([bucketId, count]) => {
    const events = result.failures.filter(
      (event) => `${event.routeCode}|${event.billingMode}|${event.urgency}` === bucketId,
    );
    return {
      bucketId,
      count,
      dominantReason: dominantReason(events),
      confidence: Number(
        clamp(
          count / Math.max(result.metrics.totalCalls * GAME_BALANCE.probePresentation.confidenceTrafficFactor, 1),
          GAME_BALANCE.probePresentation.confidenceFloor,
          GAME_BALANCE.probePresentation.confidenceCeiling,
        ).toFixed(2),
      ),
    };
  });

  return {
    probeKind: mode,
    deskCondition,
    metrics: summarizeProbeMetrics(result),
    callBucketTable: [...callBuckets.values()].map(toProbeTableRow).sort((left, right) => right.attempts - left.attempts),
    loadBandTable: LOAD_BAND_ORDER.map((loadBand) =>
      toLoadBandRow(loadBand, loadBuckets.get(loadBand) ?? {
        attempts: 0,
        connected: 0,
        dropped: 0,
        holdSeconds: 0,
        premium: 0,
      }),
    ),
    lineGroupTable: [...lineGroups.entries()].map(toLineGroupRow).sort((left, right) => right.usageCount - left.usageCount),
    failureBuckets,
    incidents: result.failures.slice(0, GAME_BALANCE.probePresentation.maxIncidentNotes).map((event) => ({
      second: event.atSecond,
      note: describeIncident(event),
    })),
  };
}
