import type { BoardTempo, PolicyInput, RuntimeLineView, SimulationMetrics, Title } from "@/lib/contracts/game";
import { DROP_THRESHOLDS } from "./config/constants";
import { GAME_BALANCE } from "./config/balance";
import { createBoard, createPressureCurve, createTraffic } from "./board";
import { connectProbability } from "./routing-math";
import { computeHiddenScore, getTitleForScore } from "./scoring";
import { createRng, premiumEligible, type Rng, type SimulationMode } from "./shared";
import { loadBandForSimulationLoad } from "./simulation-shared";
import type { BoardModel, FailureEvent, LineModel, SimulationResult, SimulationTraceEvent, TrafficEvent } from "./types";

type MutableLineState = {
  line: LineModel;
  busyUntil: number;
  faultUntil: number;
};

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

function getCurrentLoad(board: BoardModel, mode: SimulationMode, second: number, queueDepth: number) {
  const curve = createPressureCurve(board, mode);
  const base = curve.points[Math.min(second, curve.points.length - 1)] ?? GAME_BALANCE.runtimePenalties.defaultCurveLoad;
  return Math.max(
    GAME_BALANCE.runtimePenalties.liveLoadClamp.min,
    Math.min(
      base + Math.min(queueDepth, GAME_BALANCE.runtimePenalties.queueLoadCap) * GAME_BALANCE.runtimePenalties.queueLoadFactorPerCall,
      GAME_BALANCE.runtimePenalties.liveLoadClamp.max,
    ),
  );
}

function getBoardTempo(board: BoardModel, mode: SimulationMode, second: number): BoardTempo {
  if (mode !== "final") return "steady";
  const lower = board.finalPhaseChange.shiftPoint - GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds;
  const upper = board.finalPhaseChange.shiftPoint + GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds;
  if (second < lower || second > upper) return "steady";
  return board.finalPhaseChange.loadDelta >= 0 ? "surging" : "cooling";
}

function getEffectiveSoftCap(board: BoardModel, mode: SimulationMode, second: number, line: LineModel) {
  if (mode !== "final" || second < board.finalPhaseChange.shiftPoint || line.family !== board.finalPhaseChange.shiftedFamily) {
    return line.loadSoftCap;
  }
  return Math.max(
    GAME_BALANCE.trafficShape.finalPhaseChange.effectiveSoftCapClamp.min,
    Math.min(
      line.loadSoftCap + board.finalPhaseChange.capDelta,
      GAME_BALANCE.trafficShape.finalPhaseChange.effectiveSoftCapClamp.max,
    ),
  );
}

function toRuntimeLineViews(lines: MutableLineState[], second: number): RuntimeLineView[] {
  return lines.map((state) => {
    const busySeconds = Math.max(0, Math.ceil(state.busyUntil - second));
    const faultSeconds = Math.max(0, Math.ceil(state.faultUntil - second));
    const status = faultSeconds > 0 ? "fault" : busySeconds > 0 ? "busy" : "idle";
    return {
      id: state.line.id,
      label: state.line.label,
      switchMark: state.line.switchMark,
      classTags: state.line.classTags,
      lineGroupId: state.line.lineGroupId,
      isPremiumTrunk: state.line.isPremiumTrunk,
      maintenanceBand: state.line.maintenanceBand,
      status,
      secondsUntilBusyClears: busySeconds,
      secondsUntilFaultClears: faultSeconds,
    };
  });
}

function getServiceDuration(call: Pick<TrafficEvent, "routeCode" | "urgency">, rng: Rng) {
  const base = GAME_BALANCE.runtimePenalties.serviceDurationBaseByRoute[call.routeCode];
  return (
    base +
    (call.urgency === "priority" ? GAME_BALANCE.runtimePenalties.urgencyServiceBonus : 0) +
    Math.floor(rng() * GAME_BALANCE.runtimePenalties.serviceDurationVariance)
  );
}

function idleNonPremiumExists(lines: MutableLineState[], second: number) {
  return lines.some((line) => !line.line.isPremiumTrunk && line.busyUntil <= second && line.faultUntil <= second);
}

async function routeCall(params: {
  call: TrafficEvent;
  second: number;
  attempt: number;
  queuedForSeconds: number;
  lines: MutableLineState[];
  board: BoardModel;
  mode: SimulationMode;
  rng: Rng;
  queueDepth: number;
  callsHandled: number;
  decide: PolicyDecisionFn;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
  accumulators: RuntimeAccumulators;
}) {
  const load = getCurrentLoad(params.board, params.mode, params.second, params.queueDepth);
  const tempo = getBoardTempo(params.board, params.mode, params.second);
  const curve = createPressureCurve(params.board, params.mode);
  const input: PolicyInput = {
    clock: {
      second: params.second,
      remainingSeconds: curve.duration - params.second,
    },
    board: {
      load,
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

  const effectiveSoftCap = getEffectiveSoftCap(params.board, params.mode, params.second, selected.line);
  const probability = connectProbability(selected.line, params.call, load, params.queuedForSeconds, effectiveSoftCap);
  if (params.rng() < probability) {
    selected.busyUntil = params.second + getServiceDuration(params.call, params.rng);
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
  board: BoardModel;
  mode: SimulationMode;
  rng: Rng;
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
      const load = getCurrentLoad(params.board, params.mode, params.second, params.queue.length);
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
      board: params.board,
      mode: params.mode,
      rng: params.rng,
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

/** Run a full probe or final against a board and submitted policy. */
export async function simulateExchange(params: {
  seed?: string;
  board?: BoardModel;
  mode: SimulationMode;
  decide: PolicyDecisionFn;
}): Promise<SimulationResult> {
  const board = params.board ?? createBoard(params.seed ?? "default-seed");
  const plan = createTraffic(board, params.mode);
  const lines = board.lines.map((line) => ({
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
  const rng = createRng(`${board.seed}:${params.mode}:runtime`);

  for (const event of plan) {
    const existing = arrivalsBySecond.get(event.atSecond) ?? [];
    existing.push(event);
    arrivalsBySecond.set(event.atSecond, existing);
  }

  const queue: QueueEntry[] = [];
  let callsHandled = 0;
  const horizon = (plan.at(-1)?.atSecond ?? 0) + GAME_BALANCE.runtimePenalties.postPlanHorizonSeconds;

  for (let second = 0; second <= horizon; second += 1) {
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
        board,
        mode: params.mode,
        rng,
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
      board,
      mode: params.mode,
      rng,
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
    avgHoldSeconds: Number((accumulators.totalHoldSeconds / Math.max(plan.length, 1)).toFixed(2)),
    totalHoldSeconds: accumulators.totalHoldSeconds,
    premiumUsageCount: accumulators.premiumUsageCount,
    premiumUsageRate: Number((accumulators.premiumUsageCount / Math.max(plan.length, 1)).toFixed(3)),
    trunkMisuseCount: accumulators.trunkMisuseCount,
    efficiency: Number((accumulators.connectedCalls / Math.max(plan.length, 1)).toFixed(4)),
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
