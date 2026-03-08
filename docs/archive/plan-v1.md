# Firecrawl Exchange v1: Detailed High-Level Product Spec

## Summary
- Firecrawl Exchange is one public, repeatable coding challenge with one identity and one fantasy: a live 1963 telephone exchange operated by submitted code.
- The browser is the official control surface. There is no public API for starting shifts, fetching bundles, running trials, or submitting results.
- The player's real work happens locally: ingest the evidence bundle, infer hidden board behavior, generate a routing policy, use one Trial Shift if desired, then Go Live.
- The product is public to browse, but official play is attributed. Anyone can view the landing page, leaderboard, and public Shift Reports; starting a shift requires GitHub sign-in.
- The product speaks mostly in-world. Plain language appears only where needed to make the challenge legible to first-time users.

## Core Product Definition
- Each official attempt is called a Shift.
- Every Shift is session-specific. The board is generated from a hidden seed and differs per run, but the variation is not labeled as a public mode or named condition.
- A player may start repeatable Shifts over time, but may only have one active Shift at once.
- The public leaderboard records only a player's best official live result.
- Wall-clock speed is operationally important because the Shift expires, but it is not a public ranking dimension and is not shown on the leaderboard.
- The core fantasy remains literal: calls arrive, lines have visible live state, premium trunk lines are scarce, and the operator must decide whether to connect now or send to hold.

## Canonical Player Flow
1. Visitor lands on Firecrawl Exchange, reads the premise, browses the leaderboard, and sees public Shift Reports.
2. Player signs in with GitHub.
3. Player starts a Shift and immediately receives a session-specific evidence bundle.
4. Phase 1 begins: 5 minutes for bundle inspection, local agent execution, code generation, and optional use of the single Trial Shift.
5. If the Trial Shift is used, the player receives terse operational feedback and a short readable failure log.
6. Phase 2 begins automatically when the first 5 minutes end: 2 final minutes for revision and final submission only. No trial is available in this phase.
7. Player clicks Go Live or reaches expiry.
8. If valid code exists, the system evaluates the latest valid module and returns the canonical result.
9. The player receives a styled Shift Report and the leaderboard updates if this was their best run.

## Shift State Model
- `Public`: unauthenticated user browsing the challenge.
- `Ready`: authenticated user with no active Shift.
- `Active / Phase 1`: countdown running, evidence available, one Trial Shift available.
- `Active / Phase 2`: countdown running, no Trial Shift available, finalization only.
- `Evaluating`: Go Live accepted; canonical result is being computed.
- `Completed`: final result available; public Shift Report created.
- `Expired / No Result`: Shift ended with no valid module available for final evaluation.
- Reload or disconnect does not pause a Shift. The server clock is canonical, and the player may resume the active Shift until it expires.
- Starting a new Shift while one is active is rejected.

## Evidence Bundle
- The bundle always contains exactly four artifacts: `manual.md`, `starter.js`, `lines.json`, and `observations.jsonl`.
- `manual.md` explains the world, the rules, call types, hold behavior, visible line fields, and submission contract.
- `starter.js` is weak but valid, so every player begins with an executable baseline.
- `lines.json` contains only coarse visible line metadata and class tags, including premium trunk status.
- `observations.jsonl` is the large artifact. It is the main anti-manual-play mechanism and the main source of inferential signal for the local agent.
- The bundle is available only during the active Shift.
- After the Shift ends, the bundle is no longer accessible. Only the final Shift Report remains publicly viewable.

## Operator Contract
- The submitted artifact is one JavaScript function: `connect(call, lines)`.
- The function returns `{ lineId: string | null }`.
- Returning `null` explicitly sends the call to the automatic hold queue.
- There is no lifecycle API like `openBoard` or `log`, and no supported persistent state across calls.
- The policy is intentionally pure at runtime. Learning and adaptation are expected to happen before submission through evidence analysis and the Trial Shift.
- Invalid module shape or syntax is rejected immediately before evaluation.
- Invalid modules do not consume the Trial Shift budget.
- Final Go Live requires a valid module. If the current draft is invalid, the player may continue editing until expiry.

## Board Logic And Hidden Truth
- The four v1 call types are `local`, `person-to-person`, `long-distance`, and `collect`.
- Hold is automatic. The player chooses whether to connect now or defer to hold; the system manages hold aging and drop behavior.
- The primary hidden truths are:
- Hidden line affinity by call type.
- Hidden line reliability and failure tendency when given the wrong traffic.
- Premium trunk lines are visibly marked and are a real mechanic. Good operators preserve them for calls that justify them rather than wasting them on low-value traffic.
- Live `lines` input exposes operational state and visible class tags only. It does not expose direct performance scores, historical success rates, or error-rate counters.
- Different seeds should meaningfully change traffic mix and board pressure, but that variation stays hidden inside the fiction rather than being surfaced as selectable modes.

## Trial Shift
- Each official Shift allows exactly one Trial Shift.
- The Trial Shift is only available during the first 5-minute phase.
- If unused by the end of Phase 1, it is lost.
- Trial output is operational, not benchmark-shaped. It includes:
- A coarse status such as stable, strained, or breaking.
- A compact metrics block.
- A short readable failure log describing sampled failure modes.
- The Trial Shift never returns the hidden scalar score.
- The Trial Shift never produces a public Shift Report.
- Once a valid Trial request has been accepted by the server, the trial is considered spent even if the client loses the response due to timeout or network failure.

## Final Live Result
- Final evaluation happens exactly once per Shift.
- The player may trigger it manually with Go Live, or the system may auto-submit the latest valid module at expiry.
- Auto-submit uses the most recent valid module only.
- If no valid module exists at expiry, the Shift ends with no final result and no leaderboard update.
- Final evaluation produces the canonical result for that Shift.
- If the final evaluation request is accepted but the client loses the response, reloading returns the resolved result once available.
- The final result creates a public-by-URL Shift Report.
- Trial logs are not public and are not preserved after the Shift.
- The final report persists; the live board UI, evidence bundle, and trial details do not.

## Scoring, Titles, And Leaderboard
- The hidden final score is a normalized composite score optimized for connection quality.
- It rewards successful connections and penalizes dropped calls, excessive hold time, and misuse of premium trunk lines.
- The hidden final score determines rank.
- The hidden final score also determines titles.
- Visible leaderboard metric is board efficiency percentage, derived from `callsConnected / totalCalls` and rounded for human display.
- The public leaderboard shows username, title, and board efficiency percentage.
- Tie-breaking uses higher board efficiency first, then earlier achievement time if still tied.
- Title bands:
- Chief Operator: score > 0.90
- Senior Operator: score > 0.75
- Operator: score > 0.60
- Trainee: score > 0.45
- Off the Board: score <= 0.45
- The hidden scalar score itself is never shown to players.

## Shift Report
- The Shift Report is the primary share artifact and the public proof of a cleared Shift.
- It is period-authentic in tone and layout.
- It includes identity, Shift ID, title, key operational metrics, and overall board performance.
- Its language should feel ceremonial and status-bearing.
- The final report's supervisor note is pure flavor, not prescriptive guidance.
- It may echo success or failure mood, but it should not explain the player's underlying policy mistake.
- Trial feedback is where readable failure modes live; the final report is for public status and shareability.

## Platform And Access Rules
- Official play is desktop-only.
- Mobile users may browse the landing page and public Shift Reports, but may not start or play a Shift.
- Submission is paste-only. There is no file upload.
- There is no public player profile surface beyond leaderboard identity and public report links.
- There is no public API surface.
- The browser is intentionally low-comfort and should never feel like a hosted IDE.

## Failure And Edge-Case Semantics
- A signed-out user attempting to start a Shift is redirected into GitHub sign-in.
- A signed-in user with an active Shift attempting to start another receives a clear rejection and resume path.
- Reloading or opening a second tab resumes the same active Shift rather than creating a new one.
- Invalid syntax or invalid module shape returns an immediate validation error and does not spend the trial.
- Trial requests are rejected in Phase 2.
- Go Live with invalid code is rejected immediately; the player may correct and retry until expiry.
- If the user never produces valid code, the Shift expires with no report and no leaderboard change.
- If network loss happens before the server accepts a trial or final request, no attempt is spent.
- If network loss happens after server acceptance, the request is canonical and the resumed session should show the resulting state.
- Public reports remain accessible after completion, but the underlying evidence and trial artifacts do not.

## Internal Scope We Will Need To Build
- Public landing experience with challenge framing and leaderboard.
- GitHub-authenticated Shift start flow.
- Active Shift page with timers, evidence viewer, paste submission surface, Trial Shift action, Go Live action, and reconnect behavior.
- Seeded board generator and seeded evidence-bundle generator.
- Runtime board simulator for trial and final evaluation.
- Static module validator and sandboxed policy evaluator.
- Trial evaluator and failure-log generator.
- Final result evaluator and report generator.
- Hidden composite scoring engine, title assignment, leaderboard ranking, and tiebreak logic.
- Public Shift Report route with share-ready rendering.
- Session persistence, reconnect logic, one-active-shift enforcement, and auto-submit-on-expiry behavior.
- Minimal internal admin surface for run lookup, trace inspection, leaderboard inspection, and report lookup.
- Stored traces for accepted trials and finals, including enough data to debug disputes, failures, and suspicious behavior.

## Acceptance Scenarios
- A new visitor can understand that Firecrawl Exchange is a coding challenge for local agents, not a browser puzzle.
- A player can complete the full loop from sign-in to Shift Report without needing any hidden documentation.
- Manual browsing alone feels obviously insufficient compared to using a prebuilt local agent system.
- A naive "first free line" policy performs meaningfully worse than a policy derived from evidence.
- The single Trial Shift is useful for debugging but insufficient for benchmark-style hill climbing.
- The final public result feels prestigious and screenshot-worthy.
- Two players with equal hidden score can still be ranked consistently.
- Disconnects, reloads, and accepted-request network failures resolve predictably and without loopholes.
- The challenge remains legible, themed, and high-status without requiring a full season model or a rich IDE.

## Assumptions And Defaults
- The challenge is coding-centered and always ends in code submission, never prose or config alone.
- Hidden seeded variation is part of the challenge's robustness signal but is not surfaced as a named feature to the player.
- The high-level spec fixes the product behavior, flow rules, public artifacts, and failure semantics above.
- Later low-level specs can define implementation details such as exact payload fields, persistence schema, simulator internals, and the precise hidden score formula, but they must not change the player-facing rules established here.
