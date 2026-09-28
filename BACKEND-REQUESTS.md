# What the Dawuro backend needs, in priority order

For the backend developer.

**Re-verified on 16 September 2026** against `/v1/openapi.json`, re-pulled at
about 11:05 after the service came back — so this reflects what you deployed
during the morning, not the earlier snapshot. Every field and route named below
was read out of that document rather than inferred. Where something can only be
settled by calling the service — whether an email actually arrives, whether a
projection really sends a field — it is marked as needing confirmation rather
than claimed.

**Thank you — most of this list has now shipped.** Round five cleared B, F, H, M,
Q and **S** outright, and moved E, K, N, R and T a long way. What follows is only
what is left, which is now a short list.

**Items U and V were asked for on 28 September and answered the same day —
thank you.** Both are now ✓ and both are connected, or being connected, on the
phone. Re-checked against `/v1/openapi.json` at 11:30 on 28 September (147
paths, up from 139) and exercised end to end against a real registration:

```
POST /auth/register  { accountKind: "blogger" }        -> 201
GET  /me            -> accountKind "blogger", verified false
GET  /me/verification -> pva_…, ONB-PER-…, steps {}, missingDocuments [...]
GET  /me/payout-method -> { kind: null, momo: null, bank: null }
```

Two notes from doing that, neither a defect:

1. **`POST /auth/register` requires an `Idempotency-Key` header** and answers
   `VALIDATION_FAILED "Idempotency-Key header is required."` without one. That
   is the right call for a money-adjacent write and the app already sends one;
   it is recorded here because it is not in the endpoint's parameter list.
2. **`missingDocuments` names an alternative group**, `utility_bill_or_premises_proof`,
   rather than a document type. Good — it is exactly the "either satisfies it"
   rule §9.3 describes — but it means a client cannot treat the list as types to
   upload without splitting on `_or_` first. Worth one line in the schema
   description so the next client does not learn it the hard way.

## ★ Everything still needed — the only list to work from (17 September, after round six; U and V added 28 September)

**This section is complete.** It was written by checking every mobile screen and
every console page against `/v1/openapi.json`. Anything already done is not
repeated here except as a ✓ row, so the list stays short. Everything further down
this file is history, kept for the detail behind each request.

**We are still testing.** Nothing here is about going live yet. Everything is
asked for on the current test service (the dev tunnel), so the phone and the
console can be tested end to end. What will only matter before going live is
kept in one short note at the end of item A, marked "not needed now".

Priority: **P0** blocks testing the full flow · **P1** a feature waits on it ·
**P2** documentation the clients currently guess at · **✓** done · **◐** partly
done, with what remains named in the item.

| # | Priority | What |
|---|---|---|
| A | P0 | The service was silent from about 10:00 to 11:00 on 16 September — back now. Plus rate limits and a stable address |
| B | ✓ | Confirmed live: `/v1/incidents` answers 200 with no `Authorization` header |
| C | P0 | Email delivery, and the link format in each email |
| D | P0 | Push notifications delivered automatically, iOS and Android |
| E | ◐ | `payoutStatus`, `heldReason` and `/me/payout-msisdn` shipped. The provider sandbox is still needed |
| F | ✓ | `publisher` and `reporter` are required on `PublicIncident` — please confirm every projection sends them |
| G | ✓ | Organisations send reports to the editor to publish — shipped, connected on 15 September |
| H | ✓ | Comments carry `isAnonymous`, `media` and a typed `author`. Only comment reactions are left, and they were optional |
| I | P1 | Confirm the photo served as an MP4 is fixed |
| J | P1 | The integrity check still flags captures six hours old |
| K | ✓ | `AuthorKind` is named: `account` \| `device`. That is exactly the distinction the desk needed |
| L | P1 | Clear error codes on the money and account actions |
| M | ✓ | Every write operation now publishes a request body — all 163 of them |
| N | ◐ | 30 reads still answer 2xx with no schema, down from 45 — the count ticked up because the new routes arrived without one |
| O | ✓ | Onboarding documents: upload and review both landed, and both are connected |
| P | ✓ | Rejecting a whole application landed, with the reason shown to the applicant |
| Q | ✓ | The two test organisations are gone, and `POST /org/onboarding/steps/{stepId}` exists |
| R | ◐ | Enums named, response timeline added, desk required on publish. Two left: raising a membership request, and the licence state on `/org/inbox` |
| S | ◐ | Category and fields all landed. `location.label` is resolved but coarse, and `plusCode` is not returned |
| T | ✓ | Platform rates, `/org/commission-offer` and `commissionOffer` on the public directory — the whole item |
| U | ✓ | A `blogger` account kind and person verification — **shipped, and connected on 28 September** |
| V | ✓ | `/me/payout-method` with momo **and** bank — shipped; the phone still sends momo only (ours to finish) |
| W | P2 | A `country` on every incident and a `country` filter on `/incidents` — only if Dawuro is going beyond Ghana |
| X | P1 | `accountKind` on `/auth/google`, and a flag saying whether the account was just created |

---

### A. Keep the test service usable — P0

**The service stopped answering for about an hour on 16 September — roughly
10:00 to 11:00. It is back, and nothing needs doing about it now.** Recorded
because the shape of the failure is worth knowing if it happens again.

It is not the tunnel and it is not the address. A verbose request shows the
connection reaching `20.90.66.7:443`, TLS completing and even renegotiating —
and then **zero bytes for twenty seconds**. Every path behaves the same way,
including `/v1/health` and the public `/v1/organisations`, which needs no token.
A rate limit would answer 429 straight away and a crash would answer 500, so
this looks like the process behind the tunnel being down or wedged rather than
anything refusing us. Both clients show their outage screens correctly; there is
simply nothing to show.

- **Relax the rate limits on the test service.** About thirty requests in a few
  minutes currently locks a client out for over twenty minutes; one person
  opening the editorial desk makes that many, so testers lock themselves out.
- **Keep the test address stable**, and tell us before it changes — the phone
  and the console both have it configured.
- **`DAWURO_PUBLIC_BASE_URL`** set to the tunnel address, so every media URL is
  absolute.
- **Keep the test helpers available** while we test: `POST /org/checkout/{id}/complete`
  (marks a test checkout paid) is how invoices can be tested without real money.

**Done when** a tester can use the editorial desk and the phone for an hour
without being locked out.

**Later, before going live — not needed now:** a permanent HTTPS address instead
of the tunnel, media behind a CDN near Ghana, CORS limited to the console, and
the test helpers (`POST /auth/signin`, checkout completion) switched off. We will
raise these when testing is finished.

### B. Public content must be readable without signing in — ✓ done and confirmed

`/incidents`, `/incidents/{incidentId}`, `/newsroom/items`, `/incidents/map`,
`/settings` and `/organisations` declare no security, and **this was confirmed
against the running service on 16 September**: `curl` with no `Authorization`
header answers `200` on `/v1/incidents` and `/v1/health`. `/surveys` still
declares `bearerAuth`, which is exactly what we said was fine.

Nothing further is needed here. The "done when" this item set has been met.

The original request follows, for the record.

These are marked `bearerAuth` and answer 401 without a token:

```
GET /incidents
GET /incidents/{incidentId}
GET /newsroom/items
GET /incidents/map
GET /surveys
```

They serve **published, public** reports. They are read without an account by:
the console's `/verify` page (anyone checking a report reference someone sent
them), a report link shared on WhatsApp, and the console's Published page, which
lists what an organisation released. `/incidents/by-reference/{reportId}` and
`/organisations*` are already public, which makes the inconsistency visible:
a reference resolves, and the report it resolves to cannot be opened.

**What we need:** make the first four readable with no `Authorization` header
(a token, when sent, can still personalise `viewerHasReacted`). `GET /surveys`
may stay signed-in. **Done when** `curl https://…/v1/incidents` with no token
answers 200.

### C. Email delivery, and the link format — P0

`POST /auth/password/forgot`, email verification and organisation invites exist.
For testing:

- **Emails actually sent from the test service.** A test mail provider (Mailtrap,
  or a real sender with any domain) is fine — we need to receive them to test
  password reset, verification and invites.
- **Tell us the exact link in each email**, because both clients have to open it:
  - password reset — we propose `https://console.dawuro.com/reset-password?token=…`
    on the web, and `dawuro://reset-password?token=…` for the app
  - email verification — `…/verify-email?token=…`
  - organisation invite — `https://console.dawuro.com/invite/{token}` (the console
    already has this page)
- The reset and verification tokens' lifetime, so the screens can say how long a
  link lasts.

**Done when** a reset email from the test service arrives with a link that opens
the reset page.

### D. Push notifications delivered automatically — P0

`PUT /me/push-token` exists and the phone now calls it after sign-in.

- **Sending must not depend on calling `POST /platform/notifications/process` by
  hand.** Run it on a schedule or a queue on the test service, so testers
  receive notifications as they would for real.
- **iOS and Android send different tokens.** The phone sends the device's native
  token: an **FCM token on Android** and an **APNs token on iOS**. Please accept a
  platform with it — `{ "pushToken": "…", "platform": "ios" | "android" }` — and
  deliver to iOS through APNs (or FCM with an APNs key uploaded). Today an iOS
  token sent as if it were FCM will never deliver.
- **Document which events notify whom**, so the app can explain them in
  settings. Our expectation: a reporter is notified when their report is
  published, licensed, responded to by an organisation, and when a commission is
  paid; an organisation member when a report is routed to them.
- **Remove a token on sign-out** (`POST /auth/logout`) so a shared phone stops
  receiving the previous person's notifications.

**Done when** a report being published sends its reporter a notification on both
an iPhone and an Android phone, with nobody calling `process`.

### E. Mobile money payouts in the provider's sandbox — ◐ the client half shipped

**Done:** `GET /me/commissions` items now carry `payoutStatus`, `paidAt` and
`heldReason`, and `/me/payout-msisdn` exists with both `GET` and `PUT`. That is
everything the reporter's earnings screen needed, and it can be wired as soon as
the service answers again.

**Still needed:** the provider's sandbox itself — the part below that no schema
can show. A list of test numbers including one that fails, so a retry can be
tested.

`POST /platform/payouts/batches/{id}/release` and retries exist. For testing:

- **The mobile-money provider's sandbox connected** (for example MTN MoMo's
  sandbox), with its callback URL configured and a list of test numbers we can
  release to — including one that fails, so retry can be tested. No real money.
- **`GET /me/commissions` items carry the payout status**:
  `payoutStatus: "held" | "pending" | "sent" | "failed" | "paid"`, `paidAt`,
  and `heldReason` (for example "No payout number on file"). The reporter's
  earnings screen can then say "Paid" or "Add a payout number" instead of
  "Licensed".
- **`GET /me/payout-msisdn`** (or the number on `GET /me`), so the app can show
  the number already saved instead of an empty field.

**Done when** releasing a batch to a test number marks that reporter's commission
"paid" in `GET /me/commissions`.

### F. Every report carries a `publisher` — ✓ done in the schema

`PublicIncident` now lists both `publisher` and `reporter` in its `required`
array. The remaining question is one only the running service can answer:
whether every projection — `/incidents`, `/newsroom/items`, `/editorial/queue`,
`/editorial/decided`, `/editorial/leading`, `/org/inbox`, `/me/incidents` —
actually sends it. The phone keeps its "missing means anonymous" guard either
way, because a crash on a missing field is not a thing to re-risk.

Found on 15 September: a report on the Africa desk arrived with no `publisher`,
and the phone crashed reading it. `PublicIncident` marks `publisher` as required.
The phone now treats a missing one as anonymous, but please send it on every
projection — `{ "kind": "anonymous" }` at minimum — including `/incidents`,
`/newsroom/items`, `/editorial/queue`, `/editorial/decided`, `/editorial/leading`,
`/org/inbox` and `/me/incidents`.

### G. Organisations send reports to the editor to publish — done, thank you

Shipped, and connected on 15 September: the console's inbox has "Send to the
editor" on a licensed report (`POST /org/incidents/{id}/publish` with `section`
and `note`), and the editorial desk has a **Requests** tab
(`GET /editorial/publication-requests`,
`POST /editorial/publication-requests/{id}/decide`).

Two small asks so the screens can say more:

- On each item of `GET /editorial/publication-requests`, include the request
  itself — `publicationRequest: { note, section, requestedAt }` — so the editor
  sees the organisation's note and the desk it asked for.
- On `GET /org/inbox` (or `GET /org/incidents/{id}`), include
  `publicationStatus` (`awaiting_editor` / `approved` / `declined`) and the
  decline `reason`, so the organisation sees what happened to its request.

**These two are now blocking, and here is the reproduction.** On 17 September the
editorial desk's Requests tab was empty, and it will stay empty forever. The
endpoint is fine — the page rendered its empty state rather than an outage, so
`GET /editorial/publication-requests` answered correctly with nothing. The break
is on the organisation side, and it is the first ask above:

- `GET /org/inbox` items carry no `licensed` flag, and no `/org/*` endpoint lists
  what an organisation has licensed. So the console holds that state in the
  browser only. "Send to the editor" renders only on a licensed report, which
  means the panel exists solely in the tab where License was just clicked —
  **reload, and it is gone**, along with any way to create a publication request.
  No organisation can publish under its own name after a page load.
- Without `publicationStatus`, a request that *is* created disappears from view
  the moment the reporter navigates away. The confirmation ("Sent to the editor.
  Waiting for a decision.") is local state too.

So please add **`licensed: true` or `licensedAt`** on each `GET /org/inbox` item,
alongside `publicationStatus`. The console work is small once both arrive: seed
the licensed set from the server instead of an empty `Set`, and render the status
where the local confirmation is now.

### H. Comments — ✓ done, all of it

`GET /incidents/{incidentId}/comments` now answers a documented page of
`{id, body, createdAt, isAnonymous, media, author, reactions, viewerHasReacted}`.
That covers all three asks: the response is documented, `isAnonymous` is there,
and comments can carry media. The phone can unhide both controls.

**And the optional part landed too** on 17 September:
`/comments/{commentId}/reactions`. Nothing further is needed here.

One note, not a request: attachments go through `media.uploadId`, so a comment's
footage has to be put through `/uploads/*` first. That is ours to wire, and the
phone keeps the attach control hidden until it is — offering it before would take
somebody's footage and drop it.

`GET /incidents/{incidentId}/comments` has no response schema, and the comment
body is text only.

- **Document the response:** a page of
  `{ id, body, createdAt, author: { kind, displayName, avatarUrl, organisationName },
  reactions, viewerHasReacted }`.
- **Anonymous comments:** accept `isAnonymous` on `POST …/comments` (the app had
  this and has hidden it because there is nowhere to send it).
- **Attachments:** a comment carrying another angle of the same event is the most
  useful comment there is. Accept `media` via the same upload flow as reports, or
  a `mediaUploadId`. The app has the picker and has hidden it until this exists.
- **Optional:** reactions on a comment (`POST/DELETE /comments/{id}/reactions`).

### I. Confirm the photo served as an MP4 is fixed — P1

DW-CYX-W9N ("Crime scene", `kind: "photo"`) served video bytes from its default
media. Please confirm `media.url` for a photo answers `image/*`, or that the
report's `kind` was corrected. Write-up further down.

### J. The integrity check flags captures six hours old — P1

Unchanged: a capture filed six hours after it was filmed is marked
`integrity_flagged` and `restricted`. Reporters in areas without signal upload
that evening or the next day, exactly as designed. The check that means something
is a `capturedAtIso` in the future or impossible given `deviceUptimeMs`, not the
delay. Item 3 further down.

### K. Guest versus account reports — ✓ done, thank you

`AuthorKind` is named: **`account` | `device`**. That is exactly the distinction
the desk needed — a report filed on a device token alone can never be paid, and
an editor can now see which is which rather than inferring it.

Please confirm an editor can tell a report filed by a guest (device token only)
from one filed by an account on `/editorial/queue` — for example
`reporter.kind: "device"` versus `"user"`. A guest report can never be paid, so
the desk needs to know.

### L. Clear error codes on money and account actions — P1

The clients show the service's message, but need a stable `code` to decide what
to do. Please document the error `code` for:

- `DELETE /me` when commissions are outstanding (so the app can say "settle
  first" rather than "something went wrong")
- `PUT /me/password` with a wrong current password
- `POST /platform/payouts/batches/{id}/release` on a batch already released
- `POST /org/invoices/{id}/checkout` on an invoice already paid
- `POST /org/incidents/{id}/unpublish` on a report this organisation did not
  publish
- `PATCH /platform/admins/{id}` when a platform owner tries to demote themselves

### M. Request bodies for 35 write operations — ✓ done

Every one of the 163 write operations in the document now publishes a request
body; the count of writes without one is zero. Two that mattered most, confirmed
by reading them back:

- `POST /org/incidents/{incidentId}/response` takes
  `{action: acknowledged | more_info_requested | inspecting | referred | resolved | closed_no_action, note}`.
  The console's response log can stop living in the browser.
- `PATCH /org/assignments/{id}` takes `{status: accepted | en_route | on_scene | closed, note}`,
  and `POST /org/assignments` takes `{incidentId, assigneeId, note, dueAt}`.

One gap that belongs to R rather than here: `questions[]` on `POST /org/surveys`
is still "any object", and the create body still has no `rewardPesewas`,
`responsesTarget`, `closesAtIso` or `targetArea`.

The original list follows, for the record.

These publish no request body, so each client sends its best reading and shows
the error as the specification. The first group is called by the console today:

- **Onboarding:** `PUT /org/onboarding/steps/{stepId}` (the console sends the
  step's answers as a flat object; please confirm the field names you expect per
  step), `POST /org/onboarding/documents` (observed to need `documentType`,
  `fileName`, `sha256`; please document `mimeType` and `byteSize`, allowed types
  and the size limit — see O for the file itself)
- **Applications:** `POST /platform/applications/{id}/steps/{stepId}/decide`,
  `POST …/screening`, `POST …/approve`
- **Team:** `POST /org/membership-requests/{id}/decide`, `POST /org/members`,
  `PATCH /org/members/{id}`, `POST /org/employees`, `PATCH /org/employees/{id}`,
  `POST /org/branches`, `PATCH /org/branches/{id}`, `POST /org/invites`,
  `POST /org/affiliations`, `POST /org/internal-submissions`
- **Surveys:** the shape of one question in `POST /org/surveys` `questions[]`
  (it is "any object" today). We propose
  `{ id, kind: "single_choice" | "multi_choice" | "scale" | "text" | "photo", prompt,
  options?: string[], min?, max?, required }` — please confirm or give yours, and
  add `rewardPesewas`, `responsesTarget`, `closesAtIso` and an optional
  `targetArea { latitude, longitude, radiusM }` to the create body.
- **Editorial and reports:** `POST /editorial/{id}/corroboration`,
  `PUT /editorial/{id}/news-value`, `POST /org/incidents/{id}/license`,
  `POST /org/incidents/{id}/response`, `POST /surveys/{id}/responses`
- **Payouts and operations:** `POST /platform/payouts/batches/{id}/release`,
  `POST /platform/payouts/entries/{id}/retry`, `POST /platform/sla/escalate`,
  `POST /platform/media/purge`, `POST /platform/notifications/process`,
  `POST /org/exports`
- **Auth and uploads:** `POST /auth/google`, `POST /auth/email/verify/request`,
  `PUT /uploads/{uploadId}/chunks/{index}`, `POST /uploads/{uploadId}/complete`,
  `POST /org/checkout/{id}/complete`, `POST /billing/webhooks/paydirect`

(Where a body is genuinely empty, say `{}` so nobody guesses.)

### N. Response schemas for 45 read operations — ◐ 31 left, down from 45

Most of these landed, including every one the desks are built on, and survey
aggregates are now typed. Thirty operations still answer 2xx with no schema.

**That number went up rather than down**, and only because the five routes added
on 16 September arrived without one — `PUT /org/onboarding/documents/{documentType}/bytes`,
the document download, and the rest. Nothing regressed. `/org/dashboard` remains
the one still worth doing, since it is a screen rather than a plumbing route.

The original list follows; treat it as the superset and ignore the rows that now
publish a schema.

These answer 200 with no schema, or with items typed as "any object":

- **The caller and money:** `GET /me`, `/me/earnings`, `/me/commissions`,
  `/org/plans`, `/org/subscription`
- **Reports:** `GET /incidents/{incidentId}/comments`, `/editorial/queue` (items),
  `/editorial/{incidentId}`, `/editorial/{incidentId}/news-value`,
  `/org/inbox` (items), `/org/incidents/{incidentId}`,
  `/org/incidents/{incidentId}/notes` (items), `/organisations/{id}/incidents`,
  `/organisations/{id}/surveys`, `/surveys`
- **Organisation:** `/org/dashboard`, `/org/members`, `/org/branches`,
  `/org/employees`, `/org/membership-requests`, `/org/assignments` (items),
  `/org/internal-submissions`, `/org/invites`, `/org/affiliations`,
  `/org/surveys` (items), `/org/surveys/{id}/responses` (aggregates and items),
  `/org/onboarding`, `/org/exports/{exportId}`, `/org/audit`
- **Platform:** `/platform/routing`, `/platform/applications`,
  `/platform/businesses`, `/platform/takedowns`, `/platform/takedowns/{id}`,
  `/platform/metrics` (`accounts`, `routing`, `commissions`),
  `/platform/retention-policy`, `/platform/retention/inventory`,
  `/platform/retention/jobs`, `/platform/retention/jobs/{id}`,
  `/platform/legal-holds`, `/platform/audit`, `/platform/audit/{id}`,
  `/platform/audit/verify`, `/platform/audit/export`
- **Public:** `/invites/{token}`

### O. Onboarding documents: store the file — ✓ done, thank you

This was the one we most wanted, and all of it landed on 16 September:

- `POST /org/onboarding/documents` now takes `mimeType` and `byteSize` and
  answers `{document, application, upload: {url, method, headers, expiresAt}}`.
- `PUT /org/onboarding/documents/{documentType}/bytes` takes the raw file and
  checks it against the declared `sha256`.
- `GET /platform/applications/{id}/documents/{documentType}` returns the bytes,
  and `GET /platform/applications` items now carry `documents`.

**Both ends are connected.** An applicant's file leaves the browser and is
stored; a platform owner opens it from the review panel. Approving an
organisation on the strength of a filename is no longer possible, which is what
this item was for.

Two notes, neither a request. We call the documented route directly rather than
the `upload.url` you hand back, because the console uploads from its own server
where the token is — a signed URL would have to travel through the browser to be
worth having. And we cap uploads at your 25 MB.

`documentType` being an enum is useful:
`business_registration | tax_identification | officer_id | authorisation_letter | premises_proof | utility_bill | lease_agreement`.

**Connected on 15 September and it works — but no file reaches you.**
`POST /org/onboarding/documents` accepts `{documentType, fileName, sha256}` and
records them. The bytes of the certificate, tax ID and officer ID are never sent,
because the endpoint has nowhere to receive them. So the platform owner approves
an organisation's access to citizens' footage on the strength of a file *name*.

Until now the console kept these files on its own disk. That has been removed —
it was invisible to you and lost on every redeploy — so today the file exists
only on the applicant's computer.

**What we need:**

```
POST /org/onboarding/documents
  { "documentType", "fileName", "sha256", "mimeType", "byteSize" }
→ 201 { "document": {…}, "application": {…},
        "upload": { "url": "…", "method": "PUT", "headers": {…}, "expiresAt": "…" } }
```

(or reuse `/uploads/{uploadId}/chunks` — either is fine; say which). Check the
uploaded bytes against `sha256` before marking the document attached.

And on `GET /platform/applications`, each document with a short-lived
`downloadUrl`, so the reviewer can open it. Only platform roles may receive it.

**Also:** there is no way to remove or replace a document. The console currently
re-posts the same `documentType`, and your response suggests that replaces the
earlier one — please confirm that is the intended behaviour.

**Done when** a platform owner can open the exact file an applicant attached.

### P. Deciding applications — ✓ rejection landed; one question left

`POST /platform/applications/{id}/reject` exists and is connected. The reviewer's
Decline button used to answer with a 501 explaining that the offending step had
to be sent back instead; the reason now travels and the applicant sees it as
`rejectionReason`. The decide, screening and approve bodies are published too
(item M).

**One question remains, and it is a question rather than work:** what approval
switches on — specifically whether it sets `verified: true`, which is the field
the console reads off `/me` to decide whether somebody lands on onboarding or on
their own console. If approval uses a different field, please name it.

Connected on 15 September; these calls are made from the approvals page, and
whatever you answer is shown to the reviewer:

- **The body of `POST /platform/applications/{id}/steps/{stepId}/decide`.** We
  send `{ "decision": "accepted" | "rejected", "status": "approved" | "rejected",
  "note": "…" }`. Please document the real one, and the step statuses
  `GET /platform/applications` then reports.
- **What `POST …/screening` and `POST …/approve` return**, and what approval
  switches on. Please confirm approval sets `verified: true` on the organisation,
  because the console reads `memberships[].verified` from `/me` to decide whether
  somebody signs in to onboarding or to their console. If approval uses a
  different field, name it.
- ~~**Rejecting a whole application.** There is no endpoint.~~ **Done on 16
  September** — `POST /platform/applications/{id}/reject {reason}` exists, the
  console calls it, and the reason reaches the applicant on `GET /org/onboarding`
  as `rejectionReason`. Nothing further needed here.
- **What registration collected.** `/auth/register` accepts only an
  organisation's `name` and `sector`. The console also collects **interests**
  (what routing matches reports against), **plan**, **phone** and expected
  monthly volume. For now these are written onto the organisation step's payload
  (`PUT /org/onboarding/steps/organisation`). Either accept them on
  `organisation` in `/auth/register`, or apply them from that payload when you
  approve — otherwise an approved organisation has no interests and receives no
  reports.

### Q. Housekeeping — ✓ done, thank you

- The two test organisations are gone: `GET /organisations` returned only Adom TV
  News and BBC World News when checked on 16 September.
- `POST /org/onboarding/steps/{stepId}` now exists beside `PUT`, so the spec and
  the service agree.
- `DELETE /me` — please still say in the document which of 200 or 204 you keep.
  Either is fine for the clients.

- **Please delete two test organisations** created on the dev service while
  connecting sign-up: **"ZZ Console Probe (delete me)"** and **"ZZ Console
  Probe 2 (delete me)"**. Their accounts were deleted with `DELETE /me`; the
  pending organisations may still be in `/platform/applications`.
- **`POST /org/onboarding/steps/{stepId}` answers 404** although the spec lists
  it beside `PUT`. Remove it from the spec or implement it.
- **`DELETE /me` answers `200 {"deleted": true, "commissionsHeld": []}`**, not
  the 204 the notes described. Either is fine for the clients; please document
  the one you keep.

### R. Found while connecting round four — ◐ about half shipped

**Done:** recording a response has a documented body and a way to read the
timeline back; assignment transitions are documented; notes items are typed
`{id, body, author, createdAt}`; `/organisations/{id}/surveys` has a schema.

**Still needed, and each is short:**

- **The author of a note.** `author` is a field now but its own shape is not
  given. Please name what is inside it; the console looks for `displayName`,
  `name`, `employeeName`, then `email`.
- **An assignment's starting status.** `PATCH` documents
  `accepted | en_route | on_scene | closed`, but `POST /org/assignments` sends no
  status and nothing says what a new one begins as. The console currently treats
  `pending`, `open`, `created` and `new` as "assigned". Please say which it is,
  and whether reopening a closed assignment is allowed.
- ~~**Survey aggregates.**~~ **Done** — `GET /org/surveys/{id}/responses` now types
  `aggregates` as `{questionId, prompt, counts, options, average, answered}`.
- ~~**Survey summaries carry no cost or progress.**~~ **Done** — `/org/surveys`
  items now carry `rewardPesewas`, `responsesTarget`, `questionCount` and
  `questions`.
- ~~**`GET /platform/commissions?status=unpaid`**~~ **Done** — and the
  `hasPayoutNumber` on each row is exactly what the release screen needed, since
  those are the payments that get held rather than sent.
- ~~**`adminRole` on `GET /me`.**~~ **Done** — `MeResponse` now carries
  `adminRole`, so the console can gate its admin pages on the role you grant
  rather than on its own. Please just name the values it can take.
- **The response timeline lives at `/incidents/{id}/responses`**, not under
  `/org/`. That is fine — please just confirm an organisation may read it for a
  report it has licensed.

- **Nothing can raise a membership request.** `GET /org/membership-requests`
  lists them and `POST /org/membership-requests/{id}/decide` decides them, but
  there is no route that creates one — so the requests an organisation reviews
  can only come from somewhere we cannot reach.

  The console's `/join` page is the casualty. Somebody who works for an
  organisation already on Dawuro fills it in and nothing is created, so nobody
  is ever asked. It now tells them to get an invite link instead, since
  `POST /invites/{token}/accept` genuinely works — but that means a person can
  only join if somebody inside thinks to invite them first, and the "I work for
  an institution" path is otherwise a dead end.

  Either a `POST /org/membership-requests {orgId, displayName, email, statedRole, note}`
  reachable by a signed-in person outside the organisation, or tell us that
  invite-only is the intended design and we will remove the flow rather than
  leave it looking available.

- ~~**Three enums have no names.**~~ **Done** — `AuthorKind` is
  `account | device`, `AdminRole` is the six platform roles, and
  `AssignmentStatus` is `assigned | accepted | en_route | on_scene | closed`.
  That last one also answers the assignment starting status we asked about:
  **`assigned`**. All three are now ours to wire.

- **`POST /org/surveys` cannot carry what a survey costs.** The body takes
  `{title, description, questions, status}` — there is nowhere for
  `rewardPesewas`, `responsesTarget` or `closesAtIso` to go, and those three are
  the entire cost and lifetime of a survey.

  This was in item M's list, and M is now marked ✓ because every write publishes
  a body — so flagging it again here, where it is still outstanding, rather than
  leaving a live request inside a finished item.

  **It is now blocking a control.** The console's "New survey" button is disabled
  and says why on screen: a form that collected a reward and a target and had
  them quietly dropped would be worse than no form, since the organisation is
  charged reward × target. `GET /org/surveys` already returns all three, so it is
  only the create body that is missing them. The question shape is also still
  "any object"; our proposal is in item M and `SurveyQuestion` in
  `packages/core` is what both clients already render.

- **`/org/inbox` does not say which reports this organisation has already
  licensed.** Found on the afternoon of 16 September, by licensing two reports
  and reloading the page. The items carry `verification`, `vettingState`,
  `authorKind` and the rest, but nothing about the licence — and there is no
  licence field anywhere in the document except `EarningsSummary.reportsLicensed`,
  which is a reporter's count.

  So the console cannot tell a report it has paid for from one it has not. After
  a reload the tick disappears, the report moves back to "Offered", and the panel
  for sending it to the editor goes with it. **The purchase itself is recorded
  correctly** — this is only about reading it back. A `licensed: true`, or a
  `licensedAt`, on each inbox item is all it needs.

- **A desk is required on the organisation's route now — thank you — but not on
  the editor's.** `POST /org/incidents/{id}/publish` requires `section`. The two
  routes that actually put a report on the feed still do not:
  `POST /editorial/publication-requests/{id}/decide` requires only `decision`,
  and `POST /editorial/{id}/transition` only `state`.

  So the gap is narrower but not closed: an editor approving a request, or
  transitioning a report to verified, can still publish it with no desk. A
  published report with no desk appears on **no desk in the app** — it turns up
  only under Latest — and nothing errors, so nobody finds out. `DW-P7P-KGM` is
  on the feed that way today.

  Requiring it on those two, or defaulting to `ghana` server-side, closes it.
  Please say which, so both clients behave the same way.

All of these endpoints are now called by the console. What each still needs:

- **Payouts — what a new batch will contain.** `POST /platform/payouts/batches`
  defaults to "all unpaid", but nothing lists the unpaid commissions first, so
  the operator starts a batch without seeing what goes into it. Needed:
  `GET /platform/commissions?status=unpaid` (reporter, amount, incident, whether a
  payout number is saved), or a `dryRun: true` on batch creation.
- **Assignments — the starting status.** `PATCH /org/assignments/{id}` accepts
  `accepted | en_route | on_scene | closed`, but a new assignment's own status is
  undocumented. The console reads `pending`, `open`, `created` and `new` as
  "assigned". Please document the value, and whether reopening a closed
  assignment is allowed.
- **Notes — who wrote it.** `author` on `GET /org/incidents/{id}/notes` is "any
  object". Please document it; the console looks for `displayName`, `name`,
  `employeeName`, then `email`.
- **Survey results — the aggregate shape.** `aggregates` is "any object". The
  console reads `{questionId, prompt, counts: {answer: n}}` or
  `{options: [{label, count}]}`, plus `average` and `answered`. Please document
  the real one. And `GET /org/surveys` items carry no `rewardPesewas`,
  `responsesTarget` or `questions`, so the committed cost of a survey cannot be
  shown — please add them to `SurveySummary`.
- **Recording a response on a report.** The inbox's "acknowledged / inspecting /
  referred / resolved" log still lives only in the browser, because
  `POST /org/incidents/{id}/response` documents no body. Please document it
  (`{action, note, evidenceUrl}`?) and add `GET …/responses` so the timeline can
  be read back.
- **An organisation's surveys on its homepage.** The phone now reads the public
  `GET /organisations/{id}/surveys`, which has no response schema. Please return
  the same fields as a survey — `id, title, description, status, closesAtIso,
  rewardPesewas, responsesTarget, responsesReceived`, and `questions` (or at
  least a question count) — so the card can show the reward and progress.
- **The home search lists approved organisations only** (product decision). The
  phone filters `GET /organisations` on `verified`; please keep `verified`
  accurate on every item.
- **Administrator roles — two vocabularies.** `/platform/admins` grants six roles
  (`platform_owner, editor, finance, compliance, operations, support`) while
  sign-in tells the console nothing about which of those a person holds, so the
  console still gates its admin pages on its own roles. Please return the admin
  role on `GET /me` (`adminRole`).

### S. Whistleblower, and the place in words — ◐ the fields landed, two behaviours left

All of it landed during the morning of 16 September:

- **`IncidentCategory` now has 24 values including `whistleblower`.** The phone's
  whistleblower reports will be accepted rather than refused, which unblocks a
  feature already shipped to the app.
- **`DisplayFlags` is `{showLocation, showDate, showTime, showAddress}`.**
- **`LocationInput` now takes `plusCode`, `address` and `label`.** The phone has
  been sending the first two all along, so they will start being stored with no
  change at our end.

**`location.label` is being resolved now — thank you.** Four of the six published
reports come back `label: "Accra"`, where every report used to be `label: null`.
Two are still null (`DW-DJ6-WH3`, `DW-P7P-KGM`). Unchanged on 17 September.

**`location.plusCode` is not coming back on public reads.** All six are null.
The phone computes the plus code itself and sends it, and `LocationInput` accepts
it — so either it is not being stored, or it is stored and not returned. Worth a
look, because it is the one part of "where it was" that works without a signal
and it is what a reporter is shown before they send.

Two small things on that, neither urgent:

- **Is "Accra" as fine as it gets?** A city name locates a report loosely; what a
  desk needs is the suburb — "Abelenkpe, Accra" rather than "Accra", which is what
  the clients currently derive themselves from the coordinates. If the resolver
  can return the narrower name, both clients can drop their own lookups.
- **Two reports have no label.** Worth knowing whether those failed to resolve or
  were simply never re-processed.

**Still untested, because it needs a fresh report rather than a question:**
`plusCode` and `address` are null on all six, but every one of them was filed
before the fields existed, so that proves nothing. We will file a new report from
the phone and check that both are stored, and that a public read returns `label`
and `plusCode` when `showLocation` is true and `address` only when `showAddress`
is also true. We will write down what we see rather than ask you to confirm it.

And one product point from 15 September, restated because it is easy to miss:
the organisations a whistleblower report is sent to **should** see who filed it,
even when `isAnonymous` is true. Anonymity there is from the public, not from the
recipient.

Added to the phone on 15 September.

**1. A `whistleblower` category.** Add `"whistleblower"` to the `IncidentCategory`
enum (after `corruption`). **Until it is there, every whistleblower report is
refused** at `POST /incidents` with a validation error and sits in the reporter's
outbox. Please also:

- let organisations choose it in `interests`, so it routes;
- pay it at the corruption rate (3,000 pesewas base), as the console does;
- note that the phone starts it as anonymous, which hides the reporter from the
  **public**. **The organisations it is sent to should see who filed it** (product
  decision, 15 September), so they can follow up — please include the reporter on
  `/org/inbox` and `/org/incidents/{id}` for these, even when `isAnonymous` is true.

**2. Where it was, in words.** The review screen now works out, on the phone:

- the **plus code** of the fix (always — it is arithmetic on the coordinates);
- the **street name** and the **full address**, when the phone's geocoder has one.

They are sent now; the service drops keys it does not know, so nothing breaks
before you add them:

```
POST /incidents
  "location": { …, "plusCode": "6CQ4H4GH+2V", "address": "Ring Road West, Kaneshie, Accra" },
  "displayFlags": { "showLocation": true, "showAddress": false, "showDate": true, "showTime": true }
```

What we need:

- **Store** `location.plusCode` and `location.address` (both optional strings).
- **Resolve `location.label` when a report arrives** (for example
  "Kaneshie, Accra"), using the phone's `address` when sent and a geocoder
  otherwise. Every report comes back with `label: null` today, so each phone and
  the console look the name up again for every reader.
- **Add `showAddress`** to `DisplayFlags` (default `false`).
- **On public reads**, when `showLocation` is true, return
  `location.label` (street or area) and `location.plusCode`; add
  `location.address` only when `showAddress` is also true. When `showLocation`
  is false, none of the three.
- Editorial and organisation reads get all three regardless, like the fix.

**Done when** a published report shows its street and plus code in the feed, and
its full address only where the reporter chose to publish it.

### T. Commission rates set by the platform, and organisations' offers — ✓ done, thank you

**`commissionOffer` is on `PublicOrganisation` now, which completes the item.**
The phone already reads it — `DestinationPicker` runs every chosen organisation's
offer through the shared `bestOffer`, so a reporter sending a report directly to
an organisation that pays above the platform rate sees the higher figure before
they send. That was the whole point of the feature and the last piece of it.

Part 2 — that a commission is worked out from the rates in force at the moment
of licensing and stored on the row — still cannot be seen in a schema. We will
test it rather than ask.

The original request follows, for the record.

### T (original). Commission rates set by the platform, and organisations' offers

**Done: the platform's rates and the offers endpoint.** `PUT /platform/settings`
takes `{feed, commissions}`, `GET /settings` returns both, and
`GET`/`PUT /org/commission-offer` exist. Confirmed live on 16 September — the
served rates carry `whistleblower: 3000`, matching the corruption rate we asked
for. The console's Commission rates and Commission offers pages both read these.

**One thing is left, and it is a single field:**

- **`PublicOrganisation` carries no `commissionOffer`.** It is
  `{id, name, sector, verified, logoUrl, publishedCount, openSurveyCount}`, so
  the phone cannot show the higher figure when a reporter chooses to send a
  report directly to an organisation that offers one. That estimate is the whole
  reason a reporter picks "send to specific organisations", so without it the
  offers page sets a rate nobody is shown.

Part 2 — that a commission is worked out from the rates in force at the moment of
licensing and stored on the row, rather than from constants — cannot be seen in a
schema. We will test it rather than ask you to confirm it.

The original request, including the clamps and the shape, follows.

**Decided on 15 September:** today's rates are the starting point (the values in
the example below); organisations may offer more than the platform rate, never
less; a reporter is paid once their balance reaches GH₵100; payout batches are
released weekly from the console, so no automatic payout schedule is needed.

The figure a reporter sees before sending ("You could earn GH₵17.50") was worked
out from numbers written into the apps. The console now has a **Commission rates**
page for the platform owner and a **Commission offers** page for organisations,
and the phone reads the rates — but the service has nowhere to keep them.

**1. Platform rates**, in the existing settings:

```
PUT /platform/settings
  { "commissions": {
      "categoryPesewas": { "fire": 2500, "accident": 2500, …every IncidentCategory },
      "videoMultiplier": 1.5, "audioMultiplier": 1.25, "directedMultiplier": 1.25,
      "lowConfidenceMultiplier": 0.7, "extraLicenseeShare": 0.5, "platformFeeRate": 0.3 } }

GET /settings   → { "feed": {…}, "commissions": { …the same shape } }   (public)
```

Clamp on write like the feed settings: category rates 0–100,000 pesewas;
video/audio/directed multipliers 0.5–3; low-confidence 0.1–1; extra licensee
share 0–1; platform fee 0–0.9. Please return the stored `commissions` in the PUT
response — the console checks for it to tell the operator the save was kept.

**2. Use them when a report is licensed.** The commission should be calculated
from the rates in force at the moment of licensing (and stored on the commission
row), not from constants — otherwise the estimate and the payment disagree. The
formula the clients use is in `packages/core/src/logic/commission.ts`.

**3. Organisation offers.**

```
GET  /org/commission-offer   → { "categoryPesewas": { "galamsey": 6000, … } }
PUT  /org/commission-offer   { "categoryPesewas": { … } }   → the stored offer
```

- Reject or drop any rate at or below the platform's rate for that category — an
  offer can only raise what a reporter earns.
- Include `commissionOffer: { categoryPesewas }` on each item of the public
  `GET /organisations`, so the phone can show the higher figure when a reporter
  sends a report directly to that organisation.
- When a **directed** report is licensed by an organisation with an offer for its
  category, use the higher rate.

**Done when** a rate changed on the console changes the phone's estimate within
five minutes, and a report sent to an organisation with an offer is paid at that
offer.

### U. A `blogger` account kind, and verification for a person — P0

> **✓ Shipped 28 September and connected the same day.** `accountKind` now
> takes `blogger`, `MeProfile.verified` exists, and `/me/verification*` is the
> full per-step track with documents. `BACKEND_SPEC.md` §9.5 has been rewritten
> to describe what was built rather than what was asked for — read that, not
> the request below, which is kept as the record of why.

**Dawuro is registering three kinds of account, not two:** an individual, a
**blogger**, and an organisation. A blogger is an independent publisher — one
person, not an institution — and the product rule is that *every blogger and
every representative of an institution is verified before they publish*.

Nothing on the service can represent that today.

**1. `accountKind` has no room for it.** `RegisterRequest.accountKind` is a
closed enum of `user | organisation`, so `blogger` is refused by validation.
`MeProfile.accountKind` is an unconstrained string, so the read side is already
ready — it is only registration that cannot express it.

```
accountKind: "user" | "blogger" | "organisation"   // default "user"
```

**2. Verification is scoped to an organisation, and a blogger is not one.**
`/org/onboarding/*` and `/platform/applications/*` both hang off an `orgId`,
and the only verified flag anywhere is `memberships[].verified`. A person has
nowhere to be verified and nothing to carry the result.

Asked for, in the shape the existing endpoints already use:

- **An application track for a person.** Either `/me/verification` mirroring
  `/org/onboarding` (read, per-step save, submit, documents), or — simpler for
  you and for us — let the existing onboarding endpoints accept an application
  whose subject is a user rather than an organisation. `stepId` is already an
  unconstrained string, so a blogger-shaped step set needs no change there.
- **`verified: boolean` on `MeProfile`**, and on the public `Reporter` shape, so
  a reader can see that a byline has been checked. Today `Reporter` carries
  `kind`, `id`, `displayName` and `avatarUrl` and nothing about standing.
- **Blogger applications in the platform queue.** `GET /platform/applications`
  returns organisation applications; the console's approval desk needs the
  person ones in the same queue, distinguishable by kind, with the same
  per-step decide, screening, approve and reject it already has.

**The document types are already right** — `officer_id` (Ghana Card or
passport), `utility_bill` and `premises_proof` cover a person, so the
`documentType` enum needs nothing added.

**Done when** a blogger can register, work through their steps, be approved by a
platform owner in the console, and come back from `GET /me` as
`accountKind: "blogger", verified: true`.

**Until it lands:** the phone offers two account kinds, not three. We are not
shipping a third card that registers as `user` and submits its verification
nowhere — that is a choice the person cannot tell from a working one.

### V. Bank account details for payouts — P1

> **✓ Shipped 28 September.** `GET`/`PUT /me/payout-method` takes the
> discriminated momo/bank body as specified. The phone still collects mobile
> money only at registration — adding the bank half is ours, not yours.

**`/me/payout-msisdn` is the only payout field in the API.** One mobile money
number. There is no account number, bank name, branch, SWIFT or account-holder
field on any of the 139 paths.

The product asks reporters and bloggers for **a bank account *or* mobile money**
when they register. Mobile money we have shipped — it is now collected on the
third step of registration rather than on the earnings screen, so a commission
is never held for want of a number nobody asked for. The bank half we have not
built, because a form whose inputs reach no endpoint is worse than its absence:
somebody enters their account details, sees them accepted, and is not paid.

Asked for:

```
GET  /me/payout-method
PUT  /me/payout-method
{
  "kind": "momo" | "bank",
  "momo": { "msisdn": "+233241234567" },
  "bank": {
    "accountName":   "Ama Kufuor",     // as the bank holds it
    "accountNumber": "1234567890123",
    "bankCode":      "GCB",            // an enum from you, or free text with a name
    "branch":        "Accra Main"      // optional where the bank needs it
  }
}
```

Either shape works for us — one endpoint with a discriminated body, or
`/me/payout-bank` beside the existing `/me/payout-msisdn`. What matters is that
exactly one method is *active*, so a payout run is never ambiguous about where
the money goes, and that `GET` says which.

**Validation belongs with you, not with us.** We check a Ghanaian MSISDN on the
phone because the rule is stable and cheap. Account numbers are per-bank and we
would be guessing; an accepted number that the bank later rejects is a payout
that silently fails.

**Also needed:** `payoutStatus: "held"` with `heldReason` already exists on
`/me/commissions` — please make sure "no payout method on file" is one of the
reasons it can carry, whichever method is missing.

**Done when** a reporter can save a bank account, `GET /me/payout-method` reads
it back, and a released batch pays to it.

### W. A country on an incident, and a filter for it — P2

**Ask us before building this one.** It is the only item on this list that is a
product question rather than a gap: it matters if and only if Dawuro is going to
carry reports from outside Ghana, and nobody here has told us that it is.

What prompted it: the phone now has a country control in the masthead, left of
search. Today it offers **Ghana** and lists a handful of West African neighbours
plainly marked *not yet covered* — because nothing on the service can express a
country:

- `PublicIncident` has no country field.
- `GET /incidents` has no `country` parameter (`limit`, `cursor`, `category`,
  `section`, `origin`, `near`, `radiusM`, `since`, `until`, `sort`).
- `location` is declared as `{ type: object, nullable: true }` and everything in
  it is Ghanaian.

The control is built so that the client change, when it comes, is one boolean:
`covered: true` on an entry in `types/countries.ts`. Nothing about the sheet or
the masthead needs rework. So there is no rush at this end.

If it is wanted:

```
PublicIncident.country: string    // ISO 3166-1 alpha-2, e.g. "GH"
GET /incidents?country=GH&country=NG   // repeatable, OR, like `section`
```

**The hard part is not the field, it is who sets it.** Three cases and they do
not answer the same way:

1. A citizen report has a GPS fix, so the country can be derived at submission
   and should be — asking a reporter to pick their country while standing in
   front of a fire is the wrong moment for a dropdown.
2. A report filed with location withheld (§3.5 display flags) still *has* a fix
   the service holds, so it can still be derived; the country just must not be
   published if the reporter hid the location. **Deriving it and then leaking it
   through a filter would undo a privacy choice**, which is the one failure worth
   being careful about here.
3. Agency copy on the World desk (`origin: newsroom`) has no capture location at
   all — §3.9 forbids returning one — so it needs an editor to set the country,
   or to have none and be excluded from a country filter rather than silently
   dropped from every one.

**Done when** `GET /incidents?country=GH` returns only Ghanaian reports, a report
whose reporter hid the location is not exposed by it, and a `newsroom` item
behaves predictably rather than by accident.

### X. `accountKind` on `/auth/google`, and "was this new?" — P1

**Google sign-in can only ever produce a plain reporter, and that is now a
visible hole in registration.**

`POST /auth/google` takes an identity and answers with `AuthTokenResponse` —
`accessToken`, `refreshToken`, two expiries. Nothing goes in to say what kind of
account to create, and nothing comes back to say whether one *was* created.

Two consequences on the phone, the first of which we have just had to design
around:

1. **A blogger cannot sign up with Google.** Registration now offers three
   kinds; "Continue with Google" sat directly under the blogger card and
   produced a reporter with no verification application — the thing the choice
   exists to create — with nothing on screen saying so. The button is now hidden
   for anything but a plain reporter, which is honest and worse.
2. **A reporter who signs up with Google is never asked for a payout number.**
   The form's third step collects it, because a commission with no wallet behind
   it is held rather than paid. The Google path skips the form entirely, and the
   client cannot prompt afterwards because it has no way to tell a brand-new
   account from somebody signing in on a second phone — asking a returning
   reporter for a number they set last year is the wrong correction.

Asked for:

```
POST /auth/google
{ "idToken": "…", "accountKind": "user" | "blogger" }   // organisation stays out

200 { "accessToken": …, "refreshToken": …, "expiresAt": …, "refreshExpiresAt": …,
      "created": true }        // false when the identity already had an account
```

`created` is the smaller half and the one that unblocks the payout step; a
boolean is enough.

**Please keep `organisation` out of it**, and keep the elevated kinds out too.
The summary line on this endpoint says "elevated roles require seeded
accountKind", which reads as though a caller could ask for one — the client
sends neither `kind` nor `orgId` and never will, but an enum of exactly
`user | blogger` on the request makes that a property of the API rather than of
our restraint.

**And the standing question on this endpoint, still unanswered:** the request
body is `additionalProperties: true` with nothing declared, so nothing in the
schema says the ID token's signature and audience are verified server-side.
Please confirm they are. Unverified, anybody can mint a session for any email
address, and every other control on this list is moot.

**Done when** registering with Google as a blogger produces
`accountKind: "blogger"` on `GET /me` with a verification application attached,
and a first-time Google reporter can be sent to the payout step.

### Is this list complete?

Yes, as far as the clients can see — re-checked on 16 September against every
phone screen, every console page and `/v1/openapi.json`. Items A to T above are
everything the phone and the console need from the backend, and the ✓ rows are
things you can skip.

**This was re-checked after the morning's deploy.** An earlier version of this
page was written against a snapshot taken at 09:50, before the service went
quiet, and it wrongly said item S had not landed. The document was re-pulled at
about 11:05 once the service returned and every ✓ and ◐ above reflects that
later read — so S, T and `adminRole` are recorded as they actually are. If you
deploy again, say so and we will re-check rather than have you build something
twice.

**Two items were added to R that afternoon**, found by using the console rather
than by reading the document: an organisation licensed two reports and tried to
publish one. The inbox cannot read a licence back after a reload, and nothing
requires a desk when a report is published. Both are small, and both are the kind
of thing only turns up when somebody actually does the thing.

These already exist in the spec, so they are **our** work, not requests:
password reset (`POST /auth/password/reset`), email verification
(`/auth/email/verify/request`, `/confirm`), accepting an invite
(`GET /invites/{token}`, `POST /invites/{token}/accept`), deciding a takedown
(`PATCH /platform/takedowns/{id}`), deciding a membership request, and
approving an organisation.

The one thing a list cannot promise: when each item is built we will test it,
and if the service behaves differently from what is written here we will write
down exactly what we saw. That is testing, not new requirements.

### Not needed from you — ours to fix

So nothing is built twice:

- **The phone's map does not send `bbox`**, which `GET /incidents/map` requires.
  Our bug.
- **The console used to fire one request per queued row, all at once** — up to a
  hundred at a time on the routing desk, which is past your rate limit on its own
  and could lock the console out of every page for twenty minutes. Fixed on 16
  September: a few at a time, with a deadline. If you saw bursts like that in the
  logs, that was us, and it has stopped.
- **Done on 15 September:** the phone's account screens (sign out that revokes
  the refresh token, edit name, change password, delete account); organisation
  sign-up and onboarding through `/auth/register` (no application or document is
  kept on the console's disk); payout release, per-payment status and retry;
  withdrawing a published report; administrators; invoice payment through
  PayDirect checkout; dispatch assignments; internal notes read back; survey
  results and closing; and the platform dashboard figures from
  `/platform/metrics`.

---

## History: full audit (15 September, before round four)

**Superseded by the list above** — kept for the detail behind each item. Every screen in the mobile app and every page in the
console was checked against the OpenAPI document at `/v1/openapi.json` on
15 September. What is below is what no existing endpoint can do. Anything the
clients simply have not connected yet is listed at the end under "Not needed
from you", so nothing gets built twice.

Priority: **P0** blocks testing the full flow, **P1** is a feature already built in a
client that has nothing to call, **P2** is documentation the clients are
guessing at.

### Round four — checked against `/v1/openapi.json` on 15 September

**Thank you — most of this list shipped.** Twenty-two new operations. Confirmed in
the spec:

| # | Item | Shipped as |
|---|---|---|
| 2 | Organisation applies without being a member | `POST /auth/register` with `accountKind: "organisation"` and `organisation: {name, sector}` creates a pending organisation and owner membership |
| 3 | Releasing payouts | `GET /platform/payouts/batches/{id}`, `POST …/release`, `POST /platform/payouts/entries/{id}/retry`; batch create body `{commissionIds, note}` |
| 5 | Account basics | `POST /auth/logout`, `PATCH /me`, `PUT /me/password`, `DELETE /me` |
| 6 | Platform administrators | `GET/POST /platform/admins`, `PATCH/DELETE /platform/admins/{id}` with roles |
| 7 | Withholding a published report | `POST /org/incidents/{id}/unpublish` `{reason}` |
| 8 | Paying an invoice | `GET /org/invoices/{id}`, `POST /org/invoices/{id}/checkout` `{returnUrl}` |
| 9 | Saved queries | `PATCH/DELETE /org/queries/{queryId}`, `GET …/matches` |
| 10 | Dispatch assignments | `GET /org/assignments`, `PATCH /org/assignments/{id}` `{status, note}`; create body documented |
| 11 | Reading notes back | `GET /org/incidents/{id}/notes` |
| 12 | Survey results | `GET /org/surveys/{id}/responses`, `PATCH /org/surveys/{id}` |
| 13 | Dashboard figures | `GET /platform/metrics` response documented, with revenue and a 14-day series |
| 14 | `/editorial/decided` | Now returns the full incident |

**Still open after round four:**

1. **Item 16 — organisations send reports to the editor.** Not started:
   `POST /org/incidents/{id}/publish` still publishes directly, and there is no
   publication-request endpoint or `publicationStatus` field. The console's
   Published page cannot offer "Send to the editor" until this lands.
2. **Items 1 and 4 — the test service, email and push delivery.** These are
   not visible in a spec. Please confirm that emails are sent from the test
   service and that notifications are sent without calling
   `/platform/notifications/process` by hand.
3. **Item 15 — request bodies.** Thirty-five write operations still publish no
   body. The ones the clients call today, most important first:
   `POST /org/onboarding/steps/{stepId}`, `/steps/{stepId}/submit`,
   `/documents` (multipart field names, types, size limit), `/submit`;
   `POST /platform/applications/{id}/steps/{stepId}/decide` and `/screening`;
   `POST /org/membership-requests/{id}/decide`; `POST /org/members`,
   `PATCH /org/members/{id}`, `POST /org/employees`, `PATCH /org/employees/{id}`,
   `POST /org/branches`, `POST /org/invites`, `POST /org/affiliations`;
   `POST /editorial/{id}/corroboration`; `POST /surveys/{id}/responses`.
4. **New: some reports arrive with no `publisher`.** Found on the mobile feed on
   15 September: a report on the Africa desk had no `publisher` at all, and the
   phone crashed reading it. `PublicIncident` marks `publisher` as required. The
   phone now treats a missing one as anonymous, but please make sure every
   projection sends it — `{ kind: "anonymous" }` at minimum.
5. **Item 14 — a photo report served as an MP4** (DW-CYX-W9N). Not visible in the
   spec; please confirm whether it was fixed.

| # | Priority | What | Where it shows |
|---|---|---|---|
| 1 | P0 | A usable test service | Everything |
| 2 | P0 | An organisation can apply without already being a member | Console register + onboarding |
| 3 | P0 | Releasing a payout batch, and payout status | Console payouts; phone earnings |
| 4 | P0 | Email and push notifications delivered on the test service | Phone sign-in, reports; console invites |
| 5 | P0 | Account basics: sign out, change password, edit profile, delete account | Phone profile; console |
| 6 | P1 | Managing platform administrators | Console /admin/administrators |
| 7 | P1 | Withholding a report an organisation published | Console /published |
| 8 | P1 | Paying an outstanding invoice | Console /invoices, /checkout |
| 9 | P1 | Editing and deleting saved queries, and their matches | Phone org queries; console |
| 10 | P1 | Listing and updating dispatch assignments | Console /assignments, /agent |
| 11 | P1 | Reading internal notes and status history back | Console inbox; phone org inbox |
| 12 | P1 | Survey results, and closing a survey | Console /surveys; phone organisation surveys |
| 13 | P1 | Platform figures for the dashboard | Console /platform |
| 14 | P1 | `/editorial/decided` returns the report, and photos served as photos | Console /editorial/decided, desk |
| 15 | P2 | Request and response schemas for every endpoint that has none | All write actions |
| 16 | P1 | **Organisations send reports to the editor to publish** — a change to how publishing works | Console /published and editorial desk; phone feed |

### 16. Organisations send reports to the editor to publish — P1, a product change

**How it should work** (the product owner's decision):

1. An organisation licenses a report it wants from its inbox.
2. It **sends the report to the editor** to be published, choosing the desk.
3. The **editor reviews it and publishes it**, or declines it with a reason.
4. In the public feed, the report is **credited to that organisation** — readers
   see which organisation it is from.

**How it works today:** `POST /org/incidents/{id}/publish` publishes the licensed
report straight to the public feed under the organisation's name. No editor sees
it. That skips the verification desk for exactly the reports that carry an
institution's name, so the console has not connected that button.

**What we need:**

```
POST /org/incidents/{incidentId}/publish            X-Dawuro-Org, Idempotency-Key
{ "section": "ghana", "note": "optional message to the editor" }
→ 202 { "incidentId", "publicationStatus": "awaiting_editor", "requestedAt" }
   Does NOT publish. Change the existing endpoint rather than adding a second
   one, so nothing can still publish around the editor.

GET /editorial/publication-requests                 editor or platform_owner
→ cursor page of incidents, each with
   "publicationRequest": { "orgId", "orgName", "logoUrl", "verified",
                           "section", "note", "requestedAt" }
   (or the same object on items in /editorial/queue — your choice)

POST /editorial/publication-requests/{incidentId}/decide
{ "decision": "approve" | "decline",
  "reason": "required when declining",
  "section": "optional — the editor may change the desk",
  "lead": false, "leadUntil": null }
→ approve: vettingState "published", publisher = the organisation,
           appears in GET /incidents; audited
→ decline: stays unpublished; the reason goes back to the organisation
```

And the organisation sees where each request stands — on `GET /org/inbox` items
and `GET /org/incidents/{id}`:

```
"publicationStatus": "not_requested" | "awaiting_editor" | "published" | "declined",
"publicationDeclineReason": "…" | null
```

In every public projection (`/incidents`, `/newsroom/items`, `/editorial/leading`)
the `publisher` is already `{ kind: "organisation", id, displayName, verified,
logoUrl }` — keep it exactly that, so the feed can show the name and the verified
mark.

**Done when:**

- An organisation sends a licensed report; it is **not** in `GET /incidents`.
- It appears for an editor with the organisation's name and the desk chosen.
- The editor approves; it is in `GET /incidents` with `publisher.kind:
  "organisation"`.
- A declined request shows its reason to the organisation.

**What we build the day this lands:** "Send to the editor" with a desk picker and
a status on the console's Published page; an "Organisation requests" list on the
editorial desk with approve and decline; nothing more on the phone — the feed
already shows the organisation's name on every report it publishes.

### 1. A usable test service — P0

Superseded by item A at the top. The clients are pointed at
`https://698zp0x7-8000.uks1.devtunnels.ms`, the test tunnel, and that is where
testing continues: relaxed rate limits (thirty requests in a few minutes
currently locks a client out for twenty), a stable address, and
`DAWURO_PUBLIC_BASE_URL` set so `media.url` is absolute everywhere.

### 2. An organisation cannot apply without already being a member — P0

The console's registration flow: a newsroom or agency registers, fills in four
onboarding steps, uploads its documents (business registration, tax ID, officer
ID, authorisation letter, premises proof), and submits for platform review.

The endpoints for the steps exist (`GET /org/onboarding`, `POST
/org/onboarding/steps/{stepId}`, `POST /org/onboarding/documents`, `POST
/org/onboarding/submit`), but **every `/org/*` route requires `X-Dawuro-Org` and
membership of an organisation that already exists**, and `POST /auth/register`
creates a reporter only. So a new applicant has no organisation to name, and
cannot reach any of them.

Because of that, **the console keeps applications and uploaded documents in
files on its own server** (`.data/applications.json` and `.data/documents/`).
That does not work even for testing: it is invisible to the service, not backed
up, and lost on redeploy. (Fixed in round four; the console no longer keeps them.)

**What we need** — either of these, your choice:

```
A. POST /auth/register
   { "email", "password", "displayName",
     "accountKind": "organisation",
     "organisation": { "name": "…", "sector": "media" } }
   → creates the user, a PENDING organisation, and an owner membership,
     so /org/onboarding/* works immediately with X-Dawuro-Org.

B. POST /applications            (any signed-in user)
   { "name": "…", "sector": "…" }
   → { "applicationId", "orgId" } with the caller as owner of a pending org.
```

And, for the rest of the flow:

- **Document the bodies** of `POST /org/onboarding/steps/{stepId}`,
  `/steps/{stepId}/submit`, `/documents` (multipart field names, allowed types,
  size limit) and `/submit`.
- **A pending organisation can use only onboarding** until
  `POST /platform/applications/{id}/approve` activates it.
- **Document the bodies** of `POST /platform/applications/{id}/steps/{stepId}/decide`
  (`{decision: "accepted"|"rejected", note}`?) and `/screening`, and what
  `/approve` returns.
- **A signed download URL for each uploaded document**, so the platform owner
  can open them from `/platform/applications`.

**Done when** someone with no account can register as an organisation, complete
and submit onboarding, appear in `GET /platform/applications`, be approved, and
sign in to a working organisation — with no file kept by the console.

### 3. Releasing a payout batch, and payout status — P0

`POST /platform/payouts/batches` creates a batch. Nothing releases one, and
nothing says whether a reporter was actually paid. The console's "Release"
button has nothing to call, and reporters are promised commission in the app.

**What we need:**

```
POST /platform/payouts/batches/{id}/release        platform_owner, Idempotency-Key
→ { id, status: "releasing", releasedAt, releasedBy }

GET  /platform/payouts/batches/{id}
→ { id, status: "draft"|"releasing"|"released"|"partially_failed",
    totalPesewas, entries: [
      { commissionId, userId, msisdn, amountPesewas,
        status: "pending"|"sent"|"failed", providerReference, failureReason } ] }

POST /platform/payouts/entries/{id}/retry           for a failed entry
```

- The mobile-money provider's callback updates each entry.
- `GET /me/commissions` shows each commission's payout `status` and `paidAt`, so
  the reporter's earnings screen can say "Paid" rather than "Licensed".
- A commission with no `PUT /me/payout-msisdn` on file is held, with a reason,
  rather than failing the batch.
- Document the body of `POST /platform/payouts/batches`.

**Done when** a released batch pays test numbers, a failed number shows its
reason and can be retried, and the reporter sees "Paid".

### 4. Email and push notifications on the test service — P0

Superseded by items C and D at the top. The endpoints exist —
`POST /auth/password/forgot`, email verification, `PUT /me/push-token`,
`POST /platform/notifications/process` — but nothing says they actually deliver.

- **Email:** a sender on the test service (a test mail provider is fine) for
  password reset, email verification and organisation invites, with a reset link
  that opens `https://…/reset?token=…` on the console and `dawuro://reset?token=…`
  in the app.
- **Push:** `POST /platform/notifications/process` looks manual. It needs to run
  on a schedule or a queue. Please document which events notify whom (report
  verified, report licensed, commission paid, organisation response).

**Done when** a password reset email from the test service arrives and a verified
report sends its reporter a push notification without anyone calling `process`.

### 5. Account basics — P0

Nothing lets a person manage their own account. For an app handling footage of
identifiable people, Ghana's Data Protection Act (Act 843) makes deletion a
requirement, not a nicety.

```
POST   /auth/logout          { refreshToken } → revokes it (sign out on a shared phone)
PATCH  /me                   { displayName?, avatarUrl? }
PUT    /me/password          { currentPassword, newPassword }
DELETE /me                   → deletes the account; reports it filed stay
                               published but become anonymous; commissions owed
                               are settled or recorded first
```

**Done when** a user can change their name and password, sign out so the old
refresh token no longer works, and delete their account.

### 6. Managing platform administrators — P1

The console has an Administrators page for the platform owner to create other
administrators (finance, compliance, operations, support) and change or remove
their roles. Nothing on the service creates one — elevated roles are "seeded".
The page is marked as not saved.

```
GET    /platform/admins                    platform_owner only
POST   /platform/admins                    { email, displayName, role }
PATCH  /platform/admins/{id}               { role?, suspended? }
DELETE /platform/admins/{id}
```

Please publish the list of roles the service recognises, and write each change
to `/platform/audit`. The platform owner must not be able to remove or demote
themselves.

### 7. Withholding a report an organisation published — P1

`POST /org/incidents/{id}/publish` releases a licensed report under the
organisation's name. Nothing withdraws it — for a correction, a legal letter, or
a mistake.

```
POST /org/incidents/{id}/unpublish      { reason }
→ removed from /incidents and /organisations/{id}/incidents; licence kept; audited
```

### 8. Paying an outstanding invoice — P1

`POST /org/checkout` buys a subscription plan. The console's invoices page lists
invoices, including unpaid ones, and nothing pays a specific invoice.

```
GET  /org/invoices/{id}             → line items, status, due date, receipt URL once paid
POST /org/invoices/{id}/checkout    { returnUrl } → { checkoutUrl }
```

The PayDirect webhook marks it paid. `POST /org/checkout/{id}/complete` should
stay dev-only.

### 9. Saved queries: edit, delete, and matches — P1

`GET` and `POST /org/queries` exist. The mobile organisation app has a saved
query editor and a list that shows how many reports each query matches.

```
PATCH  /org/queries/{id}            same body as POST
DELETE /org/queries/{id}
GET    /org/queries/{id}/matches    → cursor page of incidents matching it
```

### 10. Dispatch assignments: list and update — P1

`POST /org/assignments` creates one. The console's Assignments page (for a
dispatcher) and Agent page (for the officer sent out) have nothing to read
assignments from, so they are pieced together from the inbox.

```
GET   /org/assignments?assigneeId=&status=     cursor page
PATCH /org/assignments/{id}   { status: "accepted"|"en_route"|"on_scene"|"closed", note? }
```

And document the body of `POST /org/assignments`.

### 11. Reading notes and status history back — P1

`POST /org/incidents/{id}/notes` and `/status` write. Nothing reads them, so a
colleague cannot see what the last person wrote.

```
GET /org/incidents/{id}/notes     → [{ id, body, author, createdAt }]
```

Or include `notes` and `statusHistory` in `GET /org/incidents/{id}`.

### 12. Survey results, and closing a survey — P1

Organisations create surveys (`POST /org/surveys`) and reporters answer them
(`POST /surveys/{id}/responses`). The organisation cannot see the answers or
close the survey.

```
GET   /org/surveys/{id}/responses   → per-question counts, plus the raw responses paged
PATCH /org/surveys/{id}             { status: "open"|"closed" }
```

Document the bodies of `POST /org/surveys` and `POST /surveys/{id}/responses`.

### 13. Platform figures for the dashboard — P1

`GET /platform/metrics` exists and publishes no response schema. The platform
dashboard wants, and currently shows nothing for:

- submissions today and over the last 14 days (a daily series)
- revenue this month, in pesewas
- payouts released this month, in pesewas
- active organisations

Please document the response and add what is missing.

### 14. Two data issues found while testing — P1

Written up in full further down this file:

- **`/editorial/decided` rows do not carry the report** — return the incident, as
  `/editorial/queue` does.
- **A photo report's media is served as an MP4** (DW-CYX-W9N).

### 15. Request and response schemas — P2

These endpoints publish no request body at all, so each client sends its best
reading and shows the error as the specification. Please add a schema for each:

- `POST /editorial/{id}/corroboration`
- `POST /org/members`, `PATCH /org/members/{id}`
- `POST /org/branches`, `PATCH /org/branches/{id}`
- `POST /org/employees`, `PATCH /org/employees/{id}`
- `POST /org/invites`, `POST /org/affiliations`
- `POST /org/membership-requests/{id}/decide`
- `POST /org/internal-submissions`, `POST /org/exports`
- `POST /org/incidents/{id}/response`
- `POST /surveys/{id}/responses`, `POST /org/surveys`
- everything in items 2, 3 and 10

And response schemas for the list endpoints that have none:
`/platform/routing`, `/platform/payouts`, `/platform/takedowns`,
`/platform/applications`, `/platform/businesses`, `/org/members`,
`/org/employees`, `/org/branches`, `/org/invites`, `/org/surveys`,
`/org/invoices`, `/org/queries`.

### Still open from earlier rounds

- **Item 1** — `destination` on `/platform/routing` rows.
- **Item 3** — the integrity check flags a capture six hours old.
- **Item 4** — `GET /me` for a member of an organisation, once one exists.
- **Item 11** — rate limiting (see item 1 above).
- **Item 9** — mostly done: queue rows now carry `reporter`, `publisher`,
  `origin` and `isAnonymous`. Please confirm a guest (device-only) report is
  distinguishable from an account one.

### Not needed from you — the clients are connecting these to endpoints you already have

So nothing is built twice. We are wiring these on our side:

- **Phone:** comments and reactions (`/incidents/{id}/comments`, `/reactions`),
  push-token registration, payout number, password reset screen, abuse and
  takedown forms, and the platform and organisation screens (routing, payouts,
  applications, inbox, published, surveys, saved queries) that still show sample
  data.
- **Console:** deciding takedowns (`PATCH /platform/takedowns/{id}`), application
  screening and step decisions, accepting membership requests, subscription
  checkout, and showing `GET /platform/metrics`.

---

## Start here: where the media work stands

**Thank you — most of the media round shipped.** Checked against the OpenAPI
document on 14 September. Both clients now use what is listed as shipped; the
items below it are what is still open.

### Shipped, and now used by the clients

| Item | What shipped | What the clients do with it |
|---|---|---|
| **5.** Web copy of every video | `media.url` is the H.264 MP4 web copy (faststart) once `media.status` is `ready`; `media.playbackUrl` names it; `media.originalUrl` keeps the untouched original | Both play `media.url`. Nothing is relabelled any more for new reports |
| **6.** Poster frames | `media.posterUrl` is a JPEG taken at `posterAtMs` (default 1s) once processing finishes | The phone stops cutting frames where a poster exists |
| **7.** Derivatives, cacheable URLs | `media.thumbUrl` (~320px), `media.viewUrl` (~1280px); `exp` stable for the current UTC hour | Feed rows, grid tiles and the desk's queue use `thumbUrl`; a full-width slide uses `viewUrl` |
| **14.** Type on the original | `originalUrl` is served with the stored base type | — |
| **15.** Processing status | `media.status`: `processing`, `ready`, `failed` | The desk's queue shows a spinner on a clip still processing |
| **17.** One report for an organisation | `GET /org/incidents/{id}` under `X-Dawuro-Org` | The console's media lookup uses it. **It used to scan `/org/inbox` without the header, which every `/org/*` route refuses — so no organisation ever saw a video.** That was ours, and it is fixed |
| **8.** (read half) Feed settings | `GET /settings` → `{ feed: { topStoryCount, topStoryDwellMs } }`, public, `max-age=300` | The phone reads it for the top-story rotation instead of its compiled defaults |
| **2.** Absolute URLs | `media.url` absolute when the public or CDN base URL is configured | Both clients still complete a relative one, so either works |

### New: `/editorial/decided` rows do not carry the report

Seen on 14 September. `GET /editorial/decided` returned five items, all
published, each shaped `{incidentId, vettingState, destination}` — no `id`,
`reportId`, `description`, `verification`, `capturedAtIso` or `media`. The spec
says "Each item includes section, lead, leadAt and leadUntil", but not the report
itself, while `/editorial/queue` and `/editorial/leading` return full incidents.

The console's Decided page read the rows as reports, found no `id` on any of
them, and showed "Nothing decided yet." over five published reports. It now
fetches `GET /editorial/{incidentId}` per row, which works but costs one request
per decided report.

**What would help:** return each decided item as the incident — the same shape as
`/editorial/queue` — with `section`, `lead`, `leadAt` and `leadUntil`, and
document the response schema. **Done when** a decided item carries `id`,
`reportId`, `description` and `media`.

### New: a photo report's media is served as an MP4

Seen on 14 September on **DW-CYX-W9N** ("Crime scene", filed 11 September as
`kind: "photo"`). Its `thumbUrl` draws a photograph correctly, but its default
media — `GET /v1/media/{id}` with no `v`, which is what `media.url` points at —
returns `206`, `Content-Type: video/mp4`, and bytes that begin `ftyp isom`: an
MP4 of the kind your transcode writes. A browser will not draw that in an
`<img>`, so the verification desk showed "The file could not be opened" on a
photo report.

Two possibilities, and either needs a look:

- **The pipeline made a web copy for a photo** and `media.url` now points at it
  (`v=playback`). The spec says `playbackUrl` is "always null for photos", so
  `media.url` for a photo should stay the photo.
- **The stored file really is a video filed under `kind: "photo"`** — in which
  case the record's `kind` and `mimeType` are wrong, and the thumbnail was cut
  from a clip.

**Done when:** `media.url` for a photo report answers `image/*`, or the report's
`kind` says `video`. The console now uses `v=view` for large stills and plays
video bytes it finds under a photo, so the desk is not blocked — but the phone
reads `media.url` as given.

### Round three — all five shipped (re-checked 14 September)

**A to E below are done.** Verified against the OpenAPI document:

| | What shipped | What the clients do with it |
|---|---|---|
| **A** | `PATCH /editorial/{id}` `{lead, leadUntil}`; `lead`/`leadUntil` on the transition; `lead`, `leadAt`, `leadUntil` on every incident; `GET /editorial/leading` documented as a page of incidents | The console has a Top story panel on every case, "Also lead the feed" on the verification decision, and a Leading page listing every current lead by desk with a way to clear it. The phone needs nothing: its rotation takes the first reports you return |
| **B** | `PUT /platform/settings`, clamped on write | The console's top-stories page saves to the service instead of its own file, and the phone reads `GET /settings` |
| **C** | `media.posterAtMs` on `MediaInput` | The phone sends the frame the reporter chose |
| **D** | `ETag` and `304` on `GET /v1/media/{id}`, plus `v=original\|playback\|poster\|thumb\|view` | — |
| **E** | `POST /uploads/{id}/complete` refuses bytes that do not match `mimeType`; `isTest` keeps a report off every desk | — |

The write-ups below are kept for the record of what each one was for.

### Round three requests, as sent

#### A. An editor cannot choose the top stories — **highest priority**

`GET /editorial/leading` exists ("Reports currently led on the feed"), but
**nothing can put a report on it or take one off.** The transition body is still
`{state, note, section}`, there is no `PATCH /editorial/{incidentId}`, and no
incident carries a `lead` field. So the phone's top-story rotation is simply the
five most recently published reports on a desk: a pothole published a minute
after a fatal accident leads above it, and the editor cannot change that.

**What we need:**

1. **Set or clear a lead without re-verifying the report:**

   ```
   PATCH /editorial/{incidentId}                 editor or platform_owner
   { "lead": true }
   { "lead": true, "leadUntil": "2026-09-15T18:00:00Z" }     optional expiry
   { "lead": false }
   ```

   Verification and prominence are different decisions. An editor must be able
   to lead a report published an hour ago — or drop one from the top — without
   recording a new verification decision.

2. **Accept `lead` on the transition too**, so publishing and leading can be one
   step:

   ```
   POST /editorial/{incidentId}/transition
   { "state": "verified_high_confidence", "section": "ghana", "lead": true }
   ```

3. **Return `lead` (and `leadUntil`, if added) on every incident** in
   `GET /incidents`, `/editorial/queue`, `/editorial/decided` and
   `/editorial/{incidentId}`, so both clients can show which reports are leading.

4. **Order `GET /incidents?section=…` with led reports first**, most recently led
   first, then the existing order. With nothing led, the order is unchanged — so a
   desk that never uses it behaves exactly as today. Expired leads
   (`leadUntil` in the past) drop back into normal order on their own.

5. **Document `GET /editorial/leading`'s response.** It publishes no schema
   today. We expect a page of incidents, each with `section`, `lead`,
   `leadUntil` and when it was led.

**Done when:** an editor leads a report that was published an hour ago, it
appears first in `GET /incidents?section=ghana` without being re-verified, it is
listed by `GET /editorial/leading`, and clearing the lead (or passing
`leadUntil`) returns it to its normal place.

**What we build the day this lands:** a "Lead on the feed" switch in the
console's decision panel (also on already-published reports), a "Leading now"
list where editors see and clear the running order, and a Leading badge on queue
rows. The phone needs no change — its rotation already takes the first reports
you return. Background in item 10.

#### B. Nothing can write the feed settings

`GET /settings` is public and the phone now reads it, but there is no
`PUT /platform/settings`. The platform desk's top-story count and dwell cannot
be changed without touching the database, and the console's settings page still
has nowhere to save.

```
PUT /platform/settings                           platform_owner only
{ "feed": { "topStoryCount": 3, "topStoryDwellMs": 8000 } }
→ 200 with the stored settings
```

Clamp on write and say so in the spec: `topStoryCount` 1–5,
`topStoryDwellMs` 3000–20000. Both clients clamp already; a value only the
clients refuse reads as saved in the console and behaves as something else on a
phone. **Done when** a platform owner's `PUT` is returned by `GET /settings`
within the five-minute cache. Background in item 8.

#### C. `posterAtMs` is not accepted on create

`posterUrl` is described as "extracted at posterAtMs (default 1s)", but
`MediaInput` on `POST /incidents` declares only `kind, mimeType, byteSize,
durationMs, width, height, sha256`. The frame a reporter picks on the phone
therefore still cannot reach you, and every poster is taken at one second —
often the moment the phone is still being raised.

Add `posterAtMs` (integer milliseconds, optional) to `MediaInput`. The phone
sends it as soon as it is declared. **Done when** a report created with
`media.posterAtMs: 4200` has a poster from 4.2 seconds in. Background in item 6.

#### D. Media responses send no `ETag`

`GET /v1/media/{id}` has no `ETag` and no `304` for `If-None-Match`. The stable
hourly `exp` already removes most re-downloads; this closes the rest, including
across the hour boundary. An incident's bytes never change, so an `ETag` of the
content hash is exact. **Done when** a repeat request with `If-None-Match`
answers `304`. Background in item 7.

#### E. Test submissions and non-media uploads

Nothing in the spec says `POST /uploads/{id}/complete` checks that the first
bytes match `mimeType`, and there is no `isTest` flag. The random-byte probes
("Routing diagnostic", "Hash probe submission", "Signed URL check") were still
in the editorial queue on 14 September. If they have since been purged and the
check is in, tell us and we will mark it done. Background in item 16.

#### Unchanged from the previous round

Items **1** (`destination` on routing rows), **3** (the six-hour integrity
check), **4** (`GET /me` membership case), **9** (who filed a report), **11**
(rate limiting) and **13** (documentation gaps).

Everything below is the original write-up of each item, kept for the detail.

---

Ten of the other items are closed — including item 12, the `/org/*` refusal,
which turned out to be a missing header on our side and is written up there
rather than deleted. One correction of ours is in item 3, because it changes what
your time check was ever tested against.

---

## Done — and what each one unblocked

| Was | Now | What it fixed on the client |
|---|---|---|
| **Nothing created an organisation** | `POST /platform/organisations` and `POST /platform/organisations/{id}/members` | Approval finally *is* the end of setup. Approving creates the organisation and adds the applicant as `owner` in the same action. |
| **No endpoint described the caller** | `GET /me`, plus the same object inline on the login response | The sign-in probe is deleted. An ordinary sign-in now makes no extra request at all. |
| **A platform owner was 403 on every editorial write** | `(editor or platform_owner)` on transition and workspace | An admin can review and route, which is what the flow always said. |
| **A `directed` report was published publicly** | "published only when destination is public or both; directed/marketplace stays exclusive" | The promise the phone makes the reporter is kept. The console's red warning about it is deleted. |
| **`POST /auth/signin` took no password** | Dev/test only, blocked unless `DAWURO_ALLOW_SIGNIN=1` | No longer a way in. |
| **A published report kept `section: null`** | `section` on the transition body, defaulting to `ghana` | A released report can no longer vanish from the mobile feed by having no desk. |
| **`/platform/routing` carried no report content** | Rows carry `report` | Enough to score every report on arrival and rank the queue by it. Not yet enough to drop the per-row fetch — see item 1. |
| **Two write endpoints published no request body** | `recipients` and `transition` both documented | No more sending a best reading and showing the server's own error as the spec. |
| **No public invite lookup** | `GET /invites/{token}`, `POST /invites/{token}/accept` | The invite page can be built. |
| **No platform metrics** | `GET /platform/metrics` | Returns submissions, organisations, accounts, commissions and routing. |
| **Nothing licensed or published a report** | `POST /org/incidents/{id}/license`, `POST /org/incidents/{id}/publish` | The inbox and the published desk can be wired. |
| **Publishing was a silent side effect** | The transition response carries `published`, `publishedAt`, `vettingState` and `section` | The desk finally tells the editor that the footage they just ruled on is in front of everybody. It could not before. |
| **`/org/incidents/{id}/license` published no body** | Documented as an empty object — the org plan decides the price, no client override | Licensing can be wired without guessing at a price field. |
| **`POST /platform/organisations` published no response** | Returns `{id, name, sector, verified, tier}`, with `id` marked "use this, not a guessed field name" | Four candidate field names and a name-matching fallback are deleted. |
| **`GET /v1/media/{id}` ignored `Range`** | `Accept-Ranges: bytes`, and `Range: bytes=0-99` → 206 with `Content-Range` | **The phone's download-to-disk workaround is deleted.** A clip starts on its first frames instead of its last byte, and the scrubber seeks without fetching what it skips. |
| **Nowhere to store a news-value assessment** | `GET`/`PUT /editorial/{id}/news-value`, merging, 400 on unknown keys, `If-Match`/409, no effect on publication | Ten ratings survive a reload and a colleague can see them. The panel's permanent "this is not saved" warning is gone. |
| **`media.posterUrl` was the video file itself** | `null` for a video | No client pulls megabytes of footage into an `<img>` to discover it cannot decode it. |
| **`location.label` was null on everything** | Reverse-geocoded at ingest — `5.6028, -0.2179` now comes back as `Accra` | Both desks and the phone show a place instead of a decimal. The client-side geocoding stopgaps now only fill gaps. |
| **Paged collections published no `limit`/`cursor`** | Documented on `/editorial/queue`, `/org/inbox` and `/platform/routing`; max 100 | The console pages properly and asks for 50 a time rather than the default 20. |
| **The integrity check flagged anything minutes old** | A capture 45 minutes old now passes | Most offline-first submissions survive the trip. See item 3 for what is left. |
| **`exp` on a media URL was the issue time** | A real deadline, one hour out | A client can tell whether a URL is still good instead of inferring it. |

That is the whole blocking list. Thank you — the second batch above closed nine of the
fifteen items that were open, including the two the desks were most badly held
back by.

---

## Still open

### 1. `/platform/routing` rows carry no `destination`

The inline `report` carries `category`, `severity`, `assurance`, `media`,
`location` and `capturedAtIso`. It does not carry `destination` — and that is
the single field the routing desk exists to act on. `public` and `marketplace`
are opposite instructions.

`/editorial/{id}` does return it, so the desk fetches that per row purely to
recover one field. Adding `destination` — and `handling`, which decides whether
a report may be routed to anybody at all — would let the desk drop a request per
row. `/editorial/queue` already sends both.

### 2. `media.url` is still relative

`/v1/media/{id}?exp=…&sig=…`, with no origin, on every projection. The field
description now explains the shape and mentions the CDN base, which is a real
improvement — the URL is still one every client has to complete itself.

Both clients absolutise it and neither is blocked. But the mobile app shipped a
bug where one projection's URLs reached the downloader unresolved, which reached
reporters as "this video could not be opened" about footage the service was
holding perfectly well. An absolute URL removes that class of bug, and the
signature already makes the URL self-contained.

### 3. The integrity check still flags a capture six hours old

Better, and not finished. Measured, three reports from one account differing
only in `capturedAtIso`:

| captured | `timeCheckPassed` | `verification` | `vettingState` |
|---|---|---|---|
| now | `true` | `integrity_passed` | `pending_review` |
| 45 minutes ago | `true` | `integrity_passed` | `pending_review` |
| **6 hours ago** | **`false`** | `integrity_flagged` | **`restricted`** |

Forty-five minutes covers the ordinary case and was the urgent part. Six hours
does not cover the case the product is built for: a reporter films where there is
no signal, and the outbox drains that evening, or the next morning in the next
town. Those reports are marked as integrity failures for having been filed
exactly as designed.

The check that means something is still available and is unaffected by delay: a
`capturedAtIso` in the future, or earlier than `deviceUptimeMs` allows, is a
real contradiction. Time between capture and upload is not.

One correction from our side, because it changes what the rule was ever tested
against: the phone was sending `deviceUptimeMs` as an epoch timestamp — about
1.79 × 10¹², so every report claimed the device had been switched on for
fifty-six years. It now sends real uptime from `expo-device`. If the time check
reads that field at all, its inputs were nonsense until 10 September and the
threshold is worth re-deriving against honest ones.

### 4. `GET /me` — the membership case is still untested

Correct today, and the case that matters has now partly arrived. Worth
confirming the shape once an organisation exists: the console reads `orgId`
first and falls back to the first entry in `memberships`, and an approved
newsroom whose membership appears in neither would see an empty console that
looks exactly like the bug this replaced.

### 5. Footage is stored in a container browsers will not open

Every clip on the platform is served as `Content-Type: video/quicktime`, because
that is what it is: `expo-camera` on iOS writes `.mov` and the app declares the
type honestly from the extension.

**Chrome and Edge refuse it outright.** `canPlayType('video/quicktime')` answers
the empty string, so a `<video>` element fails with
`MEDIA_ERR_SRC_NOT_SUPPORTED` before it fetches a byte — no request, nothing in
the network tab, no decode to inspect. The verification desk could not play any
footage filmed on an iPhone, while the phone played all of it, because iOS
`AVPlayer` handles QuickTime natively. It took two wrong diagnoses to find,
because the browser reports it identically to an expired signature.

The console now relabels it `video/mp4` on the way through its own media proxy,
which works because an iPhone's QuickTime file is H.264 in an ISO base media
container — a relabel, not a transcode. That is a workaround in one client, and
it does nothing for the case below.

**Update: new captures are no longer HEVC.** The app now asks iOS for `avc1`
explicitly on `recordAsync`, so everything filmed from today is H.264 and plays
on the desk once relabelled. What remains is the clips already stored.

**What we need:** a web copy of every video, made when the upload completes, and
served as the playable media. The original stays untouched and downloadable.

1. **Transcode to H.264 video, AAC audio, MP4 container, capped at 1080p.** This
   covers both problems at once — the container browsers refuse and the HEVC they
   cannot decode.
2. **Write the index at the front of the file (`-movflags +faststart`).** A camera
   writes the file's index (the `moov` atom) at the end, once recording stops, so
   a browser has to fetch the end of the file before it can show the first frame.
   That is the pause before every clip starts, and it is worse over the dev
   tunnel and mobile data.
3. **Backfill.** Run the same job once over every video already stored. The HEVC
   clips filmed before 11 September cannot be reviewed in a browser at all until
   this runs, and no client-side change reaches them.
4. **Serve it** — either from `media.url`, or as a new `media.playbackUrl`. Tell
   us which and both clients will follow.

```
ffmpeg -i original.mov \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -vf "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease" \
  -c:a aac -b:a 128k -movflags +faststart \
  web.mp4
```

If the full transcode has to wait, the index move alone is a copy with no
re-encode, and helps every H.264 clip today:

```
ffmpeg -i original.mov -c copy -movflags +faststart web.mp4
```

**Done when:**

- A video filed before 11 September opens and plays in Chrome on the
  verification desk.
- The playable URL answers `Content-Type: video/mp4`, and
  `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1 "$MEDIA_URL"`
  reports `codec_name=h264`.
- The first bytes of the served file contain `moov` before `mdat`.
- The original is still retrievable byte for byte, and its hash still matches the
  `sha256` sent at upload.

**And keep the codec in `media.mimeType` if the app sends one.** The phone now
declares `video/quicktime; codecs=avc1` or `; codecs=hvc1` where the recorder
reported it. That parameter is the difference between footage a browser will
open and footage it will not, and it is currently the only way either client can
tell before trying. If the service normalises the type on the way in, please
keep the `codecs` parameter rather than trimming it to the base type.

Related: a still frame for `posterUrl` would come out of the same pipeline — and
that is now its own item, below.

### 6. `posterUrl` is null for every video, and the clients are papering over it

Setting `posterUrl` to `null` was the right call — it used to be the video file
itself, which had clients handing an MP4 to an `<img>` and pulling megabytes down
a mobile connection to find out it would not decode. But nothing replaced it, so
**no client has a still for any clip on the platform.**

What that looks like: the phone's feed falls back to bundled category artwork, so
a column of flood reports is a column of identical drawings of a raindrop. The
reader cannot tell two reports apart, or tell a real one from a placeholder,
without opening each.

The app now cuts frames itself — it opens a player per clip, seeks a second in,
and keeps the result in its image cache. It works, and it should not exist:

- It costs **the reporter's data bundle**, not the server's. Taking a frame means
  pulling the head of the video down a mobile connection, per report, per device.
  One frame cut once on the server is paid for once, by us.
- It cannot work for **HEVC** — the same clips item 5 covers. Those stay
  clip-art on the phone and unplayable on the desk.
- It does nothing for **the editorial desk**, which is a browser and has no
  equivalent. The queue is still a grid of placeholder art.

**What we need:** `posterUrl` populated with a JPEG still for every video, from
the same pipeline as item 5. A second in rather than frame zero — phone
recordings routinely open on a blur or the ground while the operator is still
raising the phone:

```
ffmpeg -ss 1 -i input.mov -frames:v 1 -vf "scale=720:-2" -q:v 4 poster.jpg
```

Roughly 40–80 KB at that size, which is smaller than one wasted range request.
Signed like any other media URL is fine. If a clip is shorter than a second,
`-ss 0` for that one is better than a null.

Ship this and we delete `lib/videoPoster` from the app, and the desk gets stills
it has no way to generate at all.

**One more field while you are in that pipeline.** Let `POST /incidents` accept
`posterAtMs` — the millisecond of the clip the reporter picked as its thumbnail.
The app now offers that choice on the review screen, because the person who
filmed it knows which second shows the thing and a fixed one-second offset often
catches the phone still being raised. Today that choice is kept on the device and
is invisible to the desk and to every other reader. One integer on the create
call, used as the `-ss` value above, makes it real for everyone. Ignore it and
cut at one second when it is absent.

**Done when:**

- Every video in `/editorial/queue`, `/org/inbox` and `/incidents` has a
  non-null `posterUrl` that answers `image/jpeg`, at roughly 40–80 KB.
- A report created with `posterAtMs: 4200` has a poster from 4.2 seconds in.

### 7. There are no derivatives, so a thumbnail is a full-resolution original

The most expensive item on this list for the people actually using the product,
and the one nothing on the client can fix.

`posterUrl` for a photo is the photo, at capture resolution — a 2–5 MB JPEG
straight off a phone camera. That same URL is what fills a **112×86 feed row**, a
**one-third-width grid tile**, and a thumbnail on the editorial queue. A reporter
opening their profile downloads a dozen full-resolution photographs to draw
twelve postage stamps, on a Ghanaian mobile bundle. Reported to us simply as "the
pictures load slowly both mobile and web", and it is not the network.

Two things, in order of value:

1. **Store derivatives at ingest.** A `thumb` at 320px on the long edge and a
   `view` at 1280px, alongside the original, which stays untouched as the
   evidence. Publish them as `media.thumbUrl` and `media.viewUrl` — or as a
   `media.variants` object, whichever fits your schema better. A 320px JPEG is
   around 25 KB against 3 MB: **roughly a hundredfold** less traffic for a feed
   row, and it is the single change that would make both clients feel fast.

   ```
   ffmpeg -i original.jpg -vf "scale=320:-2" -q:v 5 thumb.jpg
   ffmpeg -i original.jpg -vf "scale=1280:-2" -q:v 4 view.jpg
   ```

2. **A stable identity for the bytes.** The signature on a media URL changes on
   every response, and a changed URL is a changed cache key — so until this week
   the phone re-downloaded the entire feed on every launch, having cached all of
   it. We have worked around it by keying the cache on the incident id instead,
   and the console's proxy has a stable path already, so neither client is
   blocked. It stops being a workaround if a derivative URL is stable and the
   signature moves to a header or a short-lived token, or if the `exp` is rounded
   so the same hour produces the same URL.

   Send `ETag` and `Cache-Control: private, max-age=3600` on media responses as
   well — an incident's bytes never change, so a browser that already holds them
   should be told so rather than download them again.

**Done when:**

- A `thumbUrl` for a phone photo is under about 40 KB, and `thumbUrl` and
  `viewUrl` are present on every projection that carries `media`.
- Two reads of the same report a minute apart return the same media URL.
- A repeat media request with `If-None-Match` answers `304`.

After the transcode in item 5, this is the change that would make both clients
feel fastest.

### 8. Nothing carries a platform-wide setting

New, and small. The mobile feed's top slot is now a rotation: several stories
share it and take turns. Two numbers decide how that reads — how many stories,
and how long each holds before the next slides in.

Those are editorial judgements. A busy news day wants more stories moving
faster; a quiet one wants fewer holding longer. They belong to the platform desk
and change with the day, which is exactly what a constant compiled into a mobile
release cannot do — changing six seconds to eight should not need an app store
review.

**Done — settings exist now.** `GET /settings` returns `{feed, commissions}` and
`PUT /platform/settings` accepts both, so a top-story count or a commission rate
set in the console reaches every phone. Both are wired. The paragraph below
described the state before that, when the console wrote to its own store because
the service carried no setting of any kind; it is kept for the history, not as a
request.

What would close it — a public read and an owner-only write:

```
GET /settings                      → 200 (no auth; every reader needs it)
    { "feed": { "topStoryCount": 5, "topStoryDwellMs": 6000 } }

PUT /platform/settings             → platform_owner only
    { "feed": { "topStoryCount": 3, "topStoryDwellMs": 8000 } }
```

Two notes that would save a round trip:

- **Make the read public and cacheable.** The phone wants it on the feed screen,
  including for a signed-out reader, and it changes perhaps twice a day — a
  `Cache-Control: public, max-age=300` would mean it costs nothing.
- **Clamp on write and publish the bounds.** Both clients clamp already (1–10
  stories, 3–20 seconds), because a zero empties the top of the feed and a
  200ms dwell is a strobe — but a value only the clients refuse is a setting
  that reads as saved in the console and behaves as something else on a phone.

A general `feed` object rather than two scalars, so the next feed-shaped
decision does not need another endpoint.

**Not asked for: a `featured` flag.** The rotation is the top of the order you
already return, which is the judgement editors made when they published each
report to a section. A second ranking would let the platform desk quietly
overrule the newsroom, invisibly to the people whose decisions it displaced. If
that is ever wanted it should be an explicit editorial action with a name on it,
not a sort key.

### 9. `/editorial/queue` says nothing about who filed a report

Reported to us as "reports sent when not signed in are not appearing in the
editor's list". They are appearing — we filed one with a device token and found
it in the queue, `vettingState: pending_review`, indistinguishable from the rest.
That is the problem: **indistinguishable**.

A report filed by a signed-in reporter and one filed by an anonymous device look
identical on this endpoint. An editor cannot tell them apart, cannot find a
particular one, and — more seriously — cannot weigh the thing that ought to
weigh on a verification decision. Footage from an account with a filing history
and footage from a device that appeared once are not equally corroborated, and
right now the desk sees neither fact.

`PublicIncident` already declares `publisher` and `reporter`. `/editorial/queue`
publishes no response schema at all, so we cannot tell from the document whether
it carries them; observed payloads do not.

**What we need on each queue row** — three fields, none of which breaks
anonymity:

```
"origin":       "citizen" | "newsroom" | …      (already on /platform/routing)
"authorKind":   "account" | "device"            (is there an account behind it)
"isAnonymous":  true | false                    (did the reporter ask to be unnamed)
```

`authorKind` is the one that matters most and the one that exists nowhere today.
Note it is **not** the reporter's identity: a guest is still a guest and an
anonymous report still publishes unnamed. It answers only "is there an account
behind this", which an editor needs and which reveals nothing about who.

Where a reporter has *not* asked for anonymity, `reporter` as
`PublicIncident` already defines it would let the desk credit them properly —
today the editorial desk cannot show a byline for a report it is about to
publish.

**One consequence worth stating plainly:** a report filed by a guest can never
be paid for, because there is no account to pay. The phone now warns a reporter
about that before they file. The desk should be able to see it too, so nobody is
credited or chased for a payment that cannot exist.

### 10. An editor cannot choose what leads the feed

The mobile feed's top slot is a rotation of several stories. **Which stories is
currently "the top of the order you return"** — so an editor's only lever over
the front page is the section they publish to, and within a section it is
whatever the service sorts first.

That is the wrong shape for a newsroom. Deciding what leads is the most
consequential editorial judgement of the day and it is the one the desk cannot
make. Two reports published a minute apart, one a fatal accident and one a
pothole, and the pothole leads because it was published second.

What would close it — one field the editor sets with the decision, and one
ordering rule:

```
POST /editorial/{id}/transition
    { "state": "...", "section": "ghana", "lead": true }

GET /incidents?section=ghana
    → reports with `lead: true` first, most recently led first,
      then the existing order
```

`lead` as a plain boolean on the report, readable by every client. The feed then
composes itself: the rotation takes the first N, which are the led stories when
there are any and the newest otherwise, so a desk that never touches it behaves
exactly as it does today.

Two things worth building in from the start, because retrofitting either is
painful:

- **Let it be set without re-deciding.** An editor should be able to lead a
  report published an hour ago without transitioning it again — a `PATCH
  /editorial/{id}` carrying `{lead}` alone, or the same field on the news-value
  endpoint. Verification and prominence are different judgements and forcing
  them through one call means an editor re-records a decision to change a
  running order.
- **Expire it, or let the desk see what is led.** A `lead` that nobody clears
  is a front page frozen on last Tuesday. Either an `expiresAt`, or simply a
  `GET /editorial/leading` so the desk can see the running order and take
  things off it.

Until this exists the console cannot offer the control at all — unlike item 8,
this is a per-report decision and there is nowhere durable to keep it that any
phone can read.

### 11. Rate limiting still blocks integration work

Roughly thirty requests in a few minutes produced 429, and the lockout held for
over twenty minutes. A higher ceiling for development would save hours — filing
three test reports to measure one rule costs about fifteen requests.

### 12. `/org/*` refused every member — closed, and it was ours

**Resolved. Nothing needed from you, and thank you for the error message that
found it.** Recorded here because it sat open across several rounds and the
earlier entry blamed the wrong thing.

The finding: `/org/*` is scoped by an `X-Dawuro-Org` header naming the
organisation a request is for, and neither client ever sent it.

```
no header             403  FORBIDDEN  X-Dawuro-Org header is required …
                                      details: { check: "org_header" }
header, not a member  403  FORBIDDEN  Caller is not a member of the organisation …
                                      details: { check: "membership" }
header, member        200
```

It held even for a token that already carried an `orgId` claim, which is why no
amount of signing in changed it — and why the console had ended up telling
operators that the service was contradicting itself. It was not. Both clients now
send the header on every organisation call.

Two things on your side made this findable, and they are worth saying:

- **The 403 now names the failed check.** The old message was `Token cannot
  access this endpoint` for every cause, and item 9 in the previous round asked
  for exactly this. `details.check` distinguishing `org_header` from `membership`
  turned a multi-round mystery into a ten-minute diagnosis.
- **`GET /me` answers membership without a scope.** The phone was inferring
  membership by probing `/org/dashboard` and reading a refusal as "not a member"
  — which, once the header landed, silently turned every organisation account on
  a phone into a reporter. `/me` replaces that probe outright.

**One request, and it is documentation rather than code:** the OpenAPI document
declares only `bearerAuth` on these routes. A required header that is not in the
spec is a 403 every new client will hit. Adding it as a parameter on the `/org/*`
paths — and to the `security` notes — would have saved this entirely.

### 13. Two small documentation gaps

Neither blocks anything.

- **`/editorial/decided` publishes no `limit` or `cursor`**, while `queue`,
  `inbox` and `routing` now do. It is presumably the same page envelope; the
  console pages it on the assumption that it is.
- **The signed media URL's lifetime is not published.** `exp` is now a real
  deadline an hour out — a genuine fix, and the ambiguity that made it
  unreadable is gone. Stating the hour in the description for `media.url` would
  let a client decide whether to re-read a record rather than measuring it.

### 14. A photo is streamed labelled as video

Seen on 14 September on `inc_8120bf147851` (DW-TMT-G6X): a photo report whose
record says `kind: "photo"`, `mimeType: "image/jpeg"`, integrity passed — and
`GET /v1/media/{id}` streamed it with a video `Content-Type`. A browser will not
draw an `<img>` whose response says it is a video, so the verification desk
showed "The file could not be opened" about a photograph that had arrived intact.

**Serve the stored `media.mimeType` as the `Content-Type`**, which is what the
phone declared and what the record already holds. The console now reads the
first bytes and corrects the label for images on its own media route, so the desk
works — but every other client, the phone included, reads the header as given.

Use the base type (`image/jpeg`, not the full parameterised string), and the web
copy's type once item 5 exists. Never infer it from anything else. Keep
`Accept-Ranges` and the `206` answers exactly as they are.

**Done when:**

- `inc_8120bf147851` answers `Content-Type: image/jpeg`.
- For every stored report, the header's base type equals the base of
  `media.mimeType`.

```
curl -s -D - -o /dev/null -H "Range: bytes=0-15" "$MEDIA_URL" | grep -i content-type
```

### 15. Nothing says when media is still being prepared

New, and it follows from items 5 and 6. Once copies are made after upload, there
is a window where a report exists and its web copy and poster do not. Without a
signal, a client in that window shows a player that fails — exactly the "the file
could not be opened" this list exists to end.

**What we need:** `media.status` on every projection that carries `media`:

```
"status": "processing" | "ready" | "failed"
```

While `processing`, serve the original as today. The clients will show "Preparing
video" for `processing` and a plain explanation for `failed`.

**Done when:** a report read immediately after `POST /uploads/{id}/complete`
shows `processing`, then `ready` once its copies exist.

### 16. Uploads that are not media reach the editorial queue

The triage queue holds integration probes — "Routing diagnostic", "Hash probe
submission", "Signed URL check", "End-to-end upload probe" — whose stored files
are **2,048, 4,096 or 8,192 bytes of random data** with no image or video header
at all. They pass integrity, rank beside real reports, and look to an editor like
broken footage. The console now labels anything that small "not playable
footage", but they should not be in front of an editor at all.

**What we need:**

1. **Check the bytes on `POST /uploads/{id}/complete`.** The first bytes must
   match the declared `mimeType` — JPEG begins `FF D8 FF`; MP4 and QuickTime carry
   `ftyp` at byte 4. Refuse a mismatch with an error that says so.
2. **Mark test submissions** — `isTest: true`, or anything filed by a test
   account — and leave them out of `/editorial/queue`, `/org/inbox`,
   `/platform/routing` and `/incidents`.
3. **Remove the probes already stored**, through `POST /platform/media/purge`,
   with `dryRun=true` first.

**Done when:**

- Completing an upload of random bytes declared as `image/jpeg` is refused.
- The triage queue contains no report whose file is under 20 KB.

### 17. An organisation cannot read one report

There is `GET /org/inbox` and nothing for a single incident. To play one licensed
report, the console fetches the inbox and searches it for the id — a page fetch
per video, and it misses any report beyond the first page.

**What we need:** `GET /org/incidents/{id}`, under the same `X-Dawuro-Org` header
and membership rules as the other `/org/*` routes, returning the incident with a
freshly signed `media` object.

**Done when:** a member reads a report from their inbox by id, and a caller who is
not a member gets `404`.

---

## What is verified working

- `POST /devices`; `POST /auth/register` and `POST /auth/login`, including the
  duplicate-email 409. Login now returns `accessToken`, `refreshToken`,
  `expiresAt`, `refreshExpiresAt` and `me`.
- `POST /incidents` → `PUT /uploads/{id}/chunks/{n}` → `POST /uploads/{id}/complete`.
- `GET /me`, `/me/incidents`, `/me/earnings`, `/me/commissions`.
- `GET /incidents`, `/organisations`, `/newsroom/items`.
- `GET /platform/routing` — 8 items, each carrying `report`.
- `GET /editorial/queue` — 18 items with full incident content including
  `destination`.
- `GET /platform/metrics`, `/platform/businesses`, `/platform/applications`.
- The publication path: `POST /editorial/{id}/corroboration` →
  `POST /editorial/{id}/transition` with `verified_high_confidence` →
  `vettingState: published` → visible in `/incidents`.

Everything is served under `/v1`.
