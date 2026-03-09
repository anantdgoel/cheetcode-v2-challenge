# APPROACH.md

## 1. Problem Framing

Firecrawl Exchange is my submission for the CheetCode v2 challenge. I played v1 before building v2. It was a clean product with a clear loop — timed coding problems, agent-assisted solving, leaderboard. It did a good job measuring speed and resourcefulness. The question I kept coming back to was whether speed on known problems is the right signal for this role.

A single Claude prompt with a long enough iteration loop could clear the challenge without meaningful steering. The problem set was bankable across runs. These aren't bugs — they're consequences of the game shape. v1 asked: *how fast can you solve a problem that already has a solution?* That's a legitimate filter. But it selects for a narrower skill than what production agent work actually demands.

Production agent work is messier. You're operating on incomplete data. The signal is noisy. There's no answer key. Your first model of the problem is probably wrong, and figuring out *how* it's wrong is the actual job.

## 2. Design Goals

The challenge should test exactly one thing: **can you build a learning loop?**

Speed and raw coding ability are things v1 already filters for. The skill that's harder to measure — and more predictive for this role — is whether someone can take messy, incomplete evidence, build a model of what's happening, test it, find where it's wrong, and ship something better before time runs out. That loop should be the only reliable path to a high score, and the score tiers should be calibrated tightly enough that you can read a number and know how far through the loop a candidate got.

The benchmark tiers were the acceptance criteria:

- **Under 10% (Starter)** — Showed up but didn't use agents or data tooling. Manual play against a problem with hidden state doesn't work by design.
- **25–50% (Baseline)** — Used agents to generate code, or is personally strong at data analysis. A solid first-pass policy without iteration lands here.
- **75–85% (Hiring bar)** — Built a pipeline that actually learns. It parses 4,800 noisy observation rows, weights them by data quality, fits per-group compatibility scores, uses probe feedback to find where its initial model was wrong, and rewrites routing logic — not just line rankings — before the final run. Across sessions, it carries forward what it learned.

I wrote the benchmark agents and set those score targets before the engine existed, then built the engine iteratively against them. The game was calibrated the same way it's meant to be played.

Secondary goals:
- Anti-gaming should be structural, not bolted on after the fact
- The platform should work end-to-end as a deployed product
- Setup should be clear enough that another engineer can run it cold
- The difficulty curve should be calibrated and testable

## 3. What We Built

Firecrawl Exchange is a routing game set in a 1957 telephone switchboard. You write a JavaScript routing policy that decides, for each incoming call, which line to connect it to — in real time, under load, with incomplete information about how good each line actually is. The theme is functional and decorative.

Each session starts with a Shift. The system generates a board of 8–16 telephone lines, each with a hidden *family* — a compatibility profile that determines which call types it handles well. The player gets four artifacts: `manual.md` (the briefing), `starter.js` (a deliberately weak baseline policy), `lines.json` (the visible board inventory), and `observations.jsonl` (4,800 historical call records). None of this fully reveals the hidden model. Visible family labels have 20–26% noise. The observation log is corrupted by grade-weighted garbage rows. The player's job is to build a routing policy that works anyway.

Before submitting, the candidate can run up to two test probes. Each one runs their current policy against the board and returns written feedback — what failed, where the policy's assumptions were wrong, how it behaved under increasing load. The candidate uses that to revise their policy, then submits for the real run. Scoring is based on four metrics: how often calls connected successfully, how often they dropped, how long callers were held, and whether premium lines were used without accumulating penalties. Results are published immediately; a fuller breakdown of where points were lost unlocks after the session closes.

The platform doesn't store anything between sessions. If a candidate wants to improve across multiple boards — recognize patterns faster, avoid mistakes from last time, build up a model of how different board types behave — they have to build that tooling themselves. That's intentional. The ability to learn across runs, not just solve one board in isolation, is the skill being tested. Oh, and each "loop" of this board only lasts 60s, including the two probes.

## 4. Anti-Gaming Strategy

In v2, the architecture *is* the anti-gaming.

**No universal answer key.** Each board draws 3–5 hidden line families from a pool of 5, seeded per-board, with the compatibility matrix jittered on top. No fixed answer transfers — partial solutions from one board can mislead you on the next.

**Noisy historical data.** `observations.jsonl` has 4,800 rows with ~25% seeded noise and adversarial trainee rows. Grade weights (`senior: 1.0`, `operator: 0.72`, `trainee: 0.18`) mean that averaging all rows equally produces a misleading picture. Being selective gets better results than pooling everything — the same judgment call that matters in any real data pipeline.

**Probes reveal, not solve.** Probes return narrative summaries — what happened under live conditions, where the model broke, what the artifacts got wrong. They surface this without leaking hidden state. Reading diagnostic prose and deciding what to act on is part of what's being tested.

**The sandbox is the constraint.** QuickJS enforces pure computation. The agent loop lives outside; only the compiled routing policy goes in. The challenge doesn't measure whether you can write code — it measures whether you can build the infrastructure that writes better code each iteration.

## 5. Scoring and Evaluation Strategy

The score weights four components: connect rate (primary), drop rate, hold rate, and premium discipline. Faults emerge from poor routing decisions under load — not from a hidden puzzle running in parallel. This keeps the score legible: you can look at where you lost points and know what to fix.

Traffic simulation uses a pressure curve built from superimposed sine waves and Gaussian bursts. Probes run at lower pressure; the final run adds phase changes that shift traffic composition mid-simulation — route weight changes and capacity swings that only appear under sustained load. Hidden board traits (`finalShiftSensitivity`, `tempoLag`, `pressureCollapse`) determine how much the final diverges from probes. A transfer warning tells players how much to trust their probe data: `stable`, `stress_only`, or `likely_final_shift_sensitive`.

After each probe, a pipeline generates diagnostic feedback with no LLM. It groups trace events into call-type and load-level breakdowns, derives ~20 signals (connect rate by call type, premium misuse rate, hold failure rate, second-half drop rate, etc.), then scores 6 failure archetypes — `collapse_under_pressure`, `premium_thrash`, `overholding`, `false_generalist`, `tempo_lag`, `misleading_history` — against weighted signal combinations. The top failure modes generate plain-language feedback plus a short list of follow-up diagnostic questions. The output is intentionally unstructured — reading it and deciding what to act on is part of the skill being tested.

Each use of a premium line adds to a shared heat counter for that line group, which decays over time at a rate set by a hidden board trait. Aggressive premium routing works until it doesn't, and the cost compounds under pressure in ways a static model won't predict.

The hiring-bar benchmark agent shows the expected ceiling: it ingests observations, computes grade-weighted compatibility per line group, infers a board profile posterior from traffic mix, builds 8-dimensional trait vectors (pressure sensitivity, premium fragility, government bias, etc.), and tracks runtime state including premium heat and a pending-line feedback loop. The model compiles itself into a JavaScript source string and runs in the sandbox like any other submission. The benchmark agent *is* a valid submission.

The difficulty curve is validated against the benchmark suite after every meaningful engine change. When the hiring-bar agent scored too high, noise was tightened. When it scored too low, visible signal fidelity was loosened.

The key evaluative question isn't whether a candidate scored high on one board, but whether their workflow improves systematically across boards. The hiring-bar benchmark tests this directly: it allows compact prior-board summaries (profile posteriors, family-count priors, collapse estimates, premium ROI) and checks whether they lift performance without becoming a crutch.

That covers what candidates experience. The admin dashboard is what hiring managers use.

The score is one signal. The dashboard surfaces the rest.

The candidate table gives quick triage: ranking by score and efficiency, classification badge, shift count as an engagement signal, contact indicator (the contact form is gated by hitting the hiring bar — green means the candidate both scored well and decided to raise their hand), and last active. Most candidates filter out at this view.

For candidates worth digging into, the detail view shows score trajectory across runs — a coachability signal more useful than any single number. A candidate who goes from 22% to 78% across three boards says more than one who scored 78% on their first attempt. Full session history is expandable: probe summaries, diagnostic notes, failure modes, and policy code snapshots. The reviewer can assess exactly how the candidate approached the problem at each stage without needing access to their dev environment.

The LLM assessment (GPT-4o, on-demand per candidate, 60s throttle) produces a structured hiring signal: STRONG HIRE / HIRE / LEAN HIRE / LEAN NO HIRE / NO HIRE, with specific strengths, concerns, and a two-sentence summary. The evaluation criteria are baked into the prompt: score trajectory, engagement depth, policy sophistication, and probe utilization — the same four dimensions the game is designed to reveal. It's qualitative and labeled as such. The goal was to make the decision obvious for the strong cases and well-documented for the hard ones.

## 6. Architecture and Data Flow

Three roots with clean dependency rules — no circular imports, no framework code in the domain layer:

**`src/core/engine/`** — Pure domain logic. Board generation, traffic simulation, observation synthesis, scoring, probe summaries. No React, no Next.js, no Convex. Isolated so the benchmark suite runs without infrastructure and coding agents can work on it independently.

**`src/features/*/`** — Feature slices: `shift` (gameplay console), `landing` (leaderboard + hero), `report` (public shift reports), `admin` (inspection). Each slice owns its client and server code.

**`src/server/`** — Infrastructure adapters. Auth helpers, Convex client, HTTP utilities.

**Policy execution** runs in a deterministic QuickJS WASM sandbox: no network, no filesystem, no timers, 16KB size limit. Data crosses the VM boundary as JSON strings. Your policy is pure computation — the agent work happens before submission.

**The benchmark suite** (`scripts/v3-agent-policies.mjs`) validates the difficulty curve against 10 fixed seeds with four agent tiers.

**Board profiles** (`switchboard`, `front-office`, `night-rush`, `civic-desk`, `commuter-belt`, `storm-watch`) create stable statistical tendencies across shifts on the same board. Traffic mix, pressure curve, and history reliability vary by profile. Players who identify profiles and build priors improve across runs; players who treat each board as independent quickly plateau.

**Reliability.** One-active-shift enforcement at the database level. Probe and final submissions are atomic — a claim step prevents double-submits even under concurrent requests. Auto-finalization on expiry runs the latest validated policy if the timer runs out. Every run is stored as a full trace — source snapshot, timestamps, probe summaries, final metrics with hidden score.

## 7. What Changed vs v1

**Kept:** Convex, Next.js, Auth.js, GitHub OAuth, the leaderboard concept, timed shifts.

**Replaced:** Everything else. The entire game engine (`src/core/engine/`), scoring system, artifact pipeline, board generation, observation synthesis, probe system, policy sandbox, UI, theme, and design system. v1 was a different product.

## 8. Product Thinking

The telephone exchange theme isn't cosmetic. A routing problem with hidden line families, noisy history, and mid-run pressure dynamics fits inference under uncertainty naturally. The 1957 aesthetic — too many Mad Men reruns — gives players a reason to care about their score. "Line 01 — Chief Operator" on a Shift Report feels worth sharing. Engagement drives repeated play, and repeated play is where real signal lives.

The product craft runs deeper than the theme, because it has to get others excited. The public report is styled as Form SR-57, Supervisor's Shift Report, with letterhead, classification badges, a supervisor's note in serif type, and a signature line. It's designed to be worth screenshotting and sharing. The shift console clock animates each digit independently as a slot-machine flip. The in-world vocabulary is consistent end to end: callsigns, not usernames; board efficiency, not score; dispatch log, not leaderboard. Even the probe feedback speaks in character. These aren't decorative choices — they're what makes someone play twice.

## 9. How I Built This Agentically

The build process mirrored what the game tests, and the docs in this repo are evidence of that.

Everything started with a spec. `docs/archive/plan-v1.md` is a full product spec — player flow, state model, artifact contract, scoring rules, failure semantics, acceptance scenarios — written before any implementation existed. `docs/spec.md` is the equivalent for v3.2. Writing specs at this level of detail isn't documentation overhead; it's how you give a coding agent a complete enough picture of the system to make non-trivial changes without breaking adjacent behavior.

The engine was built test-first against benchmark agents. `docs/benchmarks.md` defines the target score bands and verification commands. I wrote the benchmark agents before the engine existed, ran them after every meaningful change, and used the gap between actual and target scores as the feedback signal for balance work — the same loop the challenge asks candidates to run. The safe tuning order in `docs/engine-config.md` (`trafficShape` → `visibleSignal` → `runtimePenalties` → `scoring`) was written so an agent could make targeted balance changes without needing to understand the whole system at once.

Architecture was organized to make parallel agent work safe. The three-root structure (`src/core/`, `src/features/`, `src/server/`) with explicit dependency rules in `docs/architecture.md` meant agents working on the engine couldn't accidentally couple domain logic to Next.js, and agents working on UI couldn't reach into Convex internals directly. `docs/design/` served as the design system grounding doc for UI work — brand integration, typography, visual language, skeuomorphic elements — so agents generating interface code stayed consistent with the existing visual language.

Tests, linters, and hooks gated what reached `main`. My agents did the heavy lifting — which is evidence, not a flex. If you're building a tool to measure agent orchestration, demonstrating the skill yourself is the minimum bar. The skill the challenge tests is the skill I used to build it.

## 10. Tradeoffs

**Cross-board memory is the candidate's problem, by design.** The platform is stateless across shifts. Building memory that transfers — the thing that gets you from 50% to 85% — is on the candidate. Handing it to them removes the signal.

**Noise rate is tuned, not proven optimal.** 25% noise with grade-weighted credibility holds up against the benchmark suite. A determined attacker with enough runs could likely characterize the noise distribution. The fix is session-level noise re-seeding, not yet implemented.

**Probe output is an ongoing calibration problem.** The feedback is intentionally unstructured — reading it and deciding what to act on is part of the skill being tested, and a machine-parseable format would hand that step to the LLM instead. But keeping the prose evidence-shaped without being prescriptive is maintenance work: each new board profile or family interaction is a potential leak. A future version might formalize a diagnostic grammar to make this more maintainable at scale. Both formats could coexist.

**The benchmark seeds are public.** The fixed seed suite used for calibration lives in the repo. A candidate who studies it carefully could optimize against the benchmark directly rather than against the general problem. The fix is either rotating seeds or keeping the suite private; neither is implemented yet.

**LLM assessments go stale.** The GPT summary is generated on demand and cached. It doesn't update when the candidate submits more shifts. A hiring manager working from a cached assessment could be looking at an incomplete picture if the candidate improved significantly after it was generated. Ideally, I would add a cron-job to run hourly, but that risks exploding costs if we have too many submissions. 

**Board profile opacity is a deliberate call.** Players can learn to recognize board tendencies across runs, but the profiles are never revealed directly. Real systems don't announce their operating mode — you infer it from behavior. Some candidates will find this frustrating; I think it's the right call, and it maps directly to how Firecrawl's crawlers operate on sites that don't document their structure.

## 11. Future Work

**Automated candidate digest.** The admin dashboard already generates LLM summaries per candidate. The next step is aggregating those into a periodic digest — a ranked shortlist of top candidates with their signals surfaced — so a hiring manager doesn't have to manually triage the table. The raw material is already there; it just needs a layer on top.

**Real-time competitive mode.** The current model is turn-based: submit a policy, get a score. A more ambitious version would run candidate agents against a continuous stream of live traffic simultaneously, so policies compete against the same conditions at the same time rather than independently against fixed seeds. That removes seed variance as a confound and makes comparison between candidates more direct. It's a significantly larger infrastructure investment, but it's the more honest evaluation surface.

**Deeper skeuomorphism.** The design system in `docs/design/` includes reference material for skeuomorphic elements that didn't make it into the final UI. With more time I would have leaned into this further — physical texture, tactile controls, the feeling of actual hardware — to deepen the immersion and make the 1957 switchboard feel more like a place you're operating in rather than a webpage you're looking at.

**Logging and error reporting.** The platform stores full run traces but has no structured logging pipeline or error reporting beyond what Convex provides out of the box. Adding proper observability — structured logs for shift lifecycle events, probe execution failures, sandbox timeouts, and admin actions — would make it much easier to debug issues in production and catch problems before a candidate reports them.

**Code cleanup and repo organization.** The codebase reflects the pace of development — some modules are cleaner than others, and a few abstractions didn't survive contact with the final design. A focused cleanup pass to improve internal consistency and reduce cognitive overhead for anyone picking this up would make it easier to extend and maintain.