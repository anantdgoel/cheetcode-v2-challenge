# Architecture

Firecrawl Exchange now organizes code around three roots:

- `src/features/*`: user-facing slices. Each slice owns its feature entrypoints and any client/server modules that are specific to that workflow.
- `src/core/*`: pure domain and engine code. These modules do not import Next.js, React, or Convex.
- `src/server/*`: infrastructure adapters such as auth helpers, Convex clients, and HTTP-only helpers.

## Dependency Rules

- `src/app/*` imports feature entrypoints and minimal auth/request helpers. It should not import Convex clients directly.
- `src/features/**/client/*` imports from `src/core/*` and same-slice client modules. It must not import `src/server/*` or Convex adapters.
- `src/features/**/server/*` may import `src/core/*`, `src/server/*`, and same-slice domain modules.
- `src/core/*` stays framework-agnostic. No `next/*`, `react`, `react-dom`, or `convex/*` imports.

## Current Slice Boundaries

- `src/features/shift/*` owns shift lifecycle/domain rules, shift server commands/queries/artifacts, and the active console client.
- `src/features/landing/*` and `src/features/report/*` own both their page UI and server reads.
- `src/features/admin/*` owns the admin candidate board, candidate detail drill-down, LLM summary generation, and server queries. Client components: `AdminTableView.tsx` (paginated table), `AdminDetailView.tsx` (profile, score progression, LLM assessment, shift history with expandable policy code).

## Convex Backend

- `convex/schema.ts`: source of truth. Tables: `shifts`, `reports`, `leaderboardBest`, `leaderboardMeta`, `contactSubmissions`, `candidateSummaries`.
- `convex/admin.ts`: admin-specific queries — `getCandidates` (paginated from `leaderboardBest`), `getCandidateDetail` (aggregates leaderboard, shifts, contact, summary), `upsertSummary`.
- `convex/adminAgent.ts`: `'use node'` action — calls OpenAI to generate structured candidate assessments. 60-second throttle per candidate. Uses `OPENAI_API_KEY` and optional `JUDGE_MODEL` env vars.
- `convex/convex.config.ts`: registers `@convex-dev/agent` component.

## Current State

- Feature-specific page UI now lives inside its owning feature slice under `src/features/*/client`.
- Shared pure helpers live in `src/core/*`.
- Server-only request helpers and Convex transport live in `src/server/*`.
- The old `src/lib/*`, `src/components/*`, and repository wrapper compatibility layers have been removed from active use.
- Admin dashboard uses server-side rendering with query-param routing (`/admin` for table, `/admin?candidate=X` for detail).
