# Madison Exchange v3: Canonical Product Spec

## Executive Summary

Madison Exchange v3 is a compact routing challenge that rewards agent-driven analysis, local simulation, and parameter tuning across fresh boards. The game remains hard, but the difficulty now comes from modeling a small learnable hidden system instead of fighting irreducible opacity.

The challenge is staged as a 1963 Madison Avenue telephone exchange. The story remains part of the product, but the authoritative game surface is structured, measurable, and intentionally designed for iterative solving.

## Product Goals

Madison Exchange v3 should:
- remain a coding-heavy routing game
- preserve a single submitted routing policy
- reward tool building, local evaluation, and repeated experimentation
- stay legible enough that a human can form hypotheses
- remain hard enough that only strong agent workflows are consistently competitive

Madison Exchange v3 should not:
- depend on hidden-state leakage
- require repo access to solve well
- make the main difficulty missing live state
- collapse into a direct replay or lookup-table puzzle

## Canonical Player Flow

1. Player signs in with GitHub.
2. Player starts a fresh Shift.
3. The system issues the evidence bundle immediately.
4. Player analyzes the bundle locally and prepares a routing policy.
5. Player may run up to two probes on the active board.
6. Player tunes locally.
7. Player goes live for the final run.
8. The system publishes the final Shift Report.
9. A richer postmortem unlocks for that spent board only.

Repeated fresh Shifts are allowed and expected. Strong players should improve their tooling across boards.

## Public Contract

The player submits one JavaScript policy file.

The file may export:
- optional `init(context)`
- required `connect(input)`

`init(context)` runs once per probe or final run.
`connect(input)` runs once per routing decision.
The runtime is stateful within a run and resets between runs.

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
    queueDepth: number;
    callsHandled: number;
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

### Return value

```ts
type ConnectResult = { lineId: string | null };
```

### Public contract rules

- Returning `null` sends the call to hold.
- `board.load` is public because live pressure is part of the intended modeling loop.
- `lineGroupId` is public but is only a coarse visible grouping, not the hidden truth.
- Hidden family labels, exact success probabilities, and board seeds are never exposed.
- Policies run in a deterministic sandbox with no network, filesystem, or timers.

## Artifacts

Every Shift exposes exactly four live artifacts:
- `manual.md`
- `starter.js`
- `lines.json`
- `observations.jsonl`

### `manual.md`

`manual.md` is the themed briefing. It should remain literary and period-specific, but every important rule must also be stated plainly.

It must cover:
- the policy contract
- visible call and line fields
- load and queue semantics
- premium guidance
- probe descriptions
- what postmortems unlock after a board is spent

It may suggest useful hypotheses, but it must not reveal hidden formulas or exact routing answers.

### `starter.js`

`starter.js` is a valid but intentionally weak baseline.

Its purpose is:
- prove the contract
- give a starting point for editing
- remain clearly non-competitive

Balance target:
- average below `10%` on the benchmark suite

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

The visible metadata should correlate with hidden line behavior without perfectly revealing it.

### `observations.jsonl`

`observations.jsonl` is historical evidence drawn from the same model family, not the active board.

Each row includes:
- traffic regime label
- historical line alias
- historical line group
- call family fields
- coarse load band
- queue band
- operator action
- premium usage
- outcome bucket

This artifact should be large enough that hand inspection is weak and automated analysis is useful.

## Core Game Model

Madison Exchange v3 is built around one central question:

Which line groups handle which call families well, and how does that change as load rises?

### Hidden elements

Each line has:
- one hidden family from a set of three routing archetypes
- a small quality offset
- a load soft-cap or degradation threshold
- a premium boost if the line is premium
- visible-feature noise

Board variation changes:
- traffic mix
- relative prevalence of line families
- load profile over time
- density of premium-worthy calls

### Outcome law

Connection quality depends mainly on:
- call-family to hidden-family fit
- current public `board.load`
- whether the line is above its degradation threshold
- a small maintenance modifier
- premium usage on eligible calls

Faults should mostly emerge from low-margin routing under load. Faults are not a separate hidden mystery system.

### Premium rule

Premium should help a narrow, stable subset of traffic across all boards. Board profiles must not change premium mechanics themselves.

## Probes

Each Shift exposes exactly two probes:
- `fit`
- `stress`

### `fit`

Purpose:
- broad coverage under moderate load
- estimate line-family compatibility
- reveal obvious premium misuse

### `stress`

Purpose:
- exercise the policy under higher sustained load
- show where degradation thresholds are wrong
- test whether the policy fails gracefully

### Probe rules

- Probes run from a clean board state.
- Probes use the same hidden board law as final.
- Probe traffic differs from final traffic.
- Probes return structured aggregates, not full traces.

## Probe Feedback Schema

Each probe returns:
- overall metrics
- call-bucket table
- load-band table
- line-group table
- top failure buckets
- 5 to 8 incident notes in themed language

Probe output may include:
- connect rate
- drop rate
- average hold
- premium usage rate
- line-group usage and fault rate

Probe output must not include:
- exact per-line rankings
- full event traces
- hidden scores
- direct replacement hints

## Theme And Exploration

The 1963 exchange setting remains part of the product.

Theme is responsible for:
- atmosphere
- naming traffic regimes, probes, and reports
- suggesting which hypotheses are worth testing
- making the desk feel like a real operating environment

Theme is not responsible for:
- hiding core mechanics only in prose
- carrying unverifiable rules
- replacing structured feedback

Exploration should come from inferable ambiguity:
- which visible line motifs correlate with hidden routing families on this board
- where each line group begins to degrade
- when premium is worth the cost
- which heuristics transfer across boards

## Anti-Gameability Rules

Madison Exchange v3 must remain competitive and resistant to trivial replay.

Required protections:
- no public board seeds
- no reconstructible board state in browser payloads
- no client bundle access to board generators
- historical evidence teaches the model family, not the active board
- final traffic differs from probe traffic while staying in the same rule family
- richer board-specific telemetry unlocks only after the board is spent

## Benchmark And Balance Gates

Balance is enforced against a fixed benchmark seed suite.

Acceptance targets:
- shipped `starter.js`: below `10%` average
- snapshot baseline agent: roughly `25-35%`
- hiring-bar agent: roughly `75-85%`

These targets exist to ensure:
- the game is understandable but not trivial
- simple heuristics plateau early
- strong agent workflows clearly dominate

## Verification Requirements

The implementation should maintain four validation layers:

### Logical correctness
- hidden model math
- load degradation
- premium application
- probe aggregation
- policy contract validation

### Functional correctness
- Shift creation
- artifact delivery
- probe execution
- final scoring
- postmortem unlock behavior

### Security correctness
- no `seed` or reconstructible board state in client payloads
- sandbox isolation for policy execution

### Balance correctness
- benchmark suite reports average, median, min, max, and variance
- starter, snapshot, and hiring-bar agents stay within their target bands

## Non-Goals

Madison Exchange v3 does not aim to:
- preserve backward compatibility with the v2 API
- allow manual players to compete with a strong toolchain
- reveal the exact hidden model to players
- support one-shot board solving from browser payloads
