# Firecrawl Exchange

Firecrawl Exchange is a coding challenge app built around a simulated 1960s telephone exchange. Players sign in with GitHub, start a timed Shift, inspect a generated evidence bundle, submit a JavaScript routing policy, use up to two probes, and finally go live. Each completed Shift produces a public report, while admins can review candidate performance and optionally generate LLM-written summaries.

## Quick overview

The repo is split into a few clear layers:

- `src/app`: Next.js App Router pages and route handlers.
- `src/features`: feature slices for landing, active shifts, public reports, and admin.
- `src/core`: shared domain logic, simulator code, scoring, and policy execution.
- `convex`: persistence, real-time queries/mutations/actions, auth config, and runtime state.
- `auth.ts`: Auth.js v5 GitHub sign-in plus the JWT bridge used by Convex.

At a high level, the system works like this:

1. A user lands on the marketing page and signs in with GitHub.
2. Auth.js creates the web session and signs a Convex JWT for the client.
3. The active Shift UI talks directly to Convex for live state, probes, saves, and final runs.
4. Server-rendered pages and admin reads use a privileged Convex HTTP client.
5. Completed runs are exposed as public Shift reports.

## Main product surfaces

- Landing page: `src/app/page.tsx`
- Active Shift UI: `src/app/shift/[shiftId]/page.tsx`
- Public report: `src/app/report/[publicId]/page.tsx`
- Admin board: `src/app/admin/page.tsx`

## Stack

- Next.js 16
- React 19
- Auth.js v5 with GitHub OAuth
- Convex for persistence and live app state
- QuickJS for validating and executing submitted routing policies
- Vitest and Playwright for test coverage

## Local development

Install dependencies, create a local env file, and start the app:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Useful commands:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run typecheck
npm run test:e2e
```

Open [http://localhost:3000](http://localhost:3000) after `npm run dev`.

## Agent scripts

The `scripts/` directory contains offline benchmark agents and evaluation harnesses for the exchange simulator. These scripts verify that the game is properly balanced and serve as reference implementations for policy generation.

### Script architecture

The agent code is organized in three layers:

| File | Role |
| --- | --- |
| `scripts/exchange-agent-common.mjs` | Shared constants and utility functions (importable) |
| `scripts/exchange-agent-models.mjs` | Artifact parsing, observation-based model inference, prior aggregation |
| `scripts/exchange-agent-runtimes.mjs` | Decision logic, agent state, and QuickJS policy source generation |
| `scripts/v3-agent-policies.mjs` | Public API — re-exports and convenience wrappers |
| `scripts/benchmark-runner.mjs` | Shared benchmark runner with summary statistics |

Runner and evaluation scripts:

| Script | Command | What it does |
| --- | --- | --- |
| `run-baseline-agent.mjs` | `npm run agent:baseline` | Snapshot baseline (target: 25-35%) |
| `run-hiring-bar-agent.mjs` | `npm run agent:hiring-bar` | Artifact-driven hiring-bar agent (target: 75-85%) |
| `eval-hiring-bar-agent.mjs` | `npm run agent:hiring-bar:eval` | Per-seed JSON metrics for the hiring-bar agent |
| `eval-oracle-agent.mjs` | `npm run agent:oracle:eval` | Perfect-information oracle as upper bound |
| `eval-meta-learning-agent.mjs` | `npm run agent:meta-learning:eval` | Warm-start vs artifact-only on holdout seeds |
| `run-user-flow-agent.mjs` | `npm run agent:user-flow` | End-to-end flow against a live Convex deployment |

Utility scripts:

| Script | Purpose |
| --- | --- |
| `ts-path-loader.mjs` | Node.js loader hook resolving `@/` and `.ts` imports for offline scripts |
| `generate-convex-auth-keys.mjs` | Generates RSA keypair for Convex JWT auth |

### Running benchmarks

Quick verification (no infrastructure required):

```bash
npm run agent:baseline        # Should print average ~25-35%
npm run agent:hiring-bar      # Should print average ~75-85%
```

See [docs/benchmarks.md](docs/benchmarks.md) for the full benchmark guide and [docs/engine-config.md](docs/engine-config.md) for tuning the simulator based on benchmark results.

## Deployment

This app has two runtimes that must be configured together:

- Next.js runtime: hosts the UI, Auth.js session handling, and admin/server helpers.
- Convex runtime: hosts the database, real-time API, runtime actions, and custom JWT validation.

You will deploy both and wire them together with matching auth settings.

### 1. Create the external services

- Create a Convex deployment.
- Create a GitHub OAuth app for sign-in.
- Deploy the Next.js app to your preferred host.

For the GitHub OAuth app, the callback URL should be:

```text
https://<your-app-domain>/api/auth/callback/github
```

### 2. Configure environment variables

Set your own values in your deployment platform.

#### Next.js runtime variables

These are required for the web app and server code:

- `NEXT_PUBLIC_CONVEX_URL`
  Convex deployment URL used by both browser and server code.
- `AUTH_GITHUB_ID`
  GitHub OAuth client ID.
- `AUTH_GITHUB_SECRET`
  GitHub OAuth client secret.
- `AUTH_SECRET`
  Secret used by Auth.js to encrypt/sign session data.
- `ADMIN_GITHUB_LOGINS`
  Comma-separated GitHub usernames allowed to access `/admin`. Must be set in **both** Next.js and Convex environments — Next.js uses it to guard the route handler, Convex uses it to guard server-side admin queries.
- `CONVEX_AUTH_PRIVATE_KEY`
  RSA private key used by `auth.ts` to sign Convex JWTs for authenticated users.
- `CONVEX_ADMIN_KEY`
  Preferred server-side admin key for trusted Next.js reads, mutations, and actions.

#### Convex runtime variables

These are required in the Convex environment:

- `CONVEX_AUTH_JWKS`
  JWKS JSON containing the public key that matches `CONVEX_AUTH_PRIVATE_KEY`.
- `ADMIN_GITHUB_LOGINS`
  Same value as the Next.js variable — Convex needs its own copy to guard server-side admin queries.

Optional admin-only variables:

- `OPENAI_API_KEY`
  Required only if you want the admin summary generation endpoint to call OpenAI.
- `JUDGE_MODEL`
  Optional model override for admin summaries. Defaults to `gpt-5-mini`.

### 3. Keep Auth.js and Convex auth aligned

This repo uses a custom JWT provider for Convex auth. The keypair must match across both runtimes:

- Next.js signs user JWTs with `CONVEX_AUTH_PRIVATE_KEY`.
- Convex verifies those JWTs with `CONVEX_AUTH_JWKS`.

If you change issuer or audience behavior in auth-related files, update both:

- `auth.ts`
- `convex/auth.config.ts`

### 4. Build and run

For a standard Next.js deployment:

```bash
npm run build
npm run start
```

Convex should be deployed separately using your normal Convex deployment workflow.

## Important paths

- `src/features/landing/client/ConvexAuthProvider.tsx`: bridges Auth.js sessions into `convex/react`
- `src/features/shift/client/convex-api.ts`: main live client API surface for Shift actions
- `src/features/shift/server/index.ts`: server-side Shift entrypoints
- `src/server/convex/client.ts`: privileged and public Convex HTTP client helpers
- `convex/schema.ts`: persistence model
- `convex/sessions.ts`: Shift lifecycle queries and actions
- `convex/shiftRuntime.ts`: probe and final run execution
- `convex/admin.ts`: admin queries and summary persistence
- `convex/adminAgent.ts`: OpenAI-backed candidate summaries

## Notes

- The active gameplay experience is designed for desktop.
- The live Shift UI talks directly to Convex rather than through Next.js route handlers.
- The admin summary feature is optional and only works when `OPENAI_API_KEY` is configured.
