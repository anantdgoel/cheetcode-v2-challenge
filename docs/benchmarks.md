# Agent Benchmarks

This guide explains how to run the benchmark suite, interpret results, and use them to validate simulator changes. All offline benchmarks are deterministic and require no infrastructure.

## Quick Reference

| Agent | Command | Target Band | Notes |
| --- | --- | --- | --- |
| Starter policy | `npm run test` (simulation.test.ts) | < 10% | Validates starter.js stays weak |
| Snapshot baseline | `npm run agent:baseline` | 25-35% | Mid-tier offline reference |
| Hiring-bar | `npm run agent:hiring-bar` | 75-85% | Strong artifact-driven policy |
| Hiring-bar (JSON) | `npm run agent:hiring-bar:eval` | 75-85% | Per-seed JSON metrics |
| Oracle | `npm run agent:oracle:eval` | Upper bound | Perfect-information reference |
| Meta-learning | `npm run agent:meta-learning:eval` | >= hiring-bar | Warm-start vs artifact-only |
| User-flow (live) | `npm run agent:user-flow` | 75-85% | Authenticated end-to-end run |

The 10 canonical benchmark seeds are defined in `scripts/exchange-agent-models.mjs`:

```
alpha-switch, broadway-night, uptown-rush, vermont-wire, switchyard-7,
hotel-desk, relay-room, district-noon, ledger-evening, trunk-surge
```

## Prerequisites

```bash
npm install
```

No running app, database, or API keys needed for offline benchmarks. The `ts-path-loader.mjs` hook resolves `@/` imports automatically.

## Step-by-Step

### Step 1: Run the snapshot baseline

```bash
npm run agent:baseline
```

Expected output:

```
alpha-switch: 31%
broadway-night: 28%
...
Snapshot baseline benchmark
average: 29%
median: 30%
min/max: 24% / 34%
```

**Pass**: Average between 25% and 35%.
**Fail**: Average below 20% (game too hard for basic heuristics) or above 40% (game too easy — even a naive agent scores well).

### Step 2: Run the hiring-bar benchmark

```bash
npm run agent:hiring-bar
```

Expected output:

```
alpha-switch: 82%
broadway-night: 78%
...
Hiring-bar benchmark
average: 80%
median: 81%
min/max: 74% / 86%
variance: 0.00142
```

**Pass**: Average between 75% and 85%, variance below 0.015.
**Fail**: Average below 70% (game too hard — a strong agent can't pass the hiring bar) or above 88% (game too easy — the hiring bar doesn't discriminate).

### Step 3: Get detailed hiring-bar metrics (optional)

```bash
npm run agent:hiring-bar:eval
```

Outputs one JSON object per seed with full `metrics` including efficiency, hidden score, connect rate, drop rate, and hold rate. Useful for diagnosing which seeds are outliers.

### Step 4: Run the oracle reference (optional)

```bash
npm run agent:oracle:eval
```

The oracle agent has perfect information about hidden line families. It establishes the theoretical upper bound. If the hiring-bar agent is close to the oracle, the visible signal is too informative. A healthy gap (10-20 points) means inference skill matters.

### Step 5: Run the meta-learning evaluation (optional)

```bash
npm run agent:meta-learning:eval
```

Compares warm-start (with prior board summaries) against artifact-only on 40 holdout seeds. The warm-start agent should match or slightly improve on the artifact-only hiring-bar. Material regression suggests overfitting to prior boards.

### Step 6: Run the live user-flow (optional)

Requires a running Convex deployment and auth keys.

```bash
# Required environment variables:
export NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"
export CONVEX_AUTH_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# Optional overrides:
# BENCHMARK_BASE_URL (default: http://127.0.0.1:3000)
# BENCHMARK_GITHUB_LOGIN (default: benchmark-agent)
# BENCHMARK_CODEX_MODEL (default: gpt-5.1-codex-mini)
# BENCHMARK_CODEX_TIMEOUT_MS (default: 45000)
# BENCHMARK_POLL_INTERVAL_MS (default: 250)

npm run agent:user-flow
```

This runs a complete shift lifecycle: start shift, fetch artifacts, build policy, validate, run two probes, optionally rewrite with an LLM, go live, and report results. Outputs a full JSON report with efficiency, title, probe metrics, and report URL.

## Interpreting Results

### What the numbers mean

- **Efficiency** = connected calls / total calls. This is the primary metric printed by each benchmark.
- **Hidden score** = weighted composite from `SCORE_WEIGHTS` in `constants.ts`: connectRate(0.62) + dropRate(0.2) + holdRate(0.1) + trunkDiscipline(0.08). Available in JSON eval output.
- **Variance** = how much efficiency varies across seeds. Lower is better for balanced gameplay.

### When to worry

| Observation | Meaning | Action |
| --- | --- | --- |
| Hiring-bar average < 70% | Game too hard | See [engine-config.md](engine-config.md) — reduce difficulty |
| Hiring-bar average > 88% | Game too easy | Increase noise/pressure |
| Baseline average > 40% | Naive agent too strong | Signal is too transparent |
| Baseline average < 15% | Game punishes even basic strategies | Check runtime penalties |
| Variance > 0.015 | Seeds are too uneven | Reduce `spread` values in balance.ts jitter ranges |
| Oracle gap < 5 points | Inference too easy | Increase `visibleNoise` in balance.ts |

### Comparing before and after a change

1. Run `npm run agent:hiring-bar` **before** the change. Note average, median, min, max, variance.
2. Make **one** change in `src/core/engine/config/balance.ts`.
3. Run `npm run agent:hiring-bar` **after** the change.
4. Compare all five statistics. A good change moves the average toward the target band without increasing variance.

See [engine-config.md](engine-config.md) for the tuning workflow and common recipes.

## Implementation Notes

- Deterministic benchmark decisions from `scripts/v3-agent-policies.mjs` are the authoritative enforcement surface for score bands.
- QuickJS source-generation parity is checked in `__tests__/policy.test.ts` and `__tests__/hiring-bar-agent-core.test.ts`.
- The offline benchmark scripts and tests are the canonical regression surface. The app-surface harness (`agent:user-flow`) is supplementary.
