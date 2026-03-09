# Architecture

The refactor split the app into five clear layers:

- `src/app/*`: App Router pages, layout, and the small remaining Next route handlers.
- `src/features/*`: slice-owned UI, view shaping, and server helpers for `landing`, `shift`, `report`, and `admin`.
- `src/core/*`: pure domain and engine code. No Next.js, React, or Convex runtime imports.
- `src/server/*`: server-only infrastructure adapters such as Auth.js helpers and the server-side Convex client.
- `convex/*`: persistence, schedulers, auth config, and backend actions/queries/mutations.

## Dependency Rules

- `src/app/*` should import feature entrypoints and minimal server helpers only. It should not reach into Convex internals directly.
- `src/features/**/client/*` should depend on same-slice hooks/components plus `src/core/*`. Keep generated Convex refs isolated behind client adapters such as `src/features/shift/client/convex-api.ts`.
- `src/features/**/server/*` may import `src/core/*`, `src/server/*`, and same-slice domain modules.
- `src/server/*` may talk to Convex and Auth.js, but should stay React-free.
- `src/core/*` stays framework-agnostic. No `next/*`, `react`, `react-dom`, or `convex/*` imports.
- `convex/*` may import `src/core/*` and selected feature-domain shaping code, but must not import Next.js modules.

## Transport And Auth Split

- Auth starts in `auth.ts` with GitHub OAuth. Successful sessions are enriched with a signed Convex JWT.
- `src/features/landing/client/ConvexAuthProvider.tsx` hands that JWT to `convex/react` so browser clients can call authenticated Convex functions directly.
- Server-rendered pages and admin helpers use `src/server/convex/client.ts`, which authenticates with `CONVEX_ADMIN_KEY`.
- The live Shift console now runs through direct Convex hooks:
  - `api.shiftActions.startShift`
  - `api.shiftActions.saveDraft`
  - `api.shiftActions.validateDraft`
  - `api.sessions.requestProbe`
  - `api.sessions.requestGoLive`
  - `api.sessions.getArtifactContent`
- The remaining Next route handlers are intentionally small:
  - `src/app/api/auth/[...nextauth]/route.ts`
  - `src/app/api/admin/generate-summary/route.ts`
- `convex/http.ts` also exposes an authenticated `/api/artifacts` endpoint for HTTP artifact delivery and compatibility flows.

## Current Slice Boundaries

- `src/features/landing/*` owns the hero, session controls, live leaderboard bootstrap, and the shared Convex auth provider used by interactive pages.
- `src/features/shift/*` owns the active Shift console, client hooks/selectors, lifecycle rules, and browser-safe view shaping. Start/save/validate live in `convex/shiftActions.ts`; probe/final scheduling lives in `convex/sessions.ts` and `convex/shiftRuntime.ts`.
- `src/features/report/*` owns public report rendering plus the gated contact capture flow for strong scores.
- `src/features/admin/*` owns the leaderboard-style candidate board, detail drill-down, and summary trigger UX.

## Convex Backend

- `convex/schema.ts`: source of truth. Tables: `shifts`, `reports`, `leaderboardBest`, `leaderboardMeta`, `contactSubmissions`, `candidateSummaries`.
- `convex/auth.config.ts`: custom JWT provider config for Convex auth.
- `convex/shiftActions.ts`: start/save/validate actions, including QuickJS validation.
- `convex/sessions.ts`: current shift queries, reactive artifact reads, probe/final submission, and run lifecycle mutations.
- `convex/shiftRuntime.ts`: scheduled probe/final execution and final report materialization.
- `convex/reports.ts`: public report query plus admin lookup.
- `convex/contactSubmissions.ts`: authenticated report contact mutations.
- `convex/admin.ts`: paginated candidate queries and summary persistence.
- `convex/adminAgent.ts`: `'use node'` action that calls OpenAI for candidate summaries.
- `convex/convex.config.ts`: registers `@convex-dev/agent`.

## Current State

- Feature-specific UI lives under its owning slice; App Router files are mostly thin composition wrappers.
- Hidden score is stripped before browser exposure in `convex/records.ts`, `src/core/domain/normalizers.ts`, and `src/features/shift/domain/view.ts`.
- The old `src/app/api/shifts/*`, `src/app/api/contact/route.ts`, and the earlier `src/features/shift/server/*` command/resolver wrappers were removed from the active app path.
- Admin remains server-rendered with query-param routing: `/admin` for the table, `/admin?candidate=<github>` for detail.
