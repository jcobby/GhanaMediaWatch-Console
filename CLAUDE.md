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
API contract (`API_CONTRACT.md`, plus `BACKEND_SPEC.md` which supersedes it), and the
original home of the shared logic. Read it before making decisions that must match.
**Do not duplicate its logic — share it.**

### Hand-synced across both repos

`NewsSection` is declared twice — here in `packages/core/src/types/api.ts` and on the phone
in `src/types/sections.ts` — because the mobile app does not consume `@dawuro/core`. The
values **and their order** must stay identical; `packages/core/src/__tests__/sections.test.ts`
pins them, and mobile's `src/features/feed/__tests__/sections.test.ts` pins the other side.
A desk added to one and not the other gives a tab that exists in one client and not the
other, which reads as data loss.

**A desk is not a category.** `category` is filed by the reporter and decides routing,
commission and the editorial queue; `section` is chosen by an editor at release and decides
only where the story appears. Never derive one from the other. A report released with no
desk does not appear in the mobile feed at all — silently, with no error — which is why
`/published` makes the desk part of the release rather than a setting elsewhere.

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

## Accounts

Sign-in goes to the live backend (`POST /auth/login`, email + password). The seeded demo
accounts no longer work — they do not exist on the server. `/login` still lists the roles,
labelled as a reference rather than as logins.

**Never authenticate through `POST /auth/signin`.** It takes an email with no password and
mints a token for whoever asks. It is used nowhere in this console, and using it for a
sign-in would mean anyone who knows an operator's address can release payouts.

Organisation and platform roles are granted server-side; there is no self-service path to
them, so a fresh account is a reporter and lands on `/no-console`.

## State

**Reads are wired; writes are not.** Every page reads the API through
`src/lib/consoleApi.ts`, catches failure with `load()` and renders `<Outage>`.
There is no fixture fallback anywhere in `src/app`.

Only three things write: sign-in, registration, and the routing desk
(`/api/routing/[incidentId]` — route, or release to the public feed). Every
other action button is React state: the row moves and nothing is sent. Those
screens carry `<NotWired>`, and `src/__tests__/wiring.test.ts` fails if a
consequential screen neither saves nor warns — or still warns after it starts
saving.

Verified against the live backend: sign-in, registration, `/me/*`, the public
directory, `/verify`, and the routing desk's own guards. Everything under
`/org`, `/platform` and `/editorial` is unverified — no account this machine can
create holds those roles, so they have only been exercised against a backend
that refuses them, where they correctly render the outage.

### Known backend gaps

- **Organisation sign-up goes through the backend.** `/auth/register` with
  `accountKind: "organisation"` creates a pending organisation; `/onboarding`
  reads and writes `/org/onboarding/*`; `lib/onboarding.ts` normalises its
  undocumented shape. A pending organisation may call only onboarding
  (`check: "org_pending"`), and `/me` marks it `verified: false`, which keeps the
  session on `/onboarding`. The console keeps no applications or documents on
  disk. **Onboarding documents are recorded by name and SHA-256 only** — the
  service stores no bytes yet (BACKEND-REQUESTS.md item O).
- **`POST /auth/signin` takes an email with no password** and mints a token for
  whoever asks. Never authenticate through it.
- No endpoint describes the caller — no `GET /me`, and the token carries no org
  or role. `lib/auth.ts` infers the account type by probing two reads; delete
  `describeCaller` when a real one lands.
- `/platform/routing`, `/editorial/queue` and `/org/inbox` publish **no response
  schema**. `lib/collection.ts` reads any unambiguous wrapper and throws on one
  it cannot, so a shape mismatch can never render as an empty queue;
  `lib/normaliseRouting.ts` reconciles the incident vocabulary the routing queue
  actually returns with the `RoutingItem` the desk expects.
- `/platform/routing/{id}/recipients` and `/editorial/{id}/transition` document
  no request body. The desk sends its best reading and shows the server's own
  error, because that error is the only specification available.
- No platform metrics endpoint, no public `GET /invites/{token}`.
