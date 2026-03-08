# Firecrawl Exchange: Approach

## The Problem with v1

CheetCode v1 tested speed on known coding problems. I played it. A single prompt to Claude with a long enough iteration loop one-shot the entire challenge without any steering. The problems could be banked — collect enough runs and you've compiled an answer key. Convex mutations were exposed, so the leaderboard could be altered without proving anything. The game rewarded exploits and memorization. Those are real skills, but they're not the skills you're hiring for.

The deeper problem: v1 measured how fast you can solve a problem that already has a solution. Production agent work is the opposite — you're operating on incomplete, noisy data, under time pressure, with no answer key. The game shape was wrong.

## What Actually Predicts Agent Ability

The single best predictor of whether someone can build production-grade agent systems is whether they can build **learning loops**. Not prompting skill. Not API speed. Loops — observe, infer, act, learn, repeat.

This is what separates a script from a system. A script runs a prompt and returns the output. A system ingests messy evidence, fits a model, tests it against reality, discovers where the model breaks, revises, and ships something better. That iterative refinement process — from noisy labels to working policy — is the core competency Firecrawl should hire for.

The game's benchmark tiers map directly to this:

- **Under 10%** (Starter): You showed up but didn't bring tools. Manual play against a routing problem with hidden state is a losing proposition by design.
- **~25–50%** (Baseline): You can use agents to write code, or you're personally strong at statistical reasoning. Either path gets you a reasonable first-pass policy.
- **~75–85%** (Hiring bar): Your agent pipeline does meta-learning. It parses 4,800 noisy observation rows, weighs operator grades, fits per-group compatibility scores, runs probes to discover where the history lied, and rewrites control logic — not just rankings — before the final run. Across boards, it builds cross-session memory that transfers.

## Why a Game

A game is the right evaluation shape because games have hidden state, feedback loops, and repeated play — the same three properties that make real agent work hard.

The telephone exchange theme isn't cosmetic. The routing problem naturally requires inference under uncertainty: hidden line families, noisy historical observations, pressure dynamics that shift mid-run. Every artifact serves a structural purpose. `observations.jsonl` is 4,800 rows of historical routing data with 25% seeded noise and adversarial trainee rows — it's the primary mechanism that makes manual play impractical and rewards robust statistical modeling. Probes are the feedback loop: they reveal operational truth without leaking hidden state, just like production logs tell you what failed without telling you why. The QuickJS sandbox is the constraint: no network, no filesystem, no timers, 16KB size limit. Your policy must be pure computation — the agent work happens before submission.

The aesthetic matters too. The 1963 telephone exchange — inspired, honestly, by too much Mad Men — gives people a reason to care about their score. "Line 01 — Chief Operator" on a Shift Report feels worth sharing. Engagement drives repeated play, and repeated play is where the real signal lives.

## Anti-Gaming: Structural, Not Bolted On

v1's anti-gaming was an afterthought. v2's is the architecture itself.

Each board draws 3–5 hidden families from a pool of 5. Visible metadata correlates with hidden truth but doesn't solve it — about 20–26% of visible signals are noise. Board-specific seeds mean no universal answer key exists. The observation history is useful but dirty: operator grade weights (`senior: 1.0`, `operator: 0.72`, `trainee: 0.18`) create a data quality problem that mirrors real-world scraping — your agent must exercise judgment about which data to trust. Probes reveal what the history got wrong under live conditions, similar to how production telemetry contradicts pre-launch assumptions.

The difficulty isn't a wall to climb over. It's the shape of the problem itself.

## What We Kept, What We Replaced

**Kept**: Convex, Next.js, Auth.js, GitHub OAuth, the leaderboard concept, timed shifts.

**Replaced**: Everything else. The entire game engine (`src/core/engine/`), scoring system, artifact pipeline, board generation, observation synthesis, probe system, policy sandbox, UI, theme, and design system. The v1 codebase was a different product.

## How It Was Built

This was built almost entirely with Claude Code — the same kind of agent workflow the game is designed to evaluate. That's not a flex; it's evidence. If you're building a tool to measure whether people can orchestrate agents effectively, you should be able to demonstrate the skill yourself.

The build process mirrored what the game tests. I set up tests, linters, and hooks that gated what code reached main. I wrote benchmark agents first — starter, baseline, hiring-bar — and set score expectations before the engine existed. Then I used Claude Code to build the engine iteratively, running benchmarks after each change to keep the difficulty curve calibrated. When the hiring-bar agent scored too high, I tightened noise. When it scored too low, I loosened visible signal fidelity. The game was tuned the same way it's meant to be played: build a feedback loop, measure, adjust.

The design system was also agent-generated. I maintain a design language doc that Paper MCP reads when generating or modifying artboards — the same tokens that drive `globals.css`. I had ideas about pushing the skeuomorphic switchboard aesthetic further. If I had more time, I'd explore that.

## Architecture

Three roots, clean dependency rules:

- **`src/core/engine/`** — Pure domain. Board generation, traffic simulation, observation synthesis, scoring, probe summaries. No React, no Next.js, no Convex imports. This is where the game lives.
- **`src/features/*/`** — Feature slices: `shift` (gameplay console), `landing` (leaderboard + hero), `report` (public shift reports), `admin` (inspection). Each slice owns its client and server code.
- **`src/server/`** — Infrastructure adapters. Auth helpers, Convex client, HTTP utilities.

Policy execution runs in a deterministic QuickJS sandbox (`src/core/engine/policy-vm.ts`). The benchmark suite (`scripts/v3-agent-policies.mjs`) validates the difficulty curve against 10 fixed seeds with four agent tiers.

## Tradeoffs and Limitations

**Platform is stateless across shifts.** Cross-board learning — building memory that transfers between boards — must come from the candidate's own tooling. This is intentional: it tests whether you can build that infrastructure, not whether the platform can hand it to you.

**Observation noise rate is tuned, not proven optimal.** 25% noise with grade-weighted credibility feels right against the benchmark suite, but I haven't run adversarial optimization against the noise model itself. A determined attacker with enough runs could likely characterize the noise distribution.

**Probe output is narrative prose.** The chief operator notes, counterfactuals, and incident reports are themed and human-readable. A more structured output format would be easier for LLMs to consume. I chose narrative because it tests whether your agent can extract signal from unstructured text — a real-world skill — but there's a valid argument for offering both.

**No mobile play.** This is a tooling challenge. You need a terminal, an editor, and an agent runtime. Mobile browsing is supported for viewing reports and the leaderboard, but gameplay is desktop-only.

**One board profile is public flavor, not a public label.** Players can learn to recognize board tendencies across runs, but the profile name is never announced. This could frustrate players who want more transparency. I think the opacity is correct — real production systems don't announce their operating mode — but it's a product judgment call, not a technical constraint.
