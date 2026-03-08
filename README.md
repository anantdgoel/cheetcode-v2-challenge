# Madison Exchange

Madison Exchange is a public coding challenge staged as a 1963 Madison Avenue telephone exchange. The browser is the official control surface, but the real work happens in the evidence bundle and the local tooling you build before you go live.

This repo now implements the v3 game shape:
- one stateful submitted JavaScript policy
- a compact hidden model built around line-family fit and live load
- two structured probes: `fit` and `stress`
- four live artifacts: `manual.md`, `starter.js`, `lines.json`, `observations.jsonl`

## Core loop

1. Start a Shift on a fresh hidden board.
2. Download the evidence bundle immediately.
3. Analyze the bundle locally and prepare a policy.
4. Run up to two probes on the active board.
5. Tune locally.
6. Go live for the final run.
7. Review the public report and the richer postmortem for the spent board.

Repeated fresh Shifts are intentional. Strong solvers are expected to improve their tooling across boards, not just hand-tune a single run.

## Policy contract

The submitted file may export:
- optional `init(context)`
- required `connect(input)`

`init(context)` runs once per probe or final run.
`connect(input)` runs once per routing decision.
State persists within a run and resets between runs.

The live runtime exposes:
- `clock.second`
- `clock.remainingSeconds`
- `board.load`
- `board.tempo`
- `board.queueDepth`
- visible `call` fields
- visible `lines` fields, including `lineGroupId`

The runtime does not expose:
- board seeds
- hidden line families
- exact success probabilities
- per-line historical rankings

## Artifacts

Each Shift exposes exactly four live artifacts:

- `manual.md`
  Theme, explicit rules, probe descriptions, and strategic cautions.
- `starter.js`
  A valid but intentionally weak baseline.
- `lines.json`
  The visible inventory for the active board.
- `observations.jsonl`
  Historical evidence generated from the active board's own hidden parameters, with seeded noise.

## Benchmark targets

The v3.1 implementation is balanced against a fixed benchmark seed suite.

- `starter.js`: under `10%` average score
- snapshot baseline agent: roughly `25-35%`
- old static heuristic: `40%` or lower
- artifact-driven hiring-bar agent: roughly `75-85%`

Those are acceptance gates for the simulator and benchmark harness, not public promises to players.

## Stack

- Next.js app in `src/`
- Auth.js GitHub sign-in in `auth.ts`
- Convex persistence in `convex/`
- QuickJS policy validation and evaluation in [src/lib/policy.ts](/Users/anant/dev/firecrawl-takehome/src/lib/policy.ts)

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_MUTATION_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_SECRET`
- `ADMIN_GITHUB_LOGINS`

## Useful scripts

```bash
npm run dev
npm run test
npx tsc --noEmit
npm run test:e2e
npm run agent:baseline
npm run agent:hiring-bar
npm run agent:user-flow
npm run agent:hiring-bar:eval
npm run agent:oracle:eval
```

## Important files

- [src/lib/types.ts](/Users/anant/dev/firecrawl-takehome/src/lib/types.ts): shared v3 domain types
- [src/lib/exchange.ts](/Users/anant/dev/firecrawl-takehome/src/lib/exchange.ts): board generation, artifacts, probes, scoring
- [src/lib/policy.ts](/Users/anant/dev/firecrawl-takehome/src/lib/policy.ts): sandboxed policy validation and execution
- [src/lib/shift-service.ts](/Users/anant/dev/firecrawl-takehome/src/lib/shift-service.ts): server orchestration
- [src/components/ShiftConsole.tsx](/Users/anant/dev/firecrawl-takehome/src/components/ShiftConsole.tsx): active Shift UI
- [scripts/v3-agent-policies.mjs](/Users/anant/dev/firecrawl-takehome/scripts/v3-agent-policies.mjs): benchmark policy definitions
- [__tests__/simulation.test.ts](/Users/anant/dev/firecrawl-takehome/__tests__/simulation.test.ts): score-band verification

## Benchmarks

- `npm run agent:hiring-bar`
  Offline deterministic benchmark. Builds a board-specific policy from `lines.json` and `observations.jsonl`, then runs it directly against the local simulator without touching Next.js, Auth.js, or Convex.
- `npm run agent:user-flow`
  End-user-flow harness. Mints a local Auth.js session cookie from `AUTH_SECRET`, then uses the same `/api/shifts/*` routes the browser uses. This is intended for local/dev benchmarking against the real app surface, not for bypassing production auth.
