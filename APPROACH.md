# APPROACH.md

## 1. Problem Framing

I played v1 before building v2. It was a clean product with a clear loop — timed coding problems, agent-assisted solving, leaderboard. It did a good job measuring speed and resourcefulness. The question I kept coming back to was whether speed on known problems is the right signal for this role.

A single Claude prompt with a long enough iteration loop could clear the challenge without meaningful steering. The problem set was bankable across runs. These aren't bugs — they're consequences of the game shape. v1 asked: *how fast can you solve a problem that already has a solution?* That's a legitimate filter. But it selects for a narrower skill than what production agent work actually demands.

Production agent work is messier. You're operating on incomplete data. The signal is noisy. There's no answer key. Your first model of the problem is probably wrong, and figuring out *how* it's wrong — before you run out of time — is the actual job.

## 2. Design Goals

The challenge should test exactly one thing: **can you build a learning loop?**

Not prompting speed. Not raw coding ability. The skill that separates a script from a production system is the full cycle: observe, infer, act, learn, repeat. From messy evidence, fit a model. Test it against reality. Find where the model breaks. Revise. Ship something better. The challenge should make that loop the only path to a high score, and it should be calibrated tightly enough that you can read the score and know which part of the loop a candidate reached.

The game's benchmark tiers map directly to that model:

- **Under 10% (Starter)** — You showed up but didn't bring tools. Manual play against a routing problem with hidden state is a losing proposition by design.
- **~25–50% (Baseline)** — You used agents to write code, or you're personally strong at statistical reasoning. A reasonable first-pass policy gets you here.
- **~75–85% (Hiring bar)** — Your pipeline actually learns. It parses 4,800 noisy observation rows, weighs operator grades, fits per-group compatibility scores, runs probes to discover where the history lied, and rewrites control logic — not just rankings — before the final run. Across boards, it builds cross-session memory that transfers.

These tiers weren't aspirational targets — they were the acceptance criteria. I wrote the benchmark agents (starter, baseline, hiring-bar) and set score expectations before the engine existed, then built the engine iteratively, running benchmarks after every meaningful change to keep the curve calibrated. When the hiring-bar agent scored too high, I tightened noise. When it scored too low, I loosened visible signal fidelity. The game was tuned the same way it's meant to be played.

## 3. Architecture and Data Flow

The codebase has three roots with clean dependency rules — no circular imports, no framework code in the domain layer.

**`src/core/engine/`** is the game. Board generation, traffic simulation, observation synthesis, scoring, probe summaries — all pure TypeScript, no React, no Next.js, no Convex. The domain is isolated so the benchmark suite can run the full engine without standing up infrastructure, and so my coding agents could work on it independently. **`src/features/*/`** contains the product as four feature slices — `shift`, `landing`, `report`, `admin` — each owning their own client and server code. **`src/server/`** handles infrastructure adapters: auth, Convex client, HTTP utilities. These layers produce four surfaces: a public landing page with leaderboard, a timed shift console for gameplay, a shareable report for each completed shift, and an admin panel for internal inspection.

**The game itself** is a signal-extraction problem disguised as a routing problem. Each board generates 8–16 telephone lines with hidden *families* — the true compatibility profiles that determine which line handles which traffic type well. The player receives `lines.json` (metadata including a `visibleFamily` field) and `observations.jsonl` (4,800 historical call records). The catch: 20–26% of visible family assignments are deliberately wrong, and the observation log is corrupted by grade-weighted noise. Senior operator observations are reliable; trainee observations can have outcomes flipped in borderline probability windows. Naively averaging the historical data gets worse results than being selective about which records to trust — which mirrors what real data pipelines actually look like.

Each line's true compatibility is a 24-entry matrix (4 route codes x 3 billing modes x 2 urgency levels), derived from family baselines but jittered per-board with seed-stable RNG. So even knowing a line's true family isn't sufficient — you still need to learn its board-specific calibration from the observations. Every board is fully deterministic from a single seed string, which means any policy run is exactly reproducible.

**Policy execution** runs in a QuickJS WASM sandbox — no network, no filesystem, no timers, 16KB source limit. Data crosses the VM boundary as JSON strings, preventing any reference sharing. The agent work must happen before submission; only the compiled routing policy goes in.

**Reliability.** One-active-shift enforcement at the database level. Probe and final submissions use an atomic claim-then-process pattern: a `claimRunForProcessing` mutation transitions state from `accepted` to `processing`, so concurrent requests can't double-submit. Auto-finalization on expiry runs the latest validated policy if the timer runs out. Every probe and final run is stored as a full trace — source snapshot, timestamps, probe summaries with call buckets and failure analysis, final metrics with hidden score. The admin panel provides read-only lookup by GitHub username, shift ID, or report public ID.

## 4. Anti-Gaming Strategy

v1 tried to prevent gaming after the fact. In v2, the architecture *is* the anti-gaming.

**No universal answer key.** Each board draws 3–5 hidden line families from a pool, seeded per-board. The compatibility matrix is jittered per-board on top of that. There is no fixed solution that transfers, and even partial solutions from a previous board can actively mislead you on the next one if you don't verify them against fresh evidence.

**Probes reveal, not solve.** The probe system returns narrative operational summaries — what happened under live conditions, framed as shift reports and incident notes. They expose where your model was wrong without leaking the hidden state directly. The candidate has to extract signal from prose, the same way you'd work from production logs or postmortems.

**The sandbox is the constraint.** QuickJS enforces pure computation. The agent loop lives outside; only the compiled routing policy goes in. This means the challenge doesn't measure whether you can write code — it measures whether you can build the infrastructure that writes better code each iteration.

The difficulty isn't a wall to climb over. It's the shape of the problem itself.

## 5. Scoring and Evaluation

Traffic simulation uses a pressure curve built from superimposed sine waves plus random Gaussian-shaped bursts. Probe runs (`fit` and `stress`) use lower pressure with fewer bursts; the final run adds phase changes that shift traffic composition mid-simulation — route weight changes and capacity swings that only appear under sustained load. A board's hidden traits (`finalShiftSensitivity`, `tempoLag`, `pressureCollapse`) determine how much the final run diverges from what probes predicted. The system explicitly tells players how much to trust their probe data via a transfer warning — `stable`, `stress_only`, or `likely_final_shift_sensitive` — so the signal is there if they know to use it.

After each probe, a multi-stage analysis pipeline generates diagnostic feedback without any LLM. It aggregates trace events into call-bucket and load-band tables, derives ~20 numeric signals (hot connect rate, premium misuse rate, hold failure rate, second-half drop rate, and others), then scores 6 named failure archetypes — `collapse_under_pressure`, `premium_thrash`, `overholding`, `false_generalist`, `tempo_lag`, `misleading_history` — against weighted signal combinations. The top-ranked failure modes generate themed diagnostic prose in switchboard patois, plus a set of "Questions to Carry" forward. This is deliberately unstructured: extracting actionable signal from narrative text is part of the skill being tested.

Premium lines accumulate a `premiumHeat` value with each use, decaying at a rate modulated by a hidden fragility trait. This creates a genuine resource management problem — aggressive premium routing works until it doesn't, and the cost compounds under sustained pressure in ways a static model can't predict.

The hiring-bar benchmark agent is worth describing because it demonstrates the expected ceiling: it ingests the observation log, computes grade-weighted compatibility scores per line group, infers a board profile posterior from traffic mix ratios, builds 8-dimensional trait vectors per group (pressure sensitivity, premium fragility, government bias, and others), and maintains runtime state including premium heat tracking and a pending-line feedback loop that reinforces successful selections. The entire model — learned constants, helper functions, runtime state management — self-serializes into a single JavaScript source string that the QuickJS sandbox evaluates identically to player code. The benchmark agent *is* a valid submission.

## 6. What Changed vs v1

**Kept:** Convex, Next.js, Auth.js, GitHub OAuth, the leaderboard concept, timed shifts.

**Replaced:** Everything else. The entire game engine, scoring system, artifact pipeline, board generation, observation synthesis, probe system, policy sandbox, UI, theme, and design system.

The telephone exchange theme came from wanting a game surface where inference under uncertainty feels natural. A routing problem with hidden line families and noisy historical data fits that better than a blank coding canvas. The 1963 aesthetic — honestly, too much Mad Men — gives people a reason to care whether they hit "Line 01 — Chief Operator." Engagement drives repeated play, and repeated play is where the real signal lives.

The product craft runs deeper than the theme, though, because it has to — a challenge platform that looks like a hackathon project won't make anyone care about their ranking. The public report is styled as Form SR-57, Supervisor's Shift Report, with letterhead, classification badges, a supervisor's note in serif type, and a signature line. It's designed to survive a screenshot to Twitter intact. The shift console clock animates each digit independently as a slot-machine flip. The in-world vocabulary is consistent end to end: callsigns, not usernames; board efficiency, not score; dispatch log, not leaderboard; line numbers, not ranks. Even the probe feedback speaks in character. These aren't decorative choices — they're what makes someone play twice.

This was built almost entirely with my agentic stack, which felt like the right way to build it. I maintain a design language doc that feeds the same tokens into both code and design tooling, so my agents could generate and modify UI with visual consistency from the start. The build process mirrored the game: write the tests first, build the system iteratively, measure after every change, adjust. The skill the challenge tests is the skill I used to build it.

## 7. Tradeoffs and Future Work

**Cross-board memory is the candidate's problem, by design.** The platform is stateless across shifts. Building memory that transfers — the thing that moves you from 50% to 85% — requires the candidate to build that infrastructure themselves. That's intentional; the platform handing it to you would remove the signal.

**Noise rate is tuned, not proven optimal.** 25% noise with grade-weighted credibility holds against the benchmark suite. A determined attacker with enough runs could likely characterize the noise distribution. The fix is session-level noise re-seeding, which isn't currently implemented.

**Probe output is narrative prose.** Themed, human-readable, unstructured. Easier to read, harder for LLMs to parse reliably. The tradeoff is intentional — extracting signal from unstructured text is a real skill — but a structured alternative format would be worth adding.

**No mobile gameplay.** This is a tooling challenge. Terminal, editor, agent runtime. Mobile is supported for leaderboard browsing and report viewing, but play is desktop-only and will stay that way.

**Board profile opacity is a product call.** Players can learn to recognize board tendencies across runs, but the profile name is never surfaced. Real production systems don't announce their operating mode. Some players will find this frustrating; I think it's correct.
