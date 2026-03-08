# Agent Baselines

Madison Exchange v3 is balanced against a fixed benchmark seed suite. These baselines are now the authoritative score bands for simulator tuning and regression checks.

## Target bands

- `starter.js`: below `10%` average
- snapshot baseline agent: roughly `25-35%`
- hiring-bar agent: roughly `75-85%`

These are acceptance gates for the benchmark harness, not public-facing guarantees.

## Current benchmark entry points

### Starter baseline

The shipped starter policy is evaluated inside the test suite as part of the simulator balance checks.

Primary verification:
- [__tests__/simulation.test.ts](../__tests__/simulation.test.ts)

Expectation:
- average score below `10%`

### Snapshot baseline agent

This is the intentionally mid-tier baseline for a generic capable agent adapted to the v3 contract.

Code:
- [scripts/run-baseline-agent.mjs](../scripts/run-baseline-agent.mjs)
- [scripts/v3-agent-policies.mjs](../scripts/v3-agent-policies.mjs)

Command:
```bash
npm run agent:baseline
```

Target band:
- roughly `25-35%`

### Hiring-bar agent

This is the strong benchmark policy intended to represent a high-quality modeling and tuning workflow on the v3 rules.

Code:
- [scripts/run-hiring-bar-agent.mjs](../scripts/run-hiring-bar-agent.mjs)
- [scripts/eval-hiring-bar-agent.mjs](../scripts/eval-hiring-bar-agent.mjs)
- [scripts/v3-agent-policies.mjs](../scripts/v3-agent-policies.mjs)

Commands:
```bash
npm run agent:hiring-bar
npm run agent:hiring-bar:eval
```

Target band:
- roughly `75-85%`

## Verification approach

Balance checks should report:
- average
- median
- min
- max
- variance across the benchmark suite

The benchmark suite should be stable and checked in so simulator changes can be compared directly over time.

## Important note on implementation

The balance tests currently use deterministic decision functions from [scripts/v3-agent-policies.mjs](../scripts/v3-agent-policies.mjs) to calibrate the simulator quickly and reproducibly.

QuickJS contract correctness is validated separately in:
- [__tests__/policy.test.ts](../__tests__/policy.test.ts)

If the source-generated benchmark policies diverge from the deterministic benchmark functions, the deterministic benchmark functions remain authoritative for score-band enforcement until they are unified.

## Historical note

Old v2 live-run numbers around `30-34%` are no longer relevant for balancing decisions. Madison Exchange v3 uses a different runtime contract, a different artifact set, a different probe structure, and a different hidden model.
