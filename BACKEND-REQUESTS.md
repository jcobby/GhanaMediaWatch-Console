# What the Dawuro backend needs, in priority order

For the backend developer.

**Re-verified on 10 September 2026** against the published OpenAPI document at
`https://698zp0x7-8000.uks1.devtunnels.ms/v1/openapi.json` and by filing real
reports through `POST /incidents` and reading them back. Every status code,
header and field value quoted here was observed rather than inferred.

Ten of the seventeen items are closed — including item 10, the `/org/*` refusal,
which turned out to be a missing header on our side and is written up there
rather than deleted. Ten remain. Items 6 and 7 are new and are the two that
cost real people the most right now: no client has a still frame for any clip,
and a thumbnail anywhere in either product is a full-resolution original. **If
only one thing here ships, make it the `thumb` derivative in item 7.** One
correction of ours is in item 3, because it changes what your time check was
ever tested against.

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

Two things would fix it properly, in order of value:

1. **Serve a browser-playable content type**, or store one. The bytes do not
   need to change for H.264 in `.mov`; the label does.
2. **Generate a web rendition for HEVC.** An iPhone on the "High Efficiency"
   setting records HEVC, which no desktop browser can decode however it is
   labelled. Those reports cannot be reviewed in a browser at all today. A
   transcoded H.264 MP4 alongside the original — the original stays the
   evidence — is the only thing that makes them viewable on the desk.

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

If only one thing on this list ships, make it the `thumb`.

### 8. Nothing carries a platform-wide setting

New, and small. The mobile feed's top slot is now a rotation: several stories
share it and take turns. Two numbers decide how that reads — how many stories,
and how long each holds before the next slides in.

Those are editorial judgements. A busy news day wants more stories moving
faster; a quiet one wants fewer holding longer. They belong to the platform desk
and change with the day, which is exactly what a constant compiled into a mobile
release cannot do — changing six seconds to eight should not need an app store
review.

**The console already has the control.** It writes to its own store and the page
says plainly that nothing reaches a phone yet, because there is no route on the
service that carries a setting of any kind.

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

### 9. Rate limiting still blocks integration work

Roughly thirty requests in a few minutes produced 429, and the lockout held for
over twenty minutes. A higher ceiling for development would save hours — filing
three test reports to measure one rule costs about fifteen requests.

### 10. `/org/*` refused every member — closed, and it was ours

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

### 11. Two small documentation gaps

Neither blocks anything.

- **`/editorial/decided` publishes no `limit` or `cursor`**, while `queue`,
  `inbox` and `routing` now do. It is presumably the same page envelope; the
  console pages it on the assumption that it is.
- **The signed media URL's lifetime is not published.** `exp` is now a real
  deadline an hour out — a genuine fix, and the ambiguity that made it
  unreadable is gone. Stating the hour in the description for `media.url` would
  let a client decide whether to re-read a record rather than measuring it.

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
