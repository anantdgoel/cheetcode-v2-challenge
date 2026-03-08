import type {
  ArtifactName,
  BillingMode,
  BoardCondition,
  BoardProfile,
  EvaluationKind,
  ExchangeCall,
  FailureEvent,
  FinalReport,
  GeneratedGameSnapshot,
  HiddenLineProfile,
  LeaderboardEntry,
  LineFamily,
  LiveLine,
  LoadBand,
  MaintenanceBand,
  ObservationRow,
  PolicyBoard,
  PolicyInput,
  PressureCurve,
  ProbeKind,
  ProbeSummary,
  QueueBand,
  RouteCode,
  ShiftArtifacts,
  SimulationMetrics,
  SimulationTraceEvent,
  SubscriberClass,
  Title,
  TrafficEvent,
  TrafficRegime,
  Urgency,
  VisibleLine,
} from "./types";

const ROUTE_CODES: RouteCode[] = ["local", "intercity", "relay", "priority"];
const BILLING_MODES: BillingMode[] = ["standard", "verified", "collect"];
const URGENCIES: Urgency[] = ["routine", "priority"];
const SUBSCRIBER_CLASSES: SubscriberClass[] = ["residence", "business", "hotel", "government"];
const BOARD_PROFILES: BoardProfile[] = ["switchboard", "front-office", "night-rush"];
const LINE_FAMILIES: LineFamily[] = ["district", "relay", "trunk"];
const PROBE_ORDER: ProbeKind[] = ["fit", "stress"];
const MAINTENANCE_BANDS: MaintenanceBand[] = ["steady", "temperamental", "recently_serviced"];

const GENERIC_LABELS = [
  "Cord Position",
  "Jack Frame",
  "Bay Terminal",
  "Patch Desk",
  "Operator Post",
  "Signal Desk",
] as const;

const SHARED_SWITCH_MARKS = ["D-4", "N-2", "L-5", "H-6", "T-1", "P-7", "B-3", "M-4", "C-9"] as const;
const SHARED_TAGS = [
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

const DROP_THRESHOLDS: Record<RouteCode, number> = {
  local: 16,
  intercity: 26,
  relay: 22,
  priority: 12,
};

const TITLE_THRESHOLDS: Array<{ title: Title; minScore: number }> = [
  { title: "chief_operator", minScore: 0.88 },
  { title: "senior_operator", minScore: 0.74 },
  { title: "operator", minScore: 0.58 },
  { title: "trainee", minScore: 0.42 },
  { title: "off_the_board", minScore: -1 },
];

const SCORE_WEIGHTS = {
  connectRate: 0.62,
  dropRate: 0.2,
  holdRate: 0.1,
  trunkDiscipline: 0.08,
};

const FAMILY_SWITCH_MARK_WEIGHTS: Record<LineFamily, Record<(typeof SHARED_SWITCH_MARKS)[number], number>> = {
  district: { "D-4": 8, "N-2": 7, "L-5": 3, "H-6": 2, "T-1": 2, "P-7": 2, "B-3": 4, "M-4": 2, "C-9": 4 },
  relay: { "D-4": 2, "N-2": 2, "L-5": 8, "H-6": 7, "T-1": 4, "P-7": 3, "B-3": 2, "M-4": 3, "C-9": 2 },
  trunk: { "D-4": 2, "N-2": 2, "L-5": 4, "H-6": 3, "T-1": 8, "P-7": 7, "B-3": 2, "M-4": 6, "C-9": 2 },
};

const FAMILY_TAG_WEIGHTS: Record<LineFamily, Record<(typeof SHARED_TAGS)[number], number>> = {
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
  },
};

const PROFILE_ROUTE_WEIGHTS: Record<BoardProfile, Record<RouteCode, number>> = {
  switchboard: { local: 0.36, intercity: 0.2, relay: 0.22, priority: 0.22 },
  "front-office": { local: 0.24, intercity: 0.28, relay: 0.2, priority: 0.28 },
  "night-rush": { local: 0.22, intercity: 0.24, relay: 0.3, priority: 0.24 },
};

const PROFILE_BILLING_WEIGHTS: Record<BoardProfile, Record<BillingMode, number>> = {
  switchboard: { standard: 0.54, verified: 0.24, collect: 0.22 },
  "front-office": { standard: 0.36, verified: 0.42, collect: 0.22 },
  "night-rush": { standard: 0.38, verified: 0.3, collect: 0.32 },
};

const PROFILE_URGENCY_WEIGHTS: Record<BoardProfile, Record<Urgency, number>> = {
  switchboard: { routine: 0.78, priority: 0.22 },
  "front-office": { routine: 0.64, priority: 0.36 },
  "night-rush": { routine: 0.68, priority: 0.32 },
};

const PROFILE_FAMILY_WEIGHTS: Record<BoardProfile, Record<LineFamily, number>> = {
  switchboard: { district: 0.48, relay: 0.28, trunk: 0.24 },
  "front-office": { district: 0.3, relay: 0.28, trunk: 0.42 },
  "night-rush": { district: 0.28, relay: 0.44, trunk: 0.28 },
};

const FAMILY_COMPATIBILITY_BASE: Record<LineFamily, Partial<Record<string, number>>> = {
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
};

type MutableLineState = {
  line: HiddenLineProfile;
  busyUntil: number;
  faultUntil: number;
};

type QueueEntry = TrafficEvent & {
  arrivalAt: number;
  attempt: number;
};

type PolicyDecisionFn = (input: PolicyInput) => Promise<{ lineId: string | null; error?: string }>;

export type SimulationResult = {
  metrics: SimulationMetrics;
  title: Title;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
};

type SimulationMode = ProbeKind | "final";

type Rng = () => number;

function clamp(value: number, min: number, max: number) {
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

function createRng(seed: string): Rng {
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

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function weightedPick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const total = (Object.values(weights) as number[]).reduce((sum, value) => sum + value, 0);
  let roll = rng() * total;
  for (const [key, value] of Object.entries(weights) as Array<[T, number]>) {
    roll -= value;
    if (roll <= 0) return key;
  }
  return Object.keys(weights)[0] as T;
}

function shuffle<T>(rng: Rng, items: T[]) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function jitter(rng: Rng, value: number, spread: number, min = 0, max = 1) {
  return clamp(value + (rng() * spread * 2 - spread), min, max);
}

function getProfile(seed: string) {
  return BOARD_PROFILES[Math.floor(createRng(`${seed}:profile`)() * BOARD_PROFILES.length)]!;
}

function buildLineGroupId(line: Pick<HiddenLineProfile, "switchMark" | "classTags" | "isPremiumTrunk">) {
  const [firstTag = "misc"] = line.classTags;
  return `${line.switchMark.toLowerCase()}-${firstTag.slice(0, 3)}${line.isPremiumTrunk ? "-p" : ""}`;
}

function buildCompatibility(rng: Rng, family: LineFamily) {
  const compatibility: Record<string, number> = {};
  for (const routeCode of ROUTE_CODES) {
    for (const billingMode of BILLING_MODES) {
      for (const urgency of URGENCIES) {
        const key = `${routeCode}|${billingMode}|${urgency}`;
        const baseline =
          FAMILY_COMPATIBILITY_BASE[family][key] ??
          (family === "district"
            ? routeCode === "local"
              ? billingMode === "standard"
                ? 0.9
                : 0.82
              : routeCode === "priority"
                ? 0.38
                : 0.26
            : family === "relay"
              ? routeCode === "relay"
                ? billingMode === "collect"
                  ? 0.88
                  : 0.82
                : routeCode === "priority"
                  ? 0.58
                  : 0.3
              : routeCode === "intercity"
                ? billingMode === "verified"
                  ? 0.94
                  : 0.78
                : routeCode === "priority"
                  ? urgency === "priority"
                    ? 0.9
                    : 0.76
                  : 0.24);
        compatibility[key] = jitter(rng, baseline, 0.04, 0.1, 0.99);
      }
    }
  }
  return compatibility;
}

function buildLines(seed: string, boardProfile: BoardProfile): HiddenLineProfile[] {
  const rng = createRng(`${seed}:lines`);
  const totalLines = 24 + Math.floor(rng() * 5);
  const premiumCount = boardProfile === "front-office" ? 6 : 5;
  const families = Array.from({ length: totalLines }, () => weightedPick(rng, PROFILE_FAMILY_WEIGHTS[boardProfile]));
  families[0] = "district";
  families[1] = "relay";
  families[2] = "trunk";

  return shuffle(rng, families).map((family, index) => {
    const switchMark = weightedPick(rng, FAMILY_SWITCH_MARK_WEIGHTS[family]);
    const tagWeights = FAMILY_TAG_WEIGHTS[family];
    const tags = shuffle(
      rng,
      Array.from(new Set([weightedPick(rng, tagWeights), weightedPick(rng, tagWeights), weightedPick(rng, tagWeights)])),
    ).slice(0, 3);
    const isPremiumTrunk = index >= totalLines - premiumCount;
    const line: HiddenLineProfile = {
      id: `line-${String(index + 1).padStart(2, "0")}`,
      label: `${pick(rng, GENERIC_LABELS)} ${String(index + 1).padStart(2, "0")}`,
      switchMark,
      classTags: tags,
      lineGroupId: "",
      isPremiumTrunk,
      maintenanceBand: pick(rng, MAINTENANCE_BANDS),
      historicalAlias: "",
      family,
      qualityOffset: jitter(rng, 0, 0.09, -0.14, 0.14),
      loadSoftCap: jitter(rng, family === "trunk" ? 0.78 : family === "relay" ? 0.66 : 0.58, 0.08, 0.34, 0.9),
      loadSlope: jitter(rng, family === "district" ? 0.72 : family === "relay" ? 0.54 : 0.42, 0.1, 0.2, 0.92),
      premiumBoost: isPremiumTrunk ? jitter(rng, 0.14, 0.07, 0.04, 0.3) : 0,
      maintenanceOffset: 0, // overridden below based on maintenanceBand
      compatibility: buildCompatibility(rng, family),
    };
    line.lineGroupId = buildLineGroupId(line);
    line.historicalAlias = `${line.switchMark.replace("-", "")}-${line.label.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X")}-${stableHash(`${seed}:${index}`).slice(0, 4)}`;
    line.maintenanceOffset =
      line.maintenanceBand === "recently_serviced"
        ? 0.06
        : line.maintenanceBand === "steady"
          ? 0.02
          : -0.05;
    return line;
  });
}

function buildPressureCurve(seed: string, kind: SimulationMode) {
  const rng = createRng(`${seed}:${kind}:curve`);
  const duration = kind === "final" ? 420 : 180;
  const baseline = kind === "fit" ? 0.22 : kind === "stress" ? 0.44 : 0.3;
  const points = Array.from({ length: duration + 1 }, (_, second) => {
    const wave = Math.sin(second / 18) * 0.06 + Math.cos(second / 11) * 0.04;
    return clamp(baseline + wave, 0.1, 0.95);
  });

  const burstCount = kind === "fit" ? 2 : kind === "stress" ? 4 : 5;
  for (let burst = 0; burst < burstCount; burst += 1) {
    const center = Math.floor(rng() * duration);
    const width = 10 + Math.floor(rng() * 20);
    const height = kind === "stress" ? 0.22 + rng() * 0.12 : 0.12 + rng() * 0.1;
    for (let second = Math.max(0, center - width); second <= Math.min(duration, center + width); second += 1) {
      const distance = Math.abs(second - center) / width;
      points[second] = clamp(points[second] + height * (1 - distance), 0.1, 0.98);
    }
  }
  return { duration, points };
}

function buildTrafficPlan(snapshot: GeneratedGameSnapshot, kind: SimulationMode): TrafficEvent[] {
  const rng = createRng(`${snapshot.seed}:${kind}:traffic`);
  const pressureCurve = kind === "final" ? snapshot.pressureCurveFinal : snapshot.probePressureCurves[kind];
  const duration = pressureCurve.duration;
  const count = kind === "final" ? 340 : 110;
  const routeWeights =
    kind === "fit"
      ? PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile]
      : kind === "stress"
        ? {
            local: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].local * 0.8,
            intercity: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].intercity * 1.15,
            relay: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].relay * 1.15,
            priority: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].priority * 1.15,
          }
        : {
            local: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].local * 0.92,
            intercity: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].intercity * 1.05,
            relay: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].relay * 1.04,
            priority: PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile].priority * 1.08,
          };
  const schedule: TrafficEvent[] = [];
  let second = 0;

  for (let index = 0; index < count; index += 1) {
    const load = pressureCurve.points[Math.min(second, duration)];
    const routeCode = weightedPick(rng, routeWeights);
    let billingMode = weightedPick(rng, PROFILE_BILLING_WEIGHTS[snapshot.boardProfile]);
    let urgency = weightedPick(rng, PROFILE_URGENCY_WEIGHTS[snapshot.boardProfile]);
    let subscriberClass = pick(rng, SUBSCRIBER_CLASSES);
    if (routeCode === "priority" && rng() > 0.25) urgency = "priority";
    if (routeCode === "intercity" && rng() > 0.42) billingMode = "verified";
    if (routeCode === "relay" && rng() > 0.4) subscriberClass = pick(rng, ["hotel", "government"]);

    schedule.push({
      id: `${kind}-call-${String(index + 1).padStart(3, "0")}`,
      atSecond: second,
      routeCode,
      subscriberClass,
      billingMode,
      urgency,
    });

    const spacingBase = duration / count;
    const loadPenalty = kind === "stress" ? 0.95 : 0.7;
    const gap = Math.max(0, Math.floor(spacingBase * (0.7 + rng() * 1.4 - load * loadPenalty)));
    second = Math.min(duration, second + gap);
  }

  return schedule.sort((left, right) => left.atSecond - right.atSecond);
}

function loadBandFor(value: number): LoadBand {
  if (value >= 0.8) return "peak";
  if (value >= 0.62) return "high";
  if (value >= 0.38) return "medium";
  return "low";
}

function queueBandFor(queueDepth: number): QueueBand {
  if (queueDepth >= 6) return "long";
  if (queueDepth >= 3) return "rising";
  return "short";
}

function trafficRegimeFor(index: number): TrafficRegime {
  const regimes: TrafficRegime[] = ["lunchtime", "closing_bell", "storm_hour", "late_quiet"];
  return regimes[index % regimes.length]!;
}

function premiumEligible(call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">) {
  return (
    (call.routeCode === "intercity" && call.billingMode === "verified") ||
    (call.routeCode === "priority" && call.urgency === "priority")
  );
}

function buildObservations(snapshot: GeneratedGameSnapshot) {
  const rng = createRng(`${snapshot.seed}:observations`);
  const rows: ObservationRow[] = [];
  for (let index = 0; index < 4800; index += 1) {
    const routeCode = weightedPick(rng, PROFILE_ROUTE_WEIGHTS[snapshot.boardProfile]);
    const billingMode = weightedPick(rng, PROFILE_BILLING_WEIGHTS[snapshot.boardProfile]);
    const urgency = weightedPick(rng, PROFILE_URGENCY_WEIGHTS[snapshot.boardProfile]);
    const subscriberClass = pick(rng, SUBSCRIBER_CLASSES);
    const loadBand = pick(rng, ["low", "medium", "high", "peak"] as const);
    const queueBand = pick(rng, ["short", "rising", "long"] as const);
    const familyWeights: Record<LineFamily, number> = {
      district: routeCode === "local" ? 1.2 : 0.5,
      relay: routeCode === "relay" || billingMode === "collect" ? 1 : 0.6,
      trunk: routeCode === "intercity" || urgency === "priority" ? 1.15 : 0.5,
    };
    const family = weightedPick(rng, familyWeights);
    const candidates = snapshot.lines.filter((line: HiddenLineProfile) => line.family === family);
    const selected = pick(rng, candidates.length ? candidates : snapshot.lines);
    const connectedChance =
      selected.compatibility[`${routeCode}|${billingMode}|${urgency}`] * 0.72 +
      selected.qualityOffset * 0.4 +
      selected.maintenanceOffset * 0.6 -
      (loadBand === "peak" ? (1 - selected.loadSoftCap) * 0.4 : loadBand === "high" ? (1 - selected.loadSoftCap) * 0.18 : 0);
    const usedPremium = selected.isPremiumTrunk;
    const resultRoll = clamp(connectedChance + (usedPremium && premiumEligible({ routeCode, billingMode, urgency }) ? 0.09 : 0), 0.04, 0.96);
    const result = rng() < resultRoll ? "connected" : rng() < 0.55 ? "held" : rng() < 0.7 ? "fault" : "dropped";

    rows.push({
      logId: `obs-${String(index + 1).padStart(5, "0")}`,
      shiftBucket: `bucket-${Math.floor(index / 24)}`,
      trafficRegime: trafficRegimeFor(index),
      historicalLineAlias: selected.historicalAlias,
      historicalLineGroup: selected.lineGroupId,
      call: { routeCode, subscriberClass, billingMode, urgency },
      context: {
        loadBand,
        queueBand,
        recentIncidentsNearLine: Math.floor(rng() * 4),
      },
      decision: {
        action: result === "held" ? "hold" : "route",
        usedPremium,
      },
      outcome: {
        result,
        ...(result === "held" || result === "dropped"
          ? { holdBand: queueBand === "short" ? "brief" : queueBand === "rising" ? "moderate" : "long" }
          : {}),
      },
    });
  }
  return rows;
}

export function buildGameSnapshot(seed: string): GeneratedGameSnapshot {
  const boardProfile = getProfile(seed);
  const lines = buildLines(seed, boardProfile);
  const snapshot: GeneratedGameSnapshot = {
    seed,
    boardProfile,
    lines,
    probePressureCurves: {
      fit: buildPressureCurve(seed, "fit"),
      stress: buildPressureCurve(seed, "stress"),
    },
    probeTrafficPlans: {
      fit: [],
      stress: [],
    },
    pressureCurveFinal: buildPressureCurve(seed, "final"),
    finalTrafficPlan: [],
    observations: [],
  };
  snapshot.probeTrafficPlans = {
    fit: buildTrafficPlan(snapshot, "fit"),
    stress: buildTrafficPlan(snapshot, "stress"),
  };
  snapshot.finalTrafficPlan = buildTrafficPlan(snapshot, "final");
  snapshot.observations = buildObservations(snapshot);
  return snapshot;
}

function stringifyLines(snapshot: GeneratedGameSnapshot) {
  return JSON.stringify(
    snapshot.lines.map<VisibleLine>(
      ({
        id,
        label,
        switchMark,
        classTags,
        lineGroupId,
        isPremiumTrunk,
        maintenanceBand,
      }: HiddenLineProfile) => ({
        id,
        label,
        switchMark,
        classTags,
        lineGroupId,
        isPremiumTrunk,
        maintenanceBand,
      }),
    ),
    null,
    2,
  );
}

function stringifyObservations(snapshot: GeneratedGameSnapshot) {
  return snapshot.observations.map((row: ObservationRow) => JSON.stringify(row)).join("\n");
}

function buildManual(snapshot: GeneratedGameSnapshot) {
  const lineGroups = Array.from(
    new Set(snapshot.lines.map((line: HiddenLineProfile) => line.lineGroupId)),
  ).length;
  return `# Madison Exchange — Operator Manual

The room opens hot and crowded, with the old Madison Avenue board humming
like it remembers every bad decision made on it. Your job is not to guess.
It is to build a disciplined routing policy and keep your head when the load rises.

## 1. Submission Contract

Submit one JavaScript policy file.

The runtime calls:

    init(context)      // optional, once per run
    connect(input)     // required, once per decision

\`connect(input)\` must return:

    { lineId: string | null }

Returning \`null\` keeps the caller on hold.
State persists within a probe or final run and resets between runs.

## 2. What Matters

- Different line groups carry different traffic families well.
- Some lines hold up under rising load; others go soft.
- Premium trunks help only in a narrow set of cases.
- The same board law governs both probes and final.

## 3. Live Runtime

Every decision includes:

- \`clock.second\`
- \`clock.remainingSeconds\`
- \`board.load\` from 0 to 1
- \`board.queueDepth\`
- \`call\`
- \`lines\`

Every visible line includes:

- \`id\`
- \`label\`
- \`switchMark\`
- \`classTags\`
- \`lineGroupId\`
- \`isPremiumTrunk\`
- \`maintenanceBand\`
- \`status\`
- \`secondsUntilBusyClears\`
- \`secondsUntilFaultClears\`

## 4. Desk Notes

The room tells on itself if you listen:

- Similar markings often travel together, but never perfectly.
- Some groups carry cleanly until the lamps stack up, then fail fast.
- Premium habit is not premium judgment.
- Verified intercity and true priority work are where the expensive room usually earns its keep.

## 5. Evidence

- \`manual.md\`: this briefing
- \`starter.js\`: a weak but valid baseline
- \`lines.json\`: the live board inventory
- \`observations.jsonl\`: old nights, same world, not the same exact board

The history is useful because it teaches the family resemblance of the board.
It is not a direct answer key.

## 6. Probes

Two live probes are available:

- \`fit\`: broad daytime coverage at manageable load
- \`stress\`: denser traffic to expose collapse thresholds

Probe output is structured on purpose. Use it to tune your model, not to search for one magic replacement line.

## 7. Scoring

Connections matter most.
Drops hurt.
Excessive holding hurts.
Wasting premium trunks hurts.

You are judged in public on Board Efficiency. The full score remains private.

## 8. The Room

There are ${snapshot.lines.length} live lines on this board, spread across ${lineGroups} visible groups.
The board will not explain itself. It will, however, repeat its habits if you watch closely enough.
`;
}

export function buildStarterPolicy() {
  return `function connect(input) {
  const idle = input.lines.filter((line) => line.status === "idle");
  if (!idle.length) return { lineId: null };

  const firstPremium = idle.find((line) => line.isPremiumTrunk);
  if (input.call.routeCode === "priority") {
    return { lineId: firstPremium ? firstPremium.id : idle[0].id };
  }

  return { lineId: null };
}`;
}

export function buildShiftArtifacts(seedOrSnapshot: string | GeneratedGameSnapshot): ShiftArtifacts {
  const gameSnapshot = typeof seedOrSnapshot === "string" ? buildGameSnapshot(seedOrSnapshot) : seedOrSnapshot;
  return {
    gameSnapshot,
    manualMd: buildManual(gameSnapshot),
    starterJs: buildStarterPolicy(),
    linesJson: stringifyLines(gameSnapshot),
    observationsJsonl: stringifyObservations(gameSnapshot),
  };
}

export function buildArtifactContent(
  name: ArtifactName,
  seedOrSnapshot: string | GeneratedGameSnapshot,
): { content: string } {
  const gameSnapshot =
    typeof seedOrSnapshot === "string" ? buildGameSnapshot(seedOrSnapshot) : seedOrSnapshot;

  if (name === "manual.md") {
    return { content: buildManual(gameSnapshot) };
  }
  if (name === "starter.js") {
    return { content: buildStarterPolicy() };
  }
  if (name === "lines.json") {
    return { content: stringifyLines(gameSnapshot) };
  }
  return { content: stringifyObservations(gameSnapshot) };
}

export function bundleHashesFromArtifacts(artifacts: ShiftArtifacts) {
  return {
    manualMd: stableHash(artifacts.manualMd),
    starterJs: stableHash(artifacts.starterJs),
    linesJson: stableHash(artifacts.linesJson),
    observationsJsonl: stableHash(artifacts.observationsJsonl),
  };
}

function getCurrentLoad(snapshot: GeneratedGameSnapshot, mode: SimulationMode, second: number, queueDepth: number) {
  const curve = mode === "final" ? snapshot.pressureCurveFinal : snapshot.probePressureCurves[mode];
  const base = curve.points[Math.min(second, curve.points.length - 1)] ?? 0.4;
  return clamp(base + Math.min(queueDepth, 8) * 0.02, 0, 1);
}

function getCallKey(call: Pick<TrafficEvent, "routeCode" | "billingMode" | "urgency">) {
  return `${call.routeCode}|${call.billingMode}|${call.urgency}`;
}

function toLiveLines(lines: MutableLineState[], second: number): LiveLine[] {
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
  const base = call.routeCode === "local" ? 4 : call.routeCode === "relay" ? 6 : call.routeCode === "intercity" ? 8 : 5;
  return base + (call.urgency === "priority" ? 1 : 0) + Math.floor(rng() * 4);
}

function lineScore(line: HiddenLineProfile, call: TrafficEvent, load: number) {
  const compatibility = line.compatibility[getCallKey(call)] ?? 0.4;
  const loadPenalty = load <= line.loadSoftCap ? 0 : (load - line.loadSoftCap) * (line.loadSlope * 1.8);
  const premiumValue = line.isPremiumTrunk && premiumEligible(call) ? line.premiumBoost : line.isPremiumTrunk ? -0.08 : 0;
  const subscriberBias =
    call.subscriberClass === "government" && line.family === "relay"
      ? 0.03
      : call.subscriberClass === "business" && line.family === "trunk"
        ? 0.03
        : 0;
  return compatibility + line.qualityOffset + line.maintenanceOffset + premiumValue + subscriberBias - loadPenalty;
}

function connectProbability(line: HiddenLineProfile, call: TrafficEvent, load: number, queuedForSeconds: number) {
  const score = lineScore(line, call, load);
  const queuePressure = clamp(queuedForSeconds / DROP_THRESHOLDS[call.routeCode], 0, 1);
  return clamp(0.1 + score * 0.9 + queuePressure * 0.06, 0.03, 0.99);
}

function getHoldRate(totalHoldSeconds: number, totalCalls: number) {
  if (!totalCalls) return 0;
  return clamp(totalHoldSeconds / (totalCalls * 16), 0, 1);
}

export function computeHiddenScore(params: {
  connectedCalls: number;
  totalCalls: number;
  droppedCalls: number;
  totalHoldSeconds: number;
  trunkMisuseCount: number;
}) {
  const totalCalls = Math.max(params.totalCalls, 1);
  const connectRate = params.connectedCalls / totalCalls;
  const dropRate = params.droppedCalls / totalCalls;
  const holdRate = getHoldRate(params.totalHoldSeconds, totalCalls);
  const trunkDiscipline = 1 - params.trunkMisuseCount / totalCalls;
  return clamp(
    connectRate * SCORE_WEIGHTS.connectRate +
      (1 - dropRate) * SCORE_WEIGHTS.dropRate +
      (1 - holdRate) * SCORE_WEIGHTS.holdRate +
      trunkDiscipline * SCORE_WEIGHTS.trunkDiscipline,
    0,
    1,
  );
}

export function getTitleForScore(score: number): Title {
  return TITLE_THRESHOLDS.find((entry) => score > entry.minScore)?.title ?? "off_the_board";
}

function describeIncident(event: FailureEvent) {
  return `${event.reason.replace(/_/g, " ")}: ${event.routeCode}/${event.billingMode}/${event.urgency} at ${event.atSecond}s${event.lineId ? ` on ${event.lineId}` : ""}. ${event.detail}`;
}

function dominantFailure(events: FailureEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const bucket = `${event.routeCode}|${event.billingMode}|${event.urgency}`;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
}

function dominantReason(events: FailureEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const value =
      event.reason === "dropped_on_hold"
        ? "hold_too_long"
        : event.reason === "low_margin_fault"
          ? "fault_under_load"
          : event.reason === "policy_hold"
            ? "low_margin_routing"
            : event.lineGroupId && event.reason === "invalid_line"
              ? "low_margin_routing"
              : event.reason === "busy_line"
                ? "low_margin_routing"
                : "premium_misuse";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "low_margin_routing";
}

function summarizeProbe(result: SimulationResult, mode: ProbeKind): ProbeSummary {
  const deskCondition: BoardCondition =
    result.metrics.hiddenScore >= 0.75 ? "steady" : result.metrics.hiddenScore >= 0.55 ? "strained" : "overrun";

  const callBuckets = new Map<string, { routeCode: RouteCode; billingMode: BillingMode; urgency: Urgency; attempts: number; connected: number; dropped: number; holdSeconds: number; premium: number }>();
  const loadBuckets = new Map<LoadBand, { attempts: number; connected: number; dropped: number; holdSeconds: number; premium: number }>();
  const lineGroups = new Map<string, { usageCount: number; connected: number; faults: number; premium: number }>();

  for (const event of result.trace) {
    const bucketId = `${event.routeCode}|${event.billingMode}|${event.urgency}`;
    const callBucket = callBuckets.get(bucketId) ?? {
      bucketId,
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

    const loadBand = loadBandFor(event.boardLoad);
    const loadBucket = loadBuckets.get(loadBand) ?? { attempts: 0, connected: 0, dropped: 0, holdSeconds: 0, premium: 0 };
    loadBucket.attempts += 1;
    if (event.outcome === "connected") loadBucket.connected += 1;
    if (event.outcome === "dropped" || event.outcome === "fault") loadBucket.dropped += 1;
    loadBucket.holdSeconds += event.queuedForSeconds;
    if (event.selectedLinePremium) loadBucket.premium += 1;
    loadBuckets.set(loadBand, loadBucket);

    if (event.selectedLineGroupId) {
      const group = lineGroups.get(event.selectedLineGroupId) ?? { usageCount: 0, connected: 0, faults: 0, premium: 0 };
      group.usageCount += 1;
      if (event.outcome === "connected") group.connected += 1;
      if (event.outcome === "fault") group.faults += 1;
      if (event.selectedLinePremium) group.premium += 1;
      lineGroups.set(event.selectedLineGroupId, group);
    }
  }

  const failureBuckets = dominantFailure(result.failures).map(([bucketId, count]) => {
    const events = result.failures.filter((event) => `${event.routeCode}|${event.billingMode}|${event.urgency}` === bucketId);
    return {
      bucketId,
      count,
      dominantReason: dominantReason(events) as ProbeSummary["failureBuckets"][number]["dominantReason"],
      confidence: Number(clamp(count / Math.max(result.metrics.totalCalls * 0.08, 1), 0.2, 0.99).toFixed(2)),
    };
  });

  return {
    probeKind: mode,
    deskCondition,
    metrics: {
      connectedCalls: result.metrics.connectedCalls,
      totalCalls: result.metrics.totalCalls,
      droppedCalls: result.metrics.droppedCalls,
      avgHoldSeconds: result.metrics.avgHoldSeconds,
      premiumUsageRate: result.metrics.premiumUsageRate,
      efficiency: result.metrics.efficiency,
    },
    callBucketTable: [...callBuckets.entries()]
      .map(([bucketId, row]) => ({
        bucketId,
        routeCode: row.routeCode,
        billingMode: row.billingMode,
        urgency: row.urgency,
        attempts: row.attempts,
        connectRate: Number((row.connected / Math.max(row.attempts, 1)).toFixed(3)),
        dropRate: Number((row.dropped / Math.max(row.attempts, 1)).toFixed(3)),
        avgHoldSeconds: Number((row.holdSeconds / Math.max(row.attempts, 1)).toFixed(2)),
        premiumUsageRate: Number((row.premium / Math.max(row.attempts, 1)).toFixed(3)),
      }))
      .sort((left, right) => right.attempts - left.attempts),
    loadBandTable: (["low", "medium", "high", "peak"] as LoadBand[]).map((loadBand) => {
      const row = loadBuckets.get(loadBand) ?? { attempts: 0, connected: 0, dropped: 0, holdSeconds: 0, premium: 0 };
      return {
        loadBand,
        bucketId: loadBand,
        attempts: row.attempts,
        connectRate: Number((row.connected / Math.max(row.attempts, 1)).toFixed(3)),
        dropRate: Number((row.dropped / Math.max(row.attempts, 1)).toFixed(3)),
        avgHoldSeconds: Number((row.holdSeconds / Math.max(row.attempts, 1)).toFixed(2)),
        premiumUsageRate: Number((row.premium / Math.max(row.attempts, 1)).toFixed(3)),
      };
    }),
    lineGroupTable: [...lineGroups.entries()]
      .map(([lineGroupId, row]) => ({
        lineGroupId,
        usageCount: row.usageCount,
        connectRate: Number((row.connected / Math.max(row.usageCount, 1)).toFixed(3)),
        faultRate: Number((row.faults / Math.max(row.usageCount, 1)).toFixed(3)),
        premiumUsageRate: Number((row.premium / Math.max(row.usageCount, 1)).toFixed(3)),
      }))
      .sort((left, right) => right.usageCount - left.usageCount),
    failureBuckets,
    incidents: result.failures.slice(0, 8).map((event) => ({
      second: event.atSecond,
      note: describeIncident(event),
    })),
  };
}

export { summarizeProbe };

function idleNonPremiumExists(lines: MutableLineState[], second: number) {
  return lines.some((line) => !line.line.isPremiumTrunk && line.busyUntil <= second && line.faultUntil <= second);
}

async function routeCall(params: {
  call: TrafficEvent;
  second: number;
  attempt: number;
  queuedForSeconds: number;
  lines: MutableLineState[];
  snapshot: GeneratedGameSnapshot;
  mode: SimulationMode;
  rng: Rng;
  queueDepth: number;
  callsHandled: number;
  decide: PolicyDecisionFn;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
  accumulators: {
    connectedCalls: number;
    droppedCalls: number;
    totalHoldSeconds: number;
    premiumUsageCount: number;
    trunkMisuseCount: number;
  };
}) {
  const load = getCurrentLoad(params.snapshot, params.mode, params.second, params.queueDepth);
  const input: PolicyInput = {
    clock: {
      second: params.second,
      remainingSeconds:
        (params.mode === "final" ? params.snapshot.pressureCurveFinal.duration : params.snapshot.probePressureCurves[params.mode].duration) -
        params.second,
    },
    board: {
      load,
      queueDepth: params.queueDepth,
      callsHandled: params.callsHandled,
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
    lines: toLiveLines(params.lines, params.second),
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
      loadBand: loadBandFor(load),
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
      loadBand: loadBandFor(load),
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
      loadBand: loadBandFor(load),
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
      loadBand: loadBandFor(load),
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

  const probability = connectProbability(selected.line, params.call, load, params.queuedForSeconds);
  if (params.rng() < probability) {
    selected.busyUntil = params.second + getServiceDuration(params.call, params.rng);
    selected.faultUntil = 0;
    params.accumulators.connectedCalls += 1;
    pushTrace("connected", selected.line.id, "connected", true);
    return { handled: true };
  }

  params.accumulators.droppedCalls += 1;
  selected.busyUntil = 0;
  selected.faultUntil = params.second + 4 + Math.floor((1 + load) * 5);
  params.failures.push({
    atSecond: params.second,
    callId: params.call.id,
    routeCode: params.call.routeCode,
    subscriberClass: params.call.subscriberClass,
    billingMode: params.call.billingMode,
    urgency: params.call.urgency,
    queueDepth: params.queueDepth,
    loadBand: loadBandFor(load),
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
  snapshot: GeneratedGameSnapshot;
  mode: SimulationMode;
  rng: Rng;
  decide: PolicyDecisionFn;
  failures: FailureEvent[];
  trace: SimulationTraceEvent[];
  accumulators: {
    connectedCalls: number;
    droppedCalls: number;
    totalHoldSeconds: number;
    premiumUsageCount: number;
    trunkMisuseCount: number;
  };
  callsHandled: number;
}) {
  while (params.queue.length) {
    const oldest = params.queue[0]!;
    const queuedForSeconds = params.second - oldest.arrivalAt;
    if (queuedForSeconds >= DROP_THRESHOLDS[oldest.routeCode]) {
      params.queue.shift();
      params.accumulators.droppedCalls += 1;
      const load = getCurrentLoad(params.snapshot, params.mode, params.second, params.queue.length);
      params.failures.push({
        atSecond: params.second,
        callId: oldest.id,
        routeCode: oldest.routeCode,
        subscriberClass: oldest.subscriberClass,
        billingMode: oldest.billingMode,
        urgency: oldest.urgency,
        queueDepth: params.queue.length,
        loadBand: loadBandFor(load),
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
      snapshot: params.snapshot,
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

export async function simulateExchange(params: {
  seed?: string;
  gameSnapshot?: GeneratedGameSnapshot;
  mode: SimulationMode;
  decide: PolicyDecisionFn;
}): Promise<SimulationResult> {
  const snapshot = params.gameSnapshot ?? buildGameSnapshot(params.seed ?? "default-seed");
  const plan = params.mode === "final" ? snapshot.finalTrafficPlan : snapshot.probeTrafficPlans[params.mode];
  const lines = snapshot.lines.map<MutableLineState>((line: HiddenLineProfile) => ({
    line,
    busyUntil: 0,
    faultUntil: 0,
  }));
  const arrivalsBySecond = new Map<number, TrafficEvent[]>();
  const failures: FailureEvent[] = [];
  const trace: SimulationTraceEvent[] = [];
  const accumulators = {
    connectedCalls: 0,
    droppedCalls: 0,
    totalHoldSeconds: 0,
    premiumUsageCount: 0,
    trunkMisuseCount: 0,
  };
  const rng = createRng(`${snapshot.seed}:${params.mode}:runtime`);

  for (const event of plan) {
    const existing = arrivalsBySecond.get(event.atSecond) ?? [];
    existing.push(event);
    arrivalsBySecond.set(event.atSecond, existing);
  }

  const queue: QueueEntry[] = [];
  let callsHandled = 0;
  const horizon = (plan.at(-1)?.atSecond ?? 0) + 90;

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
        snapshot,
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
      snapshot,
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

function buildChiefOperatorNote(title: Title, metrics: SimulationMetrics, seed: string) {
  const rng = createRng(`${seed}:${title}:${metrics.hiddenScore}`);
  const notes: Record<Title, string[]> = {
    chief_operator: [
      "The room stayed under your hand, even when the lamps climbed and the trunks started to look tempting.",
      "A clean, cold shift. You made the board feel smaller than it is.",
    ],
    senior_operator: [
      "Strong deskwork. A few hot minutes, but the room mostly obeyed.",
      "The board strained, not you.",
    ],
    operator: [
      "A working shift. Not elegant, but the city kept talking.",
      "Useful judgment, though the queue got the better of you more than once.",
    ],
    trainee: [
      "There were moments of discipline, surrounded by a lot of nervous reaching.",
      "The room cleared eventually. That is not the same as commanding it.",
    ],
    off_the_board: [
      "Madison Avenue has seen rougher nights, but not many with this many self-inflicted wounds.",
      "The lamps were trying to teach you something. You did not quite listen in time.",
    ],
  };
  const options = notes[title];
  return options[Math.floor(rng() * options.length)]!;
}

export function buildReport(params: {
  shiftId: string;
  github: string;
  publicId: string;
  achievedAt: number;
  kind: Exclude<EvaluationKind, ProbeKind>;
  metrics: SimulationMetrics;
  seed: string;
}): FinalReport {
  const title = getTitleForScore(params.metrics.hiddenScore);
  return {
    publicId: params.publicId,
    shiftId: params.shiftId,
    github: params.github,
    title,
    boardEfficiency: params.metrics.efficiency,
    connectedCalls: params.metrics.connectedCalls,
    totalCalls: params.metrics.totalCalls,
    droppedCalls: params.metrics.droppedCalls,
    avgHoldSeconds: params.metrics.avgHoldSeconds,
    premiumTrunkUsage: params.metrics.premiumUsageCount,
    chiefOperatorNote: buildChiefOperatorNote(title, params.metrics, params.seed),
    achievedAt: params.achievedAt,
    hiddenScore: params.metrics.hiddenScore,
    kind: params.kind,
  };
}

export function formatTitle(title: Title) {
  return title.replace(/_/g, " ").replace(/\b\w/g, (match: string) => match.toUpperCase());
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function presentLeaderboardEntry(entry: LeaderboardEntry) {
  return {
    ...entry,
    displayEfficiency: formatPercent(entry.boardEfficiency),
    displayTitle: formatTitle(entry.title),
  };
}
