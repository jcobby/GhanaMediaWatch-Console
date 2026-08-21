# Dawuro Console (web)

## Product

Dawuro is a Ghanaian incident-reporting SaaS. Members of the public film incidents on a
phone; reports are auto-routed to organisations (government agencies, media houses) whose
declared interests match; those organisations license reports, which pays the reporter a
commission, and may then release a report to the public feed credited to themselves.

Three roles: **reporter** (mobile only), **business**, **platform owner**.

This repo is the **web console for business and platform owner only**. Reporters never use
the web — camera, GPS gating and offline capture are the product and stay on the phone. A
reporter who signs in here lands on `/no-console`, which explains why.

## Related repo

Expo mobile app: `c:\Users\Softmasters\Desktop\GhanaMediaWatch`

It holds the design tokens (`global.css`, `tailwind.config.js`, `src/lib/theme.ts`), the
API contract (`API_CONTRACT.md`, 19 endpoints), and the original home of the shared logic.
Read it before making decisions that must match. **Do not duplicate its logic — share it.**

## Layout

```
packages/core     Shared business rules. No React, React Native, Next, or DOM.
apps/console      Next.js App Router console.
```

`packages/core` holds routing, commission, permissions and survey validation, with their
81 tests. It is the reason the console and the phone compute identical answers — most
importantly for money. Anything touching a camera, filesystem, network or screen does not
belong in it.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · TanStack Query/Table · Zustand ·
react-hook-form + zod · jose. **npm workspaces — not pnpm or yarn.**

## Architecture

Two route groups, `(business)` and `(platform)`, each with its own layout and sidebar.
Route groups are a filesystem convention and do not appear in the URL — `(business)/inbox`
serves `/inbox`. `src/middleware.ts` gates by URL prefix, so those two must be kept in
step by hand.

Auth is a signed JWT in an **httpOnly cookie**, so browser JS can never read it. Token
primitives live in `src/lib/token.ts` with no Node dependency, because middleware runs on
the edge runtime and must verify sessions with exactly the same code the server uses.

When the backend lands, its access token is stored *inside* the session server-side and
attached by route handlers under `src/app/api/`. The browser must never see it.

## Non-negotiables

- **All money is integer pesewas.** Never floats, never client-side rounding.
- **Never silently fall back to fixtures** when the API is unreachable. An outage must look
  like an outage.
- Shared rules are imported from `@dawuro/core`, never reimplemented.
- **Never pass a component function across the RSC boundary.** Server layouts pass icon
  *names*; `src/components/shell/icons.ts` resolves them client-side. Passing the component
  fails at runtime with an opaque digest, not at build time.
- Every change ends with typecheck, lint and tests passing.

## Commands

From the repo root:

```
npm run dev        # console on :3000
npm run build      # production build
npm run verify     # typecheck + lint + test, all workspaces
npm test           # core's 81 tests
```

`apps/console/.env.local` needs `SESSION_SECRET` (32+ chars). See `.env.example`.

## Demo accounts

Password for all: `dawuro`. Platform operators also need access code `DAWURO-2026`.

- `ops@ama.gov.gh` — business, inbox near its monthly allowance
- `newsroom@joynews.gh` — business, media house
- `owner@dawuro.gh` — platform operator
- `ama@example.gh` — reporter, lands on `/no-console` by design

## State

Built: shared core, auth and role gating, both shells, the business inbox, the routing
desk, the platform console.

Stubbed: `/published`, `/surveys`, `/team`, `/account`, `/platform/approvals`,
`/platform/payouts`, `/platform/businesses`.
