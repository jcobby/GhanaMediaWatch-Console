# Dawuro Console

Web console for the Dawuro platform — the surface where organisations review the reports
routed to them, and where platform operators oversee routing, approvals and payouts.

Reporting itself lives in the Expo mobile app. This console deliberately has no reporter
experience: capture depends on a camera, an accurate GPS fix, and an offline queue.

## Running it

```bash
npm install
cp apps/console/.env.example apps/console/.env.local   # then set SESSION_SECRET
npm run dev
```

Open http://localhost:3000. Sign in with any demo account listed on the page; the password
is `dawuro`, and platform operators also need the access code `DAWURO-2026`.

## Layout

| Path | What it is |
| --- | --- |
| `packages/core` | Shared business rules — routing, commission, permissions, surveys. 81 tests. |
| `apps/console` | The Next.js console. |

`packages/core` is pure TypeScript with no React, React Native or DOM dependency, so the
phone app and this console compute identical answers from identical inputs. That matters
most for money: the commission a reporter is quoted and the amount a business is billed
come from one function, not two that agree today.

## Verifying

```bash
npm run verify     # typecheck + lint + tests across both workspaces
```

## What is built

Shared core, sign-in with role gating, both console shells, the business report inbox,
the platform routing desk, and the operator dashboard.

Stubbed and clearly marked as such: published reports, surveys, team management, account
and billing, business approvals, payouts, and organisation management.
