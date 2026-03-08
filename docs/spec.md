# Madison Exchange v3.2: Canonical Product Spec

## Executive Summary

Madison Exchange v3.2 is a routing challenge built to measure whether candidates can wield agents well: ingest messy evidence, fit a model, run probes, revise the model, and ship a better routing policy.

The game remains a 1963 Madison Avenue telephone exchange. The theme matters for product feel, but the authoritative surface is the runtime contract, artifact bundle, probe outputs, and deterministic simulator.

v3.2 replaces the old 3-family permutation puzzle with a broader but simpler hidden model:
- boards draw from `5` possible line families, with `3-5` active on any given board
- visible metadata remains suggestive but no longer solves the board
- observations now have visible quality tiers
- some boards keep history directionally useful but operationally incomplete until probed
- finals may include `0-3` partial shift events instead of one fixed phase change
- live `board.pressure` is public and meant to support adaptation

## Product Goals

Madison Exchange v3.2 should:
- remain a coding-heavy routing game with one submitted JavaScript policy
- reward local analysis, probe-feedback loops, and repeated experimentation
- give strong agent workflows room to improve across many boards
- make single-board solving depend on robust inference instead of permutation cracking
- keep the system deterministic and reviewable enough for benchmark-driven balance work

Madison Exchange v3.2 should not:
- collapse into a static visible-family lookup
- require hidden-state leakage to solve well
- punish players with arbitrary mid-run rule rewrites
- become so noisy that probes stop being corrective

## Canonical Player Flow

1. Player signs in with GitHub.
2. Player starts a fresh Shift.
3. The system issues the evidence bundle immediately.
4. Player analyzes locally and prepares a routing policy.
5. Player may run up to two probes on the active board.
6. Probe feedback reveals what the live room contradicted, especially under pressure, premium reuse, or late-room tempo.
7. Player revises locally, often by rewriting control logic rather than only re-ranking lines.
8. Player goes live for the final run.
9. The system publishes the final Shift Report.
10. A richer board-specific postmortem unlocks after the board is spent.

Repeated fresh Shifts are expected. The platform does not store cross-shift memory for the player. Cross-board learning is part of the challenge and must come from the candidate's own tooling.

## Public Contract

The player submits one JavaScript policy file.

Runtime constraints:
- submitted source must fit within the `16 KB` validation limit
- policies run in a deterministic QuickJS sandbox
- no network, filesystem, timers, or hidden board state are exposed

The file may export:
- optional `init(context)`
- required `connect(input)`

`init(context)` runs once per probe or final run.  
`connect(input)` runs once per routing decision.  
Runtime state persists within a run and resets between runs.

### Public `init(context)` shape

```ts
type InitContext = {
  shift: {
    durationSeconds: number;
    probeKind: "fit" | "stress" | "final";
  };
  board: {
    lineCount: number;
    premiumCount: number;
    lineGroups: Array<{
      groupId: string;
      label: string;
      lineIds: string[];
    }>;
  };
};
```

### Public `connect(input)` shape

```ts
type ConnectInput = {
  clock: {
    second: number;
    remainingSeconds: number;
  };
  board: {
    load: number;
    pressure: number;
    queueDepth: number;
    callsHandled: number;
    tempo: "steady" | "surging" | "cooling";
  };
  call: {
    id: string;
    routeCode: "local" | "intercity" | "relay" | "priority";
    subscriberClass: "residence" | "business" | "hotel" | "government";
    billingMode: "standard" | "verified" | "collect";
    urgency: "routine" | "priority";
    queuedForSeconds: number;
    attempt: number;
  };
  lines: Array<{
    id: string;
    label: string;
    switchMark: string;
    classTags: string[];
    lineGroupId: string;
    isPremiumTrunk: boolean;
    maintenanceBand: "steady" | "temperamental" | "recently_serviced";
    status: "idle" | "busy" | "fault";
    secondsUntilBusyClears: number;
    secondsUntilFaultClears: number;
  }>;
};
```

### Return Value

```ts
type ConnectResult = { lineId: string | null };
```

### Public Contract Rules

- Returning `null` keeps the caller on hold.
- `board.load` is public because load adaptation is part of the intended solve loop.
- `board.pressure` is public as a noisy continuous operating signal.
- `board.tempo` is public as a coarse shift warning during finals.
- `lineGroupId` is public but remains only a visible grouping, not hidden truth.
- Hidden active-family count, hidden family labels per line, exact compatibility values, final shift schedule, and board seed are never exposed.

## Artifacts

Every Shift exposes exactly four artifacts:
- `manual.md`
- `starter.js`
- `lines.json`
- `observations.jsonl`

### `manual.md`

`manual.md` is the themed briefing. It should stay literary and period-specific, but every important public rule must also be stated plainly.

It covers:
- the policy contract
- visible call and line fields
- load, pressure, and queue semantics
- premium guidance
- probe descriptions
- the existence of noisy historical records and changing room pace

It must not reveal hidden formulas, hidden families, or exact routing answers.

### `starter.js`

`starter.js` is a valid but intentionally weak baseline.

Its purpose is:
- prove the contract
- give the player something editable
- remain clearly non-competitive

Balance target:
- average below `10%` on the fixed benchmark suite

### `lines.json`

`lines.json` is the visible board inventory.

Each row includes:
- `id`
- `label`
- `switchMark`
- `classTags`
- `lineGroupId`
- `isPremiumTrunk`
- `maintenanceBand`

Visible metadata should correlate with hidden routing behavior without acting as a direct label recovery mechanism.

### `observations.jsonl`

`observations.jsonl` is historical evidence generated from the active board's hidden parameters.

Each row includes:
- traffic regime label
- visible operator grade
- historical line alias
- historical line group
- call fields
- load band
- pressure band
- queue band
- premium reuse band
- operator action
- outcome bucket

The dataset is intentionally useful but dirty:
- row count is fixed at `4800`
- about `25%` of rows are seeded noise chosen without any obvious periodic row pattern
- rows are split across visible operator grades: `senior`, `operator`, `trainee`
- trainee rows can adversarially flip borderline outcomes

The history should reward robust modeling, not naive pooling.

It is intentionally not a full answer key:
- some boards understate collapse that only appears in probe traffic
- some boards flatter premium usage before live heat makes it self-punishing
- some boards preserve the right visible clusters while still misleading transfer timing

## Core Game Model

Madison Exchange v3.2 is built around one central question:

Which visible line groups handle which call families well, how fast do they collapse under pressure, and how should the policy adapt when the desk changes shape mid-run?

### Hidden Elements

Each board has:
- `24-28` total lines
- `3-5` active hidden families sampled from:
  - `district`
  - `relay`
  - `trunk`
  - `exchange`
  - `suburban`
- one board profile from:
  - `switchboard`
  - `front-office`
  - `night-rush`
  - `civic-desk`
  - `commuter-belt`
  - `storm-watch`

Each line has:
- one hidden family
- a visible family presentation that may differ from the hidden family
- a quality offset
- a load soft cap
- a load slope
- a maintenance modifier
- a premium boost if the line is premium
- a full compatibility table with board-specific jitter

Each board also has hidden operating traits that are never exposed directly:
- pressure-collapse sensitivity
- premium fragility
- history reliability
- final-shift sensitivity
- tempo lag

### Family Design

The five families are intentionally overlapping rather than cleanly separable:
- `district`: strongest on ordinary local traffic
- `relay`: strongest on relay and collect-heavy traffic
- `trunk`: strongest on intercity and high-value priority traffic
- `exchange`: specialist for verified and priority-sensitive traffic, especially civic/government-like work, but fragile under sustained load
- `suburban`: balanced medium-load generalist, useful on routine mixed traffic but weaker as pressure and queueing rise

This overlap is intentional. Visible motifs should act as priors, not exact answers.

### Visible Signal Model

Boards no longer use the old 3-family derangement trick as the primary difficulty.

Current behavior:
- a board samples `3-5` active families
- hidden families are mapped to visible-family presentations over that active set
- the visible mapping is rotated away from identity when possible
- visible metadata then gets additional seeded noise

Current visible noise target:
- about `20-26%`, varying by board

The result should be:
- useful clustering by `switchMark`, `classTags`, and `lineGroupId`
- no reliable one-shot visible-family solve

### Board Profiles

Board profiles define stable traffic tendencies across shifts and are the main source of cross-board learning signal.

Profiles shape:
- route mix
- billing mix
- urgency mix
- active-family prevalence
- premium density
- likelihood of harder finals

Intended profile flavor:
- `switchboard`: local and routine heavy
- `front-office`: verified and intercity heavier
- `night-rush`: relay-heavy with denser queues
- `civic-desk`: priority and government-heavy, exchange appears more often
- `commuter-belt`: local and relay blend, suburban appears more often
- `storm-watch`: higher-pressure boards with harder final dynamics

Profiles should be statistically learnable across boards, but not announced directly in artifacts.

### Compatibility and Jitter

Each family has a stable base compatibility pattern, then each board jitters those values.

Current implementation:
- family-level board jitter up to roughly `±0.10`
- per-line jitter on top of that
- compatibility values clamped into the playable range

This keeps families recognizable while preventing a single universal family lookup table from solving every board.

## Outcome Law

Connection quality depends mainly on:
- call-family to hidden-family fit
- line quality and maintenance
- public live load
- the line's soft cap and load slope
- premium help or premium misuse
- call queue time

The scoring math still prioritizes:
- connect rate
- low drop rate
- low hold rate
- premium discipline

Faults should mostly emerge from low-margin routing under pressure. They are not meant to be an independent hidden puzzle.

## Premium Rule

Premium trunks are valuable but stateful.

Current behavior:
- premium lines get a per-line premium boost
- premium usage creates shared heat by line group
- heat decays smoothly over time
- repeated use lowers premium effectiveness
- ineligible premium use adds extra heat and an immediate penalty

This is intentionally simpler than the earlier experimental design:
- the shipped model is linear heat decay and penalty
- there is no hidden easter-egg bonus or secret civic scoring rule in v3.2

The intended result is:
- premium remains useful on the right traffic
- premium spam becomes self-punishing
- stateful policies beat static “always use premium” heuristics

Some boards now amplify premium heat more sharply than their artifacts initially suggest. The probe should be able to reveal that premium discipline, not just premium access, is the real control problem.

## Final Run Shifts

Finals now use partial shift events instead of one fixed mid-run phase change.

Current behavior:
- finals may contain `0-3` shift events
- each shift is one of:
  - `traffic_mix`
  - `cap_swing`
- shifts ramp in over a transition window instead of flipping instantly
- `board.tempo` exposes the transition window as `surging` or `cooling`
- `board.pressure` remains a noisy live indicator throughout the run

Important constraint:
- hidden family identities do not rotate mid-final
- only route mix and effective family capacity change

This keeps the world coherent while still rewarding online adaptation.

The `0`-shift case is still not a static board:
- pressure waves remain live
- bursts remain present
- premium state still matters

## Probes

Each Shift exposes exactly two probes:
- `fit`
- `stress`

### `fit`

Purpose:
- broad coverage under manageable load
- estimate compatibility and visible-group tendencies
- surface obvious premium misuse

Current shape:
- `180` seconds
- `110` calls
- baseline load around `0.22`

### `stress`

Purpose:
- expose collapse thresholds
- test queue handling and premium discipline
- show whether a policy fails gracefully under heavier load

Current shape:
- `180` seconds
- `110` calls
- baseline load around `0.44`

### Probe Rules

- Probes run from a clean board state.
- Probes use the same board, active families, and core scoring law as final.
- Probes do not reveal the final shift schedule.
- Probe traffic differs from final traffic while staying in the same rule family.
- Probe output is aggregated and themed, not a full event trace.
- Probe output should often reveal new operational truth that was only weakly implied by artifacts.

## Probe Feedback Schema

Each probe returns:
- overall metrics
- call-bucket table
- load-band table
- line-group table
- top failure buckets
- top `3` failure modes drawn from:
  - `collapse_under_pressure`
  - `premium_thrash`
  - `overholding`
  - `false_generalist`
  - `tempo_lag`
  - `misleading_history`
- a `modeConfidence` map
- one `transferWarning`:
  - `stable`
  - `stress_only`
  - `likely_final_shift_sensitive`
- `2` recommended diagnostic questions
- `5` chief operator notes
- `2` counterfactual notes
- `5-8` themed incident notes

Probe output may include:
- connect rate
- drop rate
- average hold
- premium usage rate
- line-group usage and fault rate
- grounded prose about what the books got wrong, what broke live, and whether that pattern is likely to transfer to final

Probe output must not include:
- exact per-line rankings
- full event traces
- hidden score
- exact thresholds
- policy family names
- direct replacement hints or patch recipes

Narrative rules:
- prose must be deterministic and derived from measured deltas or failure buckets
- at least `2` chief operator notes should imply that control logic needs to change
- recommended questions must stay diagnostic, not imperative
- counterfactual notes should explain what seemed true from artifacts/history but failed in the probe
- prose should help a strong user-side LLM choose a rewrite without mechanically dictating one

## Anti-Gameability Rules

Madison Exchange v3.2 should remain hard to trivialize.

Required protections:
- no public board seeds
- no client bundle access to hidden board generation
- no public leakage of active-family count or active families
- visible metadata must remain informative but insufficient
- observation history must be board-specific and noisy enough to require fresh analysis
- finals must reward adaptation to public live conditions rather than replaying a static probe ranking
- richer board-specific telemetry unlocks only after the board is spent

The main anti-shortcut move in v3.2 is structural:
- solving the board should require inference over hidden family count, noisy visible clusters, and pressure-sensitive behavior
- solving the board should often require a post-probe policy rewrite, not just a better first-pass ranker
- it should no longer collapse into brute-forcing a tiny visible-to-hidden permutation

The main anti-template-mining move is also structural:
- coarse policy-family classification should be useful but insufficient
- board-specific tuning after probe feedback must still matter
- knowing what kind of board this is should not be enough without reading what changed live

## Benchmark and Balance Gates

Balance is enforced against a fixed benchmark seed suite.

Current enforced gates:
- shipped `starter.js`: below `10%` average
- snapshot baseline: weak baseline, roughly `12-30%`
- old static heuristic: `58%` average or lower
- artifact-only hiring-bar agent: clearly above the static heuristic
- warm-start benchmark agent: should use priors without materially regressing against artifact-only

Current local benchmark snapshot for the simplified v3.2 build:
- `snapshot`: about `0.22`
- `old_heuristic`: about `0.54`
- `artifact_only`: about `0.71`
- `warm_start`: about `0.72`

Interpretation:
- the game is understandable but not trivial
- static heuristics still plateau well below the best artifact-driven solver
- the simplified warm-start path is an evaluation harness, not a dominant gameplay shortcut

Desired solver shape:
- artifacts support a reasonable first-pass policy
- the probe should create productive doubt on some boards
- the strongest workflows should parse the new prose evidence and regenerate policy logic before final

## Meta-Learning Evaluation

Production gameplay remains single-shift and stateless on the platform side.

The benchmark suite still evaluates a warm-start path because cross-board learning is part of the hiring signal.

Current benchmark split:
- artifact-only tier: only the current shift artifacts are available
- warm-start tier: compact prior-board summaries are allowed

Prior summaries are intentionally small and abstracted:
- profile posterior
- family-count posterior
- family bucket means
- collapse threshold estimates
- premium ROI summaries
- operator-grade reliability summaries

The goal is to test reusable learning infrastructure, not seed memorization.

## Balance Configuration

Simulator and balance constants live in the engine config layer:
- `src/lib/engine/config/balance.ts`
- `src/lib/engine/config/constants.ts`
- `src/lib/engine/config/profiles.ts`

Requirements:
- tuning should happen through named config values first
- major knobs should stay grouped by gameplay question rather than scattered literals
- public artifact schemas and policy input shapes should remain stable unless the spec is intentionally revised

Current implementation structure:
- board generation: `src/lib/engine/board-generation.ts`
- observation synthesis: `src/lib/engine/observation-generation.ts`
- runtime orchestration: `src/lib/engine/runtime.ts`
- runtime helpers: `src/lib/engine/runtime-helpers.ts`

## Verification Requirements

The implementation should maintain four validation layers.

### Logical correctness

- hidden family sampling over `3-5` active families
- visible family mapping and visible-noise application
- compatibility jitter
- hidden operating-trait generation and application
- premium heat and misuse penalties
- final shift application and `board.tempo`
- observation quality tiers and trainee outcome flips
- policy contract validation

### Functional correctness

- Shift creation
- artifact delivery
- probe execution
- final scoring
- postmortem unlock behavior

### Security correctness

- no `seed` or reconstructible board state in client payloads
- no leakage of `activeFamilies`, `visibleFamilyMap`, or `finalPhaseChanges`
- no leakage of exact shift points, targeted family caps, or operator-grade generation flags
- sandbox isolation for policy execution

### Balance correctness

- benchmark suite reports remain reviewable
- starter, snapshot, static heuristic, and artifact-driven agents stay separated
- observation grades remain filterable but not trivially separable
- probes remain predictive enough for a strong workflow to improve over repeated boards
- prose remains evidence-shaped and non-leaky
- probe-informed rewrites should outperform artifact-only first-pass policies on targeted board slices

## Non-Goals

Madison Exchange v3.2 does not aim to:
- preserve backward compatibility with older challenge internals
- let manual play compete with a strong toolchain
- reveal the exact hidden model to players
- make warm-start priors mandatory for strong single-board performance
- ship hidden scoring bonuses before balance is stable
