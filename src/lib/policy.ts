import { getQuickJS, type QuickJSContext, type QuickJSWASMModule } from "quickjs-emscripten";
import {
  buildReport,
  buildGameSnapshot,
  summarizeProbe,
  type SimulationResult,
  simulateExchange,
  stableHash,
} from "@/lib/exchange";
import type {
  FinalReport,
  GeneratedGameSnapshot,
  PolicyInitContext,
  PolicyInput,
  PolicyValidationResult,
  ProbeKind,
  ProbeSummary,
} from "@/lib/types";
import { validateDraftSource } from "@/lib/validation";

let quickJsModule: Promise<QuickJSWASMModule> | null = null;

function getQuickJsModule() {
  if (!quickJsModule) {
    quickJsModule = getQuickJS();
  }
  return quickJsModule;
}

function primeContext(vm: QuickJSContext) {
  const anyVm = vm as unknown as {
    setMemoryLimit?: (limit: number) => void;
    setMaxStackSize?: (size: number) => void;
  };
  anyVm.setMemoryLimit?.(24 * 1024 * 1024);
  anyVm.setMaxStackSize?.(1024 * 1024);

  const setup = vm.evalCode(`
    globalThis.console = { log(){}, warn(){}, error(){}, info(){} };
  `);

  if ("error" in setup) {
    const error = vm.dump(setup.error) ?? "QuickJS setup failed";
    setup.error.dispose();
    throw new Error(String(error));
  }

  setup.value.dispose();
}

function hasRejectedLoopPattern(source: string) {
  return /while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\)|do\s*\{/.test(source);
}

async function evaluatePolicyShape(source: string) {
  const qjs = await getQuickJsModule();
  const vm = qjs.newContext();

  try {
    primeContext(vm);
    const compiled = vm.evalCode(`
      ${source}
      if (typeof connect !== "function") {
        throw new Error("Submitted draft must define a top-level connect(input) function.");
      }
      if (typeof init !== "undefined" && typeof init !== "function") {
        throw new Error("init, if present, must be a function.");
      }
      globalThis.__draft__ = connect;
    `);
    if ("error" in compiled) {
      const error = vm.dump(compiled.error) ?? "Failed to compile operator policy.";
      compiled.error.dispose();
      return { ok: false as const, error: String(error) };
    }
    compiled.value.dispose();

    const sampleInput: PolicyInput = {
      clock: { second: 3, remainingSeconds: 177 },
      board: { load: 0.42, queueDepth: 2, callsHandled: 9 },
      call: {
        id: "shape-call",
        routeCode: "local",
        subscriberClass: "business",
        billingMode: "standard",
        urgency: "routine",
        queuedForSeconds: 0,
        attempt: 1,
      },
      lines: [
        {
          id: "line-01",
          label: "Patch Desk 01",
          switchMark: "D-4",
          classTags: ["borough", "meter"],
          lineGroupId: "d-4-bor",
          isPremiumTrunk: false,
          maintenanceBand: "steady",
          status: "idle",
          secondsUntilBusyClears: 0,
          secondsUntilFaultClears: 0,
        },
        {
          id: "line-02",
          label: "Signal Desk 02",
          switchMark: "P-7",
          classTags: ["continental", "trunk"],
          lineGroupId: "p-7-con-p",
          isPremiumTrunk: true,
          maintenanceBand: "recently_serviced",
          status: "busy",
          secondsUntilBusyClears: 5,
          secondsUntilFaultClears: 0,
        },
      ],
    };

    const sampleInitContext: PolicyInitContext = {
      shift: { durationSeconds: 180, probeKind: "fit" },
      board: {
        lineCount: 2,
        premiumCount: 1,
        lineGroups: [
          { groupId: "d-4-bor", label: "District cluster", lineIds: ["line-01"] },
          { groupId: "p-7-con-p", label: "Trunk cluster", lineIds: ["line-02"] },
        ],
      },
    };

    const invocation = vm.evalCode(`
      if (typeof init === "function") {
        init(${JSON.stringify(sampleInitContext)});
      }
      const __shapeResult__ = connect(${JSON.stringify(sampleInput)});
      if (
        typeof __shapeResult__ !== "object" ||
        __shapeResult__ === null ||
        !("lineId" in __shapeResult__) ||
        (__shapeResult__.lineId !== null && typeof __shapeResult__.lineId !== "string")
      ) {
        throw new Error("connect(input) must return { lineId: string | null }.");
      }
      if (
        typeof __shapeResult__.lineId === "string" &&
        !${JSON.stringify(sampleInput.lines.map((line) => line.id))}.includes(__shapeResult__.lineId)
      ) {
        throw new Error("Returned lineId is not present on the active board.");
      }
      JSON.stringify(__shapeResult__);
    `);

    if ("error" in invocation) {
      const error = vm.dump(invocation.error) ?? "Operator policy failed during shape check.";
      invocation.error.dispose();
      return { ok: false as const, error: String(error) };
    }

    invocation.value.dispose();
    return { ok: true as const };
  } finally {
    vm.dispose();
  }
}

export async function validatePolicy(source: string): Promise<PolicyValidationResult> {
  const draft = validateDraftSource(source);
  if (draft.ok === false) return draft;
  if (hasRejectedLoopPattern(draft.value)) {
    return { ok: false, error: "Obvious infinite loop patterns are rejected before evaluation." };
  }

  const shape = await evaluatePolicyShape(draft.value);
  if (shape.ok === false) return shape;

  return {
    ok: true,
    normalizedSource: draft.value,
    sourceHash: stableHash(draft.value),
  };
}

async function createPolicyRunner(params: {
  source: string;
  initContext: PolicyInitContext;
}) {
  const qjs = await getQuickJsModule();
  const vm = qjs.newContext();
  primeContext(vm);

  const compiled = vm.evalCode(`
    ${params.source}
    if (typeof connect !== "function") {
      throw new Error("connect is not defined");
    }
    globalThis.__connect__ = connect;
    globalThis.__init__ = typeof init === "function" ? init : null;
  `);

  if ("error" in compiled) {
    const dumped = vm.dump(compiled.error) ?? "Failed to compile policy";
    compiled.error.dispose();
    vm.dispose();
    throw new Error(String(dumped));
  }
  compiled.value.dispose();

  const initResult = vm.evalCode(`
    if (globalThis.__init__) {
      globalThis.__init__(${JSON.stringify(params.initContext)});
    }
    "ok";
  `);

  if ("error" in initResult) {
    const dumped = vm.dump(initResult.error) ?? "Policy init failed";
    initResult.error.dispose();
    vm.dispose();
    throw new Error(String(dumped));
  }
  initResult.value.dispose();

  return {
    async decide(input: PolicyInput) {
      const result = vm.evalCode(`
        JSON.stringify(globalThis.__connect__(${JSON.stringify(input)}));
      `);

      if ("error" in result) {
        const dumped = vm.dump(result.error) ?? "Decision execution failed";
        result.error.dispose();
        return { lineId: null, error: String(dumped) };
      }

      const dumped = vm.dump(result.value);
      result.value.dispose();
      const parsed = typeof dumped === "string" ? JSON.parse(dumped) : dumped;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("lineId" in parsed) ||
        (parsed.lineId !== null && typeof parsed.lineId !== "string")
      ) {
        return { lineId: null, error: "connect(input) must return { lineId: string | null }." };
      }
      return { lineId: parsed.lineId as string | null };
    },
    dispose() {
      vm.dispose();
    },
  };
}

async function executeRun(params: {
  source: string;
  gameSnapshot: GeneratedGameSnapshot;
  mode: ProbeKind | "final";
}) {
  const groups = Array.from(
    params.gameSnapshot.lines.reduce((acc, line) => {
      const entry = acc.get(line.lineGroupId) ?? {
        groupId: line.lineGroupId,
        label: `${line.switchMark} ${line.classTags[0] ?? "group"}`,
        lineIds: [] as string[],
      };
      entry.lineIds.push(line.id);
      acc.set(line.lineGroupId, entry);
      return acc;
    }, new Map<string, { groupId: string; label: string; lineIds: string[] }>()),
  ).map(([, value]) => value);

  const durationSeconds =
    params.mode === "final"
      ? params.gameSnapshot.pressureCurveFinal.duration
      : params.gameSnapshot.probePressureCurves[params.mode].duration;

  const runner = await createPolicyRunner({
    source: params.source,
    initContext: {
      shift: { durationSeconds, probeKind: params.mode },
      board: {
        lineCount: params.gameSnapshot.lines.length,
        premiumCount: params.gameSnapshot.lines.filter((line) => line.isPremiumTrunk).length,
        lineGroups: groups,
      },
    },
  });

  try {
    return await simulateExchange({
      gameSnapshot: params.gameSnapshot,
      mode: params.mode,
      decide: (input) => runner.decide(input),
    });
  } finally {
    runner.dispose();
  }
}

export async function runProbe(params: {
  source: string;
  probeKind: ProbeKind;
  seed?: string;
  gameSnapshot?: GeneratedGameSnapshot;
}): Promise<{ result: SimulationResult; summary: ProbeSummary }> {
  const gameSnapshot = params.gameSnapshot ?? buildGameSnapshot(params.seed ?? "default-seed");
  const result = await executeRun({
    source: params.source,
    mode: params.probeKind,
    gameSnapshot,
  });
  return { result, summary: summarizeProbe(result, params.probeKind) };
}

export async function runFinal(params: {
  source: string;
  seed?: string;
  gameSnapshot?: GeneratedGameSnapshot;
}): Promise<SimulationResult> {
  return executeRun({
    source: params.source,
    mode: "final",
    gameSnapshot: params.gameSnapshot ?? buildGameSnapshot(params.seed ?? "default-seed"),
  });
}

export function buildFinalReport(params: {
  shiftId: string;
  github: string;
  publicId: string;
  achievedAt: number;
  kind: "final" | "auto_final";
  metrics: SimulationResult["metrics"];
  seed: string;
}): FinalReport {
  return buildReport(params);
}
