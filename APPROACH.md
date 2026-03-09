# APPROACH.md

## 1. Problem Framing

I played v1 before building v2. It was a clean product with a clear loop — timed coding problems, agent-assisted solving, leaderboard. It did a good job measuring speed and resourcefulness. The question I kept coming back to was whether speed on known problems is the right signal for this role.

A single Claude prompt with a long enough iteration loop could clear the challenge without meaningful steering. The problem set was bankable across runs. These aren't bugs — they're consequences of the game shape. v1 asked: *how fast can you solve a problem that already has a solution?* That's a legitimate filter. But it selects for a narrower skill than what production agent work actually demands.

Production agent work is messier. You're operating on incomplete data. The signal is noisy. There's no answer key. Your first model of the problem is probably wrong, and figuring out *how* it's wrong — before you run out of time — is the actual job.

## 2. Design Goals

The challenge should test exactly one thing: **can you build a learning loop?**

Not prompting speed. Not raw coding ability. The skill that separates a script from a production system is the full cycle: observe, infer, act, learn, repeat. From messy evidence, fit a model. Test it against reality. Find where the model breaks. Revise. Ship something better. That loop should be the only path to a high score, calibrated tightly enough that you can read the score and know which part of the loop a candidate reached. However, the details of how to build each stage are left to the end user's creativity.

The benchmark tiers were the acceptance criteria:

- **Under 10% (Starter)** — You showed up but didn't bring tools. Manual play against a routing problem with hidden state is a losing proposition by design.
- **~25–50% (Baseline)** — You used agents to write code, or you're personally strong at statistical reasoning. A reasonable first-pass policy gets you here.
- **~75–85% (Hiring bar)** — Your pipeline actually learns. It parses 4,800 noisy observation rows, weighs operator grades, fits per-group compatibility scores, runs probes to discover where the history lied, and rewrites control logic — not just rankings — before the final run. Across boards, it builds cross-session memory that transfers.

I wrote the benchmark agents and set score expectations before the engine existed, then built the engine iteratively, running benchmarks after every meaningful change to keep the curve calibrated. The game was tuned the same way it's meant to be played.

Secondary goals:
- Anti-gaming should be structural, not bolted on after the fact
- The platform should work end-to-end as a deployed product
- Setup should be clear enough that another engineer can run it cold
- The difficulty curve should be calibrated and testable

## 3. Architecture and Data Flow

Three roots with clean dependency rules — no circular imports, no framework code in the domain layer:

**`src/core/engine/`** — Pure domain logic. Board generation, traffic simulation, observation synthesis, scoring, probe summaries. No React, no Next.js, no Convex. Isolated so the benchmark suite runs without infrastructure and coding agents can work on it independently.

**`src/features/*/`** — Feature slices: `shift` (gameplay console), `landing` (leaderboard + hero), `report` (public shift reports), `admin` (inspection). Each slice owns its client and server code.

**`src/server/`** — Infrastructure adapters. Auth helpers, Convex client, HTTP utilities.

**The game** is a signal-extraction problem disguised as a routing problem. Each board generates 8–16 telephone lines with hidden *families* — compatibility profiles governing which line handles which traffic well. The player gets `lines.json` (metadata including a `visibleFamily` field) and `observations.jsonl` (4,800 historical call records). The catch: 20–26% of visible family assignments are wrong, and the observation log is corrupted by grade-weighted noise. Senior operator observations are reliable; trainee observations can have outcomes flipped in borderline probability windows. Each line's true compatibility is a 24-entry matrix (4 route codes × 3 billing modes × 2 urgency levels), derived from family baselines but jittered per-board with seed-stable RNG. Even knowing a line's true family isn't enough — you still need to learn its board-specific calibration from the observations.

**Policy execution** runs in a deterministic QuickJS WASM sandbox: no network, no filesystem, no timers, 16KB size limit. Data crosses the VM boundary as JSON strings. Your policy is pure computation — the agent work happens before submission.

**The benchmark suite** (`scripts/v3-agent-policies.mjs`) validates the difficulty curve against 10 fixed seeds with four agent tiers.

**Reliability.** One-active-shift enforcement at the database level. Probe and final submissions use an atomic claim-then-process pattern: `claimRunForProcessing` transitions state from `accepted` to `processing`, preventing double-submits. Auto-finalization on expiry runs the latest validated policy if the timer runs out. Every run is stored as a full trace — source snapshot, timestamps, probe summaries, final metrics with hidden score.

## 4. Anti-Gaming Strategy

v1's anti-gaming was an afterthought. In v2, the architecture *is* the anti-gaming.

**No universal answer key.** Each board draws 3–5 hidden line families from a pool of 5, seeded per-board, with the compatibility matrix jittered on top. No fixed answer transfers — partial solutions from one board can mislead you on the next.

**Noisy historical data.** `observations.jsonl` has 4,800 rows with ~25% seeded noise and adversarial trainee rows. Grade weights (`senior: 1.0`, `operator: 0.72`, `trainee: 0.18`) mean raw statistics mislead. Naively averaging everything gets worse results than being selective — same as real data pipelines.

**Probes reveal, not solve.** Probes return narrative summaries — what happened under live conditions, framed as shift reports and incident notes. They show where your model broke without leaking hidden state. You have to extract signal from prose, same as you would from production logs.

**The sandbox is the constraint.** QuickJS enforces pure computation. The agent loop lives outside; only the compiled routing policy goes in. The challenge doesn't measure whether you can write code — it measures whether you can build the infrastructure that writes better code each iteration.

## 5. Scoring and Evaluation Strategy

Traffic simulation uses a pressure curve built from superimposed sine waves and Gaussian bursts. Probes run at lower pressure; the final run adds phase changes that shift traffic composition mid-simulation — route weight changes and capacity swings that only appear under sustained load. Hidden board traits (`finalShiftSensitivity`, `tempoLag`, `pressureCollapse`) determine how much the final diverges from probes. A transfer warning tells players how much to trust their probe data: `stable`, `stress_only`, or `likely_final_shift_sensitive`.

After each probe, a pipeline generates diagnostic feedback with no LLM. It aggregates trace events into call-bucket and load-band tables, derives ~20 signals (hot connect rate, premium misuse rate, hold failure rate, second-half drop rate, etc.), then scores 6 failure archetypes — `collapse_under_pressure`, `premium_thrash`, `overholding`, `false_generalist`, `tempo_lag`, `misleading_history` — against weighted signal combinations. Top-ranked modes generate themed prose in switchboard patois, plus "Questions to Carry" forward. Deliberately unstructured: extracting signal from narrative text is part of the skill being tested.

Premium lines accumulate `premiumHeat` with each use, decaying at a rate set by a hidden fragility trait. Aggressive premium routing works until it doesn't, and the cost compounds under pressure in ways a static model won't predict.

The hiring-bar benchmark agent shows the expected ceiling: it ingests observations, computes grade-weighted compatibility per line group, infers a board profile posterior from traffic mix, builds 8-dimensional trait vectors (pressure sensitivity, premium fragility, government bias, etc.), and tracks runtime state including premium heat and a pending-line feedback loop. The entire model self-serializes into a JavaScript source string the sandbox evaluates like any player code. The benchmark agent *is* a valid submission.

The difficulty curve is validated against the benchmark suite after every meaningful engine change. When the hiring-bar agent scored too high, noise was tightened. When it scored too low, visible signal fidelity was loosened.

## 6. What Changed vs v1

**Kept:** Convex, Next.js, Auth.js, GitHub OAuth, the leaderboard concept, timed shifts.

**Replaced:** Everything else. The entire game engine (`src/core/engine/`), scoring system, artifact pipeline, board generation, observation synthesis, probe system, policy sandbox, UI, theme, and design system. v1 was a different product.

The telephone exchange theme isn't cosmetic. A routing problem with hidden line families, noisy history, and mid-run pressure dynamics fits inference under uncertainty naturally. The 1963 aesthetic — too many Mad Men reruns — gives players a reason to care about their score. "Line 01 — Chief Operator" on a Shift Report feels worth sharing. Engagement drives repeated play, and repeated play is where real signal lives.

The product craft runs deeper than the theme, because it has to get others excited. The public report is styled as Form SR-57, Supervisor's Shift Report, with letterhead, classification badges, a supervisor's note in serif type, and a signature line. It's designed to be a screenshot to Twitter intact. The shift console clock animates each digit independently as a slot-machine flip. The in-world vocabulary is consistent end to end: callsigns, not usernames; board efficiency, not score; dispatch log, not leaderboard. Even the probe feedback speaks in character. These aren't decorative choices — they're what makes someone play twice.

The build process mirrored what the game tests. Benchmark agents were written before the engine existed. Tests, linters, and hooks gated what reached `main`. My agents did the heavy lifting — which is evidence, not a flex. If you're building a tool to measure agent orchestration, demonstrating the skill yourself is the minimum bar. The skill the challenge tests is the skill I used to build it.

## 7. Tradeoffs and Future Work

**Cross-board memory is the candidate's problem, by design.** The platform is stateless across shifts. Building memory that transfers — the thing that gets you from 50% to 85% — is on the candidate. Handing it to them removes the signal.

**Noise rate is tuned, not proven optimal.** 25% noise with grade-weighted credibility holds up against the benchmark suite. A determined attacker with enough runs could likely characterize the noise distribution. The fix is session-level noise re-seeding, not yet implemented.

**Probe output is narrative prose.** Chief operator notes, counterfactuals, and incident reports are human-readable and themed. A structured format would be easier for LLMs to parse, but extracting signal from unstructured text is a real-world skill worth testing. Both formats could coexist.

**No mobile gameplay.** You need a terminal, an editor, and an agent runtime. Mobile works for browsing the leaderboard and reports, but play is desktop-only.

**Board profile opacity is a product call.** Players can learn to recognize board tendencies across runs, but the actual board profiles are never revealed. Real production systems don't announce their operating mode. Some players will find this frustrating; I think it's correct. Esp given firecrawl's product.