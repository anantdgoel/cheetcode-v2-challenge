import type { BoardCondition, ProbeKind, ProbeSummary } from "@/lib/domain/game";
import { GAME_BALANCE } from "./config/balance";
import type { BoardModel, FailureEvent, SimulationResult } from "./models";
import { buildProbeTables, computeSignals } from "./probe-summary-analysis";
import {
  buildChiefOperatorNotes,
  buildCounterfactualNotes,
  buildRecommendedQuestions,
  scoreFailureModes,
  transferWarningForSignals,
} from "./probe-summary-narrative";

function describeIncident(event: FailureEvent) {
  return `${event.reason.replace(/_/g, " ")}: ${event.routeCode}/${event.billingMode}/${event.urgency} at ${event.atSecond}s${event.lineId ? ` on ${event.lineId}` : ""}. ${event.detail}`;
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

function getDeskCondition(hiddenScore: number): BoardCondition {
  if (hiddenScore >= GAME_BALANCE.scoring.deskConditionThresholds.steady) return "steady";
  if (hiddenScore >= GAME_BALANCE.scoring.deskConditionThresholds.strained) return "strained";
  return "overrun";
}

export function summarizeProbe(result: SimulationResult, mode: ProbeKind, board?: BoardModel): ProbeSummary {
  const { callBucketTable, loadBandTable, lineGroupTable, failureBuckets } = buildProbeTables(result);
  const signals = computeSignals(result, loadBandTable, lineGroupTable, board);
  const failureModeScores = scoreFailureModes(signals, mode);
  const transferWarning = transferWarningForSignals(signals, mode);

  return {
    probeKind: mode,
    deskCondition: getDeskCondition(result.metrics.hiddenScore),
    metrics: summarizeProbeMetrics(result),
    callBucketTable,
    loadBandTable,
    lineGroupTable,
    failureBuckets,
    failureModes: failureModeScores.ranked,
    modeConfidence: failureModeScores.scores,
    transferWarning,
    recommendedQuestions: buildRecommendedQuestions(failureModeScores.ranked),
    chiefOperatorNotes: buildChiefOperatorNotes(failureModeScores.ranked, failureBuckets, transferWarning, signals),
    counterfactualNotes: buildCounterfactualNotes(failureModeScores.ranked, failureBuckets),
    incidents: result.failures.slice(0, GAME_BALANCE.probePresentation.maxIncidentNotes).map((event) => ({
      second: event.atSecond,
      note: describeIncident(event),
    })),
  };
}
