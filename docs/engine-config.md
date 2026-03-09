# Engine Configuration

This guide explains how the simulator is configured and how to tune it. It is written so that an AI agent (or a developer) can read benchmark output, identify a problem, and make an informed config change.

## Config File Map

| File | What it controls | Change frequency |
| --- | --- | --- |
| `src/core/engine/config/balance.ts` | All tunable gameplay knobs (`GAME_BALANCE`) | Regular |
| `src/core/engine/config/profiles.ts` | Switch mark/tag weights, family compatibility anchors | Rare |
| `src/core/engine/config/constants.ts` | Stable vocabulary, drop thresholds, title cutoffs, score weights | Very rare |

Related assembly files (read-only context, not usually edited for balance):

- `src/core/engine/board-generation.ts` — creates the hidden board from `GAME_BALANCE.boardGeneration`
- `src/core/engine/traffic-generation.ts` — generates calls from `GAME_BALANCE.trafficShape`
- `src/core/engine/observation-generation.ts` — builds observation history
- `src/core/engine/runtime.ts` — executes policies using `GAME_BALANCE.runtimePenalties`
- `src/core/engine/probe-summary.ts` — formats probe feedback
- `src/core/engine/report.ts` — generates final reports

## GAME_BALANCE Walkthrough

All tunable knobs live in `GAME_BALANCE` in `balance.ts`. Here is what each section controls.

### boardGeneration

Controls the shape of each generated board.

| Parameter | Current | What it does |
| --- | --- | --- |
| `minLines` | 24 | Minimum active lines per board |
| `lineVariance` | 5 | Random ± range on line count |
| `hiddenTraits.pressureCollapse` | base 0.52, spread 0.26 | How much lines degrade under pressure |
| `hiddenTraits.premiumFragility` | base 0.48, spread 0.28 | How much premium trunk reuse hurts |
| `hiddenTraits.historyReliability` | base 0.62, spread 0.24 | How trustworthy observation data is |
| `qualityOffset` | base 0, spread 0.09 | Per-line quality jitter |
| `loadSoftCap` | family-specific, e.g. district 0.58 | Load level where performance starts dropping |
| `loadSlope` | family-specific, e.g. district 0.72 | How steeply performance falls above soft cap |

**Benchmark impact**: These primarily affect the hiring-bar agent. Increasing `hiddenTraits` spread creates more variance across seeds. Reducing `loadSoftCap` values makes overloaded boards harder.

### visibleSignal

Controls how noisy or faithful the public signal (switch marks, tags) is.

| Parameter | Current | What it does |
| --- | --- | --- |
| `visibleNoise.base` | 0.225 | Probability of a misleading visible-family signal |
| `visibleNoise.spread` | 0.025 | Per-board jitter on noise rate |
| `compatibilityJitter` | base 0, spread 0.1 | Noise on family compatibility scores |
| `boardFamilyCountWeights` | {3: 0.34, 4: 0.42, 5: 0.24} | Distribution of hidden family counts |

**Benchmark impact**: This is the main difficulty knob for inference. Increasing `visibleNoise.base` makes it harder for agents to identify line families, lowering all agent scores. The baseline agent is most sensitive since it uses the simplest family classification.

**Key relationship**: The gap between the hiring-bar agent and the oracle measures inference difficulty. If the gap is small (<5 points), increase `visibleNoise.base`.

### trafficShape

Controls observation history, pressure curves, and call arrivals.

#### observations

| Parameter | Current | What it does |
| --- | --- | --- |
| `rowCount` | 4800 | Total observation rows in the evidence bundle |
| `seededNoiseRate` | 0.25 | Fraction of observations with seeded noise |
| `operatorGradeWeights` | senior 0.22, operator 0.53, trainee 0.25 | Grade distribution (trainees add noise) |
| `traineeAdversarial.outcomeFlipRate` | 0.28 | How often trainee outcomes are flipped |

**Benchmark impact**: `rowCount` is the data budget. Increasing it gives agents more data, typically raising hiring-bar by 2-5 points. Decreasing it makes inference harder. Increasing `traineeAdversarial.outcomeFlipRate` adds more noise to the data.

#### pressure

| Parameter | Current | What it does |
| --- | --- | --- |
| `durationByMode.fit` | 120s | Probe fit duration |
| `durationByMode.stress` | 120s | Probe stress duration |
| `durationByMode.final` | 420s | Final run duration |
| `baselineByMode.final` | 0.34 | Base pressure level for final runs |
| `burstHeight.final` | base 0.16, variance 0.12 | Height of pressure bursts in final |
| `burstCountByMode.final` | 6 | Number of pressure bursts in final |

**Benchmark impact**: Higher `baselineByMode.final` and `burstHeight` create more pressure spikes, lowering all agent scores. This is the "desk feels too brutal" knob.

#### arrivals

| Parameter | Current | What it does |
| --- | --- | --- |
| `countByMode.final` | 340 | Total calls in a final run |
| `priorityUrgencyChance` | 0.75 | Fraction of priority calls that are urgent |
| `intercityVerifiedChance` | 0.58 | Fraction of intercity calls that are verified (premium-eligible) |

### runtimePenalties

Controls how the routing law works during execution.

| Parameter | Current | What it does |
| --- | --- | --- |
| `loadPenaltyMultiplier` | 2.05 | Scales overload drop probability |
| `premiumMisusePenalty` | -0.08 | Penalty for sending non-eligible calls to premium trunks |
| `connectionBase` | 0.1 | Floor for connection probability |
| `connectionScoreFactor` | 0.9 | How much line quality affects connection chance |
| `queuePressureFactor` | 0.06 | How much queue depth hurts connection chance |
| `premiumHeat.decayPerSecond` | 0.05 | How fast premium trunk heat dissipates |
| `premiumHeat.misuseHeat` | 0.5 | Extra heat from non-eligible premium use |
| `suburbanLoadPenalty.loadThreshold` | 0.68 | Load above which suburban lines take a penalty |

**Benchmark impact**: `loadPenaltyMultiplier` is the strongest lever. Raising it from 2.05 to 2.5 makes overloaded lines drop more calls, typically lowering all agent scores by 3-8 points. Lowering `connectionScoreFactor` flattens the quality curve, making good routing decisions matter less.

### scoring

| Parameter | Current | What it does |
| --- | --- | --- |
| `deskConditionThresholds.steady` | 0.75 | Efficiency above which desk is "steady" in probe summaries |
| `deskConditionThresholds.strained` | 0.55 | Efficiency above which desk is "strained" (below = "overwhelmed") |

These affect probe summary labels but not the final score calculation.

**Score weights** (in `constants.ts`, rarely changed):

| Weight | Value |
| --- | --- |
| `connectRate` | 0.62 |
| `dropRate` | 0.2 |
| `holdRate` | 0.1 |
| `trunkDiscipline` | 0.08 |

**Title cutoffs** (in `constants.ts`): chief_operator >= 0.88, senior_operator >= 0.74, operator >= 0.58, trainee >= 0.42, off_the_board below.

## Safe Tuning Order

When making balance changes, work through these in order:

1. **`trafficShape`** first — if the desk feels too quiet or too brutal, adjust pressure baselines, burst counts, or call volumes.
2. **`visibleSignal`** second — if inference is too obvious or too opaque, adjust `visibleNoise.base` or `compatibilityJitter.spread`.
3. **`runtimePenalties`** third — only when the routing law itself feels wrong (e.g. premium trunks are too punishing or too forgiving).
4. **`scoring`** last — after the underlying gameplay feels right, adjust the desk condition labels.

## Tuning Workflow

1. Run `npm run agent:hiring-bar` to get the current baseline. Note average, median, min, max, variance.
2. Make **one** change in `balance.ts`.
3. Run `npm run agent:hiring-bar` again.
4. Compare all five statistics.
5. If the change moved the band in the right direction without increasing variance, commit.
6. If not, revert and try a different parameter.

Also run `npm run agent:baseline` to verify the snapshot agent stays in 25-35%. See [benchmarks.md](benchmarks.md) for the full benchmark suite.

## Common Tuning Recipes

### Game too easy (hiring-bar average > 88%)

Try these in order, one at a time:

1. Increase `visibleSignal.visibleNoise.base` from 0.225 toward 0.28 (makes family inference harder)
2. Reduce `trafficShape.observations.rowCount` from 4800 toward 4000 (less data for inference)
3. Increase `trafficShape.pressure.burstHeight.final.variance` from 0.12 toward 0.16 (more chaotic pressure)
4. Increase `runtimePenalties.loadPenaltyMultiplier` from 2.05 toward 2.3 (harsher overload)

### Game too hard (hiring-bar average < 70%)

Reverse the above:

1. Decrease `visibleSignal.visibleNoise.base` from 0.225 toward 0.19
2. Increase `trafficShape.observations.rowCount` from 4800 toward 5500
3. Decrease `trafficShape.pressure.baselineByMode.final` from 0.34 toward 0.28
4. Decrease `runtimePenalties.loadPenaltyMultiplier` from 2.05 toward 1.8

### Too much variance across seeds (variance > 0.015)

Reduce `spread` values in the jitter ranges that most affect the outlier seeds:

- `hiddenTraits.pressureCollapse.spread` (currently 0.26)
- `hiddenTraits.premiumFragility.spread` (currently 0.28)
- `trafficShape.pressure.burstHeight.final.variance` (currently 0.12)
- `visibleSignal.visibleNoise.spread` (currently 0.025)

### Baseline agent too strong (average > 40%)

The baseline uses only family classification and route bias — it doesn't analyze observations. If it's scoring too high, the visible signal is too transparent:

1. Increase `visibleSignal.visibleNoise.base` (main lever)
2. Increase `visibleSignal.compatibilityJitter.spread`

## Engine Config vs Agent Parameters

The engine config (`balance.ts`) and the agent script parameters (`DEFAULT_TRAITS`, `DEFAULT_TUNING` in `exchange-agent-runtimes.mjs`) are **separate tuning surfaces**:

- **Engine config** controls difficulty — how the simulator generates boards, traffic, and outcomes. Change this to adjust the game.
- **Agent parameters** control the benchmark agent's strategy — how it scores and selects lines. These should NOT be changed when tuning the engine. They represent a fixed reference policy.

Shift/session timing is also separate from engine config. Product timers live in `src/features/shift/domain/lifecycle.ts` (30s phase 1, 60s total shift).
