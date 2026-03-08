import type { PolicyInput, SimulationMetrics } from "@/lib/domain/game";
import { DROP_THRESHOLDS } from "./config/constants";
import { GAME_BALANCE } from "./config/balance";
import { createBoard } from "./board-generation";
import { computeHiddenScore, getTitleForScore } from "./scoring";
import {
  createRng,
  divideAndRound,
  loadBandForSimulationLoad,
  premiumEligible,
  type SimulationMode,
} from "./shared";
import { createPressureCurve, createTraffic } from "./traffic-generation";
import type { BoardModel, FailureEvent, SimulationResult, SimulationTraceEvent, TrafficEvent } from "./models";
import { connectProbability } from "./routing-math";
import {
  applyPremiumHeat,
  decayPremiumHeat,
  getAdjustedLine,
  getBoardTempo,
  getCurrentLoad,
  getEffectiveSoftCap,
  getPremiumHeat,
  getPublicPressure,
  getServiceDuration,
  idleNonPremiumExists,
  toRuntimeLineViews,
  type MutableLineState,
  type RuntimeContext,
} from "./runtime-helpers";

type QueueEntry = TrafficEvent & {
  arrivalAt: number;
  attempt: number;
};

type RuntimeAccumulators = {
  connectedCalls: number;
  droppedCalls: number;
  totalHoldSeconds: number;
  premiumUsageCount: number;
  trunkMisuseCount: number;
};

type PolicyDecisionFn = (input: PolicyInput) => Promise<{ lineId: string | null; error?: string }>;

async function routeCall(params: {
  call: TrafficEvent;
  second: number;
  attempt: number;
  queuedForSeconds: number;
  lines: MutableLineState[];
  runtime: RuntimeContext;
  queueDepth: number;
  callsHandled: number;
  decide: PolicyDecisionFn;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
  accumulators: RuntimeAccumulators;
}) {
  const load = getCurrentLoad(params.runtime.curve, params.second, params.queueDepth);
  const pressure = getPublicPressure(params.runtime, params.second, load);
  const tempo = getBoardTempo(params.runtime.board, params.runtime.mode, params.second);
  const input: PolicyInput = {
    clock: {
      second: params.second,
      remainingSeconds: params.runtime.curve.duration - params.second,
    },
    board: {
      load,
      pressure,
      queueDepth: params.queueDepth,
      callsHandled: params.callsHandled,
      tempo,
    },
    call: {
      id: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queuedForSeconds: params.queuedForSeconds,
      attempt: params.attempt,
    },
    lines: toRuntimeLineViews(params.lines, params.second),
  };

  const decision = await params.decide(input);
  const selected = decision.lineId ? params.lines.find((line) => line.line.id === decision.lineId) : null;

  const pushTrace = (outcome: SimulationTraceEvent["outcome"], lineId: string | null, reason: string, available = false) => {
    params.trace.push({
      atSecond: params.second,
      callId: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queuedForSeconds: params.queuedForSeconds,
      boardLoad: load,
      boardPressure: pressure,
      queueDepth: params.queueDepth,
      selectedLineId: decision.lineId ?? null,
      selectedLineGroupId: selected?.line.lineGroupId ?? null,
      selectedLinePremium: selected?.line.isPremiumTrunk ?? false,
      selectedLineAvailable: available,
      outcome,
      lineId,
      reason,
    });
  };

  if (!decision.lineId) {
    params.failures.push({
      atSecond: params.second,
      callId: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queueDepth: params.queueDepth,
      loadBand: loadBandForSimulationLoad(load),
      lineGroupId: null,
      lineId: null,
      reason: "policy_hold",
      detail: "The policy chose to leave the caller on hold.",
    });
    pushTrace("held", null, "policy-hold");
    return { handled: false };
  }

  if (!selected) {
    params.failures.push({
      atSecond: params.second,
      callId: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queueDepth: params.queueDepth,
      loadBand: loadBandForSimulationLoad(load),
      lineGroupId: null,
      lineId: decision.lineId,
      reason: "invalid_line",
      detail: "The policy selected a line that is not present on this board.",
    });
    pushTrace("held", null, "invalid-line");
    return { handled: false };
  }

  if (selected.faultUntil > params.second) {
    params.failures.push({
      atSecond: params.second,
      callId: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queueDepth: params.queueDepth,
      loadBand: loadBandForSimulationLoad(load),
      lineGroupId: selected.line.lineGroupId,
      lineId: selected.line.id,
      reason: "faulted_line",
      detail: "The selected line was still recovering.",
    });
    pushTrace("held", null, "faulted-line");
    return { handled: false };
  }

  if (selected.busyUntil > params.second) {
    params.failures.push({
      atSecond: params.second,
      callId: params.call.id,
      routeCode: params.call.routeCode,
      subscriberClass: params.call.subscriberClass,
      billingMode: params.call.billingMode,
      urgency: params.call.urgency,
      queueDepth: params.queueDepth,
      loadBand: loadBandForSimulationLoad(load),
      lineGroupId: selected.line.lineGroupId,
      lineId: selected.line.id,
      reason: "busy_line",
      detail: "The selected line was already occupied.",
    });
    pushTrace("held", null, "busy-line");
    return { handled: false };
  }

  params.accumulators.totalHoldSeconds += params.queuedForSeconds;

  if (selected.line.isPremiumTrunk) {
    params.accumulators.premiumUsageCount += 1;
    if (!premiumEligible(params.call) && idleNonPremiumExists(params.lines, params.second)) {
      params.accumulators.trunkMisuseCount += 1;
    }
  }

  const effectiveSoftCap = getEffectiveSoftCap(
    params.runtime.board,
    params.runtime.mode,
    params.second,
    selected.line,
    load,
  );
  const adjustedLine = getAdjustedLine(
    params.runtime.board,
    params.runtime.mode,
    params.second,
    selected.line,
    params.call,
    params.queuedForSeconds,
    load,
  );
  const premiumHeat = getPremiumHeat(params.runtime, selected.line);
  const probability = connectProbability(
    adjustedLine,
    params.call,
    load,
    params.queuedForSeconds,
    effectiveSoftCap,
    premiumHeat,
  );

  if (selected.line.isPremiumTrunk) {
    applyPremiumHeat(params.runtime, selected.line, params.call);
  }

  if (params.runtime.rng() < probability) {
    selected.busyUntil = params.second + getServiceDuration(params.call, params.runtime.rng);
    selected.faultUntil = 0;
    params.accumulators.connectedCalls += 1;
    pushTrace("connected", selected.line.id, "connected", true);
    return { handled: true };
  }

  params.accumulators.droppedCalls += 1;
  selected.busyUntil = 0;
  selected.faultUntil =
    params.second +
    GAME_BALANCE.runtimePenalties.faultRecovery.base +
    Math.floor((1 + load) * GAME_BALANCE.runtimePenalties.faultRecovery.loadFactor);
  params.failures.push({
    atSecond: params.second,
    callId: params.call.id,
    routeCode: params.call.routeCode,
    subscriberClass: params.call.subscriberClass,
    billingMode: params.call.billingMode,
    urgency: params.call.urgency,
    queueDepth: params.queueDepth,
    loadBand: loadBandForSimulationLoad(load),
    lineGroupId: selected.line.lineGroupId,
    lineId: selected.line.id,
    reason: "low_margin_fault",
    detail: "The selected line could not carry the call under current load.",
  });
  pushTrace("fault", selected.line.id, "low-margin-fault", true);
  return { handled: true };
}

async function drainQueue(params: {
  second: number;
  queue: QueueEntry[];
  lines: MutableLineState[];
  runtime: RuntimeContext;
  decide: PolicyDecisionFn;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
  accumulators: RuntimeAccumulators;
  callsHandled: number;
}) {
  while (params.queue.length) {
    const oldest = params.queue[0]!;
    const queuedForSeconds = params.second - oldest.arrivalAt;
    if (queuedForSeconds >= DROP_THRESHOLDS[oldest.routeCode]) {
      params.queue.shift();
      params.accumulators.droppedCalls += 1;
      const load = getCurrentLoad(params.runtime.curve, params.second, params.queue.length);
      const pressure = getPublicPressure(params.runtime, params.second, load);
      params.failures.push({
        atSecond: params.second,
        callId: oldest.id,
        routeCode: oldest.routeCode,
        subscriberClass: oldest.subscriberClass,
        billingMode: oldest.billingMode,
        urgency: oldest.urgency,
        queueDepth: params.queue.length,
        loadBand: loadBandForSimulationLoad(load),
        lineGroupId: null,
        lineId: null,
        reason: "dropped_on_hold",
        detail: `Hold time exceeded the ${DROP_THRESHOLDS[oldest.routeCode]}s tolerance for ${oldest.routeCode} traffic.`,
      });
      params.trace.push({
        atSecond: params.second,
        callId: oldest.id,
        routeCode: oldest.routeCode,
        subscriberClass: oldest.subscriberClass,
        billingMode: oldest.billingMode,
        urgency: oldest.urgency,
        queuedForSeconds,
        boardLoad: load,
        boardPressure: pressure,
        queueDepth: params.queue.length,
        selectedLineId: null,
        selectedLineGroupId: null,
        selectedLinePremium: false,
        selectedLineAvailable: false,
        outcome: "dropped",
        lineId: null,
        reason: "hold-threshold",
      });
      continue;
    }

    const idleExists = params.lines.some((line) => line.busyUntil <= params.second && line.faultUntil <= params.second);
    if (!idleExists) break;

    const result = await routeCall({
      call: oldest,
      second: params.second,
      attempt: oldest.attempt + 1,
      queuedForSeconds,
      lines: params.lines,
      runtime: params.runtime,
      queueDepth: params.queue.length,
      callsHandled: params.callsHandled,
      decide: params.decide,
      failures: params.failures,
      trace: params.trace,
      accumulators: params.accumulators,
    });

    if (!result.handled) {
      oldest.attempt += 1;
      break;
    }

    params.queue.shift();
    params.callsHandled += 1;
  }
}

export async function simulateExchange(params: {
  seed?: string;
  board?: BoardModel;
  mode: SimulationMode;
  decide: PolicyDecisionFn;
}): Promise<SimulationResult> {
  const board = params.board ?? createBoard(params.seed ?? "default-seed");
  const plan = createTraffic(board, params.mode);
  const lines: MutableLineState[] = board.lines.map((line) => ({
    line,
    busyUntil: 0,
    faultUntil: 0,
  }));
  const arrivalsBySecond = new Map<number, TrafficEvent[]>();
  const failures: FailureEvent[] = [];
  const trace: SimulationTraceEvent[] = [];
  const accumulators: RuntimeAccumulators = {
    connectedCalls: 0,
    droppedCalls: 0,
    totalHoldSeconds: 0,
    premiumUsageCount: 0,
    trunkMisuseCount: 0,
  };
  const runtime: RuntimeContext = {
    board,
    mode: params.mode,
    curve: createPressureCurve(board, params.mode),
    rng: createRng(`${board.seed}:${params.mode}:runtime`),
    premiumHeatByGroup: new Map(),
  };

  for (const event of plan) {
    const existing = arrivalsBySecond.get(event.atSecond) ?? [];
    existing.push(event);
    arrivalsBySecond.set(event.atSecond, existing);
  }

  const queue: QueueEntry[] = [];
  let callsHandled = 0;
  const horizon = (plan.at(-1)?.atSecond ?? 0) + GAME_BALANCE.runtimePenalties.postPlanHorizonSeconds;

  for (let second = 0; second <= horizon; second += 1) {
    decayPremiumHeat(runtime);
    for (const state of lines) {
      if (state.busyUntil <= second) state.busyUntil = 0;
      if (state.faultUntil <= second) state.faultUntil = 0;
    }

    for (const arrival of arrivalsBySecond.get(second) ?? []) {
      const handled = await routeCall({
        call: arrival,
        second,
        attempt: 1,
        queuedForSeconds: 0,
        lines,
        runtime,
        queueDepth: queue.length,
        callsHandled,
        decide: params.decide,
        failures,
        trace,
        accumulators,
      });
      if (!handled.handled) {
        queue.push({ ...arrival, arrivalAt: second, attempt: 1 });
      } else {
        callsHandled += 1;
      }
    }

    await drainQueue({
      second,
      queue,
      lines,
      runtime,
      decide: params.decide,
      failures,
      trace,
      accumulators,
      callsHandled,
    });
  }

  const metrics: SimulationMetrics = {
    connectedCalls: accumulators.connectedCalls,
    totalCalls: plan.length,
    droppedCalls: accumulators.droppedCalls,
    avgHoldSeconds: divideAndRound(accumulators.totalHoldSeconds, Math.max(plan.length, 1), 2),
    totalHoldSeconds: accumulators.totalHoldSeconds,
    premiumUsageCount: accumulators.premiumUsageCount,
    premiumUsageRate: divideAndRound(accumulators.premiumUsageCount, Math.max(plan.length, 1), 3),
    trunkMisuseCount: accumulators.trunkMisuseCount,
    efficiency: divideAndRound(accumulators.connectedCalls, Math.max(plan.length, 1), 4),
    hiddenScore: 0,
  };
  metrics.hiddenScore = Number(
    computeHiddenScore({
      connectedCalls: metrics.connectedCalls,
      totalCalls: metrics.totalCalls,
      droppedCalls: metrics.droppedCalls,
      totalHoldSeconds: metrics.totalHoldSeconds,
      trunkMisuseCount: metrics.trunkMisuseCount,
    }).toFixed(4),
  );

  return {
    metrics,
    title: getTitleForScore(metrics.hiddenScore),
    failures,
    trace,
  };
}

export type { SimulationResult };
