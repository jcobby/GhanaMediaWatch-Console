import 'server-only';
import { apiRequest } from './api';
import { requireSession } from './session';
import { ApiUnavailable } from './apiError';
import { pageOf, type Page } from './collection';
import { captureDevPayload } from './devCapture';
import { absoluteMedia, normaliseRoutingItem, type RoutingRow } from './normaliseRouting';
import { placeFor, resolvePlaces, type Point } from './placeName';
import type {
  Branch,
  OrganisationAccount,
  CommissionEntry,
  EditorialCase,
  Employee,
  Incident,
  Invite,
  MembershipRequest,
  OnboardingApplication,
  OrgAffiliation,
  PayoutBatch,
  RoutingItem,
} from '@dawuro/core';

/**
 * Every read this console performs, in one place.
 *
 * Each function takes the caller's backend token from their server-side session
 * and returns exactly what the page renders. Pages call these; nothing calls
 * `apiRequest` directly, so the token is unsealed in one file rather than in
 * forty.
 *
 * **No fallback, anywhere.** A failure throws, the page catches it and renders
 * the outage. A console that quietly serves seeded data while the backend is
 * down shows an operator a queue that is not real, and they will act on it.
 */

/**
 * `GET /org/subscription`, as the live service returns it.
 *
 * Declared here rather than in core because it is one endpoint's payload, not a
 * domain type — and because every field is optional in practice even where the
 * service happens to send it today. The plan it carries is priced by the
 * server; `@dawuro/core`'s table is the same pricing, kept in step by hand so
 * the phone's commission arithmetic and this console's charge cannot disagree.
 */
interface OrgSubscription {
  orgId?: string;
  tier: OrganisationAccount['tier'];
  status: OrganisationAccount['subscriptionStatus'];
  renewsAtIso?: string;
  seats?: number;
  seatsUsed?: number;
  metering?: { reportsUsedThisPeriod?: number };
}

/**
 * What to send as the caller, for one path.
 *
 * **`/org/*` needs a header, and not sending it was a 403 on every page.** The
 * service requires `X-Dawuro-Org` naming the organisation a request is for, and
 * refuses the route outright without it:
 *
 *     403 FORBIDDEN  X-Dawuro-Org header is required for organisation endpoints.
 *                    details: { check: "org_header" }
 *
 * An organisation operator signed in, and their inbox, team, published desk and
 * account pages were all refused. The console read that as a credential problem
 * and told them signing in again would not help — which was true and was not the
 * reason. It was this header, missing on every call.
 *
 * It is checked against membership rather than merely required: naming an
 * organisation the caller does not belong to answers `check: "membership"`. So
 * this is a scope declaration, not a secret, and a token that already carries an
 * `orgId` claim is still refused without it — verified against the live service.
 *
 * The token and the organisation come from one session read, so the two can
 * never describe different people.
 *
 * Absent when the session has no organisation, which is a real state rather than
 * an error: an applicant part-way through onboarding has an account and no
 * organisation yet, and `/org/onboarding` answering 403 for them is the
 * behaviour the onboarding page is written around.
 */
async function caller(): Promise<{ token: string; orgId: string | null }> {
  const session = await requireSession();
  if (!session.accessToken) {
    throw new ApiUnavailable(
      'TOKEN_INVALID',
      401,
      'This session carries no backend credential. Sign in again.',
    );
  }
  return { token: session.accessToken, orgId: session.businessId ?? null };
}

/** The organisation header, for the paths that require it. */
function orgHeader(path: string, orgId: string | null): Record<string, string> {
  return path.startsWith('/org/') && orgId ? { 'X-Dawuro-Org': orgId } : {};
}

async function get<T>(path: string): Promise<T> {
  const { token, orgId } = await caller();
  return apiRequest<T>(path, { token, headers: orgHeader(path, orgId) });
}

/**
 * How many pages this console will pull before it stops asking.
 *
 * At the API's default of twenty rows a page that is a thousand items, which is
 * far more than any desk here renders. The cap exists so a server that returns
 * a cursor forever cannot hang a page render — not because a thousand is a
 * meaningful number of reports.
 */
const MAX_PAGES = 50;

/**
 * Rows asked for per page.
 *
 * `limit` is documented now, and the maximum is 100 on `/editorial/queue` and
 * `/org/inbox` and 50 on `/incidents`. Fifty is under every ceiling and is two
 * and a half times fewer round trips than the default of 20 — which matters on
 * a cold instance, where each one is a second the desk spends blank.
 *
 * Asking for more than an endpoint allows is a 400, so this stays at the
 * lowest published maximum rather than the highest.
 */
const PAGE_SIZE = 50;

/**
 * One row of a paging trace. See `traceAs`.
 *
 * Deliberately the metadata and the identifiers, never the report content: this
 * is written to a file in the working tree, and these payloads carry reporter
 * identities and unmasked locations.
 */
interface PageTrace {
  request: number;
  url: string;
  envelopeKeys: string[];
  count: number;
  hasMore: boolean;
  nextCursor: string | null;
  /** Enough of each row to tell which report it is and how it got here. */
  rows: Record<string, unknown>[];
}

const TRACE_FIELDS = [
  'id',
  'incidentId',
  'reportId',
  'createdAt',
  'capturedAtIso',
  'vettingState',
  'verification',
  'destination',
] as const;

/**
 * Every row of a collection, not the first twenty.
 *
 * **`limit` defaults to 20 on every collection this API serves.** `/incidents`
 * and `/platform/routing` document it; `/editorial/queue` and `/org/inbox`
 * publish no parameters at all but describe their 200 as a "Queue page" and an
 * "Inbox page" and return the same `{items, nextCursor, hasMore}` envelope. The
 * console asked once and rendered the answer as the whole collection — so the
 * verification desk said "20 in the queue, most urgent first" whether there
 * were twenty reports or two hundred, and a report filed after the twentieth
 * appeared on no screen. Nothing errored. Nothing was empty. It just stopped.
 *
 * Three ways out of the loop, because the endpoints that need this most are the
 * ones that document nothing:
 *
 *   - the server says `hasMore: false`, or hands back no cursor;
 *   - a page comes back empty, which is the same statement by other means;
 *   - the cursor does not change, which is what an endpoint that ignores the
 *     parameter looks like — without this the console would fetch page one
 *     forever and grow the array until the request died.
 */
async function collect<T>(
  path: string,
  options: {
    /** Called with the untouched first page. Used to record undocumented shapes. */
    onFirstPage?: (raw: unknown) => Promise<void> | void;
    /** Omit the caller's token, for the endpoints readable without an account. */
    anonymous?: boolean;
    /**
     * Write a page-by-page trace to `.data/{traceAs}.json`, in development.
     *
     * **Temporary, and here for one question:** the verification desk shows
     * exactly twenty reports and new submissions do not appear. Twenty is the
     * API's default page size, so either the paging is not working or the
     * reports are not in the queue the server returns — and those call for
     * opposite fixes, in different repositories. Nothing visible from the
     * browser distinguishes them.
     *
     * `/editorial/queue` needs an editor token that cannot be minted outside
     * the running console, so what the console received is the only place the
     * answer exists. Delete this with `devCapture` itself.
     */
    traceAs?: string;
  } = {},
): Promise<T[]> {
  const identity = options.anonymous ? null : await caller();
  const token = identity?.token;
  // The same scope header every organisation read needs. See `caller`.
  const extra = orgHeader(path, identity?.orgId ?? null);
  const out: T[] = [];
  const trace: PageTrace[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();

  for (let request = 0; request < MAX_PAGES; request += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const url: string = cursor
      ? `${path}${separator}limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`
      : `${path}${separator}limit=${PAGE_SIZE}`;
    const raw = await apiRequest<Page<T> | T[]>(url, token ? { token, headers: extra } : {});
    if (request === 0) await options.onFirstPage?.(raw);

    const page = pageOf<T>(raw, path);
    out.push(...page.items);

    if (options.traceAs) {
      trace.push({
        request,
        url,
        envelopeKeys: Array.isArray(raw) ? ['<bare array>'] : Object.keys(raw ?? {}),
        count: page.items.length,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
        rows: page.items.map((item) => {
          const row = item as unknown as Record<string, unknown>;
          return Object.fromEntries(
            TRACE_FIELDS.filter((f) => row?.[f] !== undefined).map((f) => [f, row[f]]),
          );
        }),
      });
    }

    if (!page.hasMore || !page.nextCursor || page.items.length === 0) break;
    if (seen.has(page.nextCursor)) break;
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  if (options.traceAs) {
    await captureDevPayload(options.traceAs, {
      path,
      capturedAtIso: new Date().toISOString(),
      totalCollected: out.length,
      pages: trace,
    });
  }

  return out;
}

async function send<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const { token, orgId } = await caller();
  return apiRequest<T>(path, {
    method,
    ...(body !== undefined ? { body } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    token,
    // Writes need it as much as reads: licensing and publishing are org routes.
    headers: orgHeader(path, orgId),
  });
}

// ─── organisation ──────────────────────────────────────────────────────────

export const org = {
  dashboard: <T>() => get<T>('/org/dashboard'),
  /**
   * The signed-in operator's own organisation.
   *
   * Every organisation page needs it, and each of them used to find it with
   * `ORGANISATIONS.find(b => b.id === session.businessId) ?? ORGANISATIONS[1]!` —
   * so an operator whose account could not be resolved was shown a *different*
   * organisation's inbox, plan, allowance and invoices, with nothing on screen
   * indicating it was not theirs. There is no fallback here: if the server
   * cannot say who this is, the page says so.
   */
  current: async <T>(): Promise<T> => {
    /*
     * **Not `/org/dashboard`, which does not describe the organisation at all.**
     *
     * This used to read that endpoint and take `dashboard.organisation ??
     * dashboard` — a guess at whether the payload wrapped the organisation or
     * was the organisation. Measured against the live service it is neither: it
     * returns `{counts, dailyTrend, recentHighPriority}` and nothing else. So
     * the guess handed every page a dashboard wearing an organisation's type,
     * `organisation.tier` was `undefined`, and the first page to price a
     * download threw `Cannot read properties of undefined`.
     *
     * `/org/subscription` is the endpoint that actually knows: `orgId`, `tier`,
     * `status`, `renewsAtIso`, `seats`, `seatsUsed`, `metering` — and the plan
     * itself, priced. The identity the service does not carry here (name,
     * sector, interests) comes from the session, which learned it at sign-in.
     */
    const subscription = await get<OrgSubscription>('/org/subscription');
    const session = await requireSession();

    return {
      id: subscription.orgId ?? session.businessId ?? '',
      name: session.businessName ?? subscription.orgId ?? '',
      /*
       * Not on the wire anywhere reachable by an organisation's own token.
       * Declared rather than guessed: `other` is the neutral sector and
       * `verified: false` is the claim that cannot mislead — an unverified
       * organisation shown as verified would be credited publicly on somebody
       * else's footage.
       */
      sector: 'other',
      verified: false,
      tier: subscription.tier,
      subscriptionStatus: subscription.status,
      renewsAtIso: subscription.renewsAtIso ?? '',
      seatsUsed: subscription.seatsUsed ?? 0,
      reportsUsedThisPeriod: subscription.metering?.reportsUsedThisPeriod ?? 0,
      // Routing runs server-side; the console does not re-derive it, so an
      // empty list here costs nothing and inventing one would be a claim.
      interests: [],
      logoUrl: null,
    } as T;
  },
  /*
   * Place names filled in, like the editorial queue's. An operator deciding
   * whether to license a report needs to know where it was filmed, and the
   * service sends no label for anything it holds.
   */
  inbox: async <T>() => withPlaceNames(await collect<T>('/org/inbox')),
  members: <T>() => collect<T>('/org/members'),
  invites: <T>() => collect<T>('/org/invites'),
  employees: <T>() => collect<T>('/org/employees'),
  branches: <T>() => collect<T>('/org/branches'),
  affiliations: <T>() => collect<T>('/org/affiliations'),
  invoices: <T>() => collect<T>('/org/invoices'),
  surveys: <T>() => collect<T>('/org/surveys'),
  queries: <T>() => collect<T>('/org/queries'),
  plans: <T>() => collect<T>('/org/plans'),
  subscription: <T>() => get<T>('/org/subscription'),
  onboarding: <T>() => get<T>('/org/onboarding'),
  audit: <T>() => collect<T>('/org/audit'),
  membershipRequests: <T>() => collect<T>('/org/membership-requests'),
  internalSubmissions: <T>() => collect<T>('/org/internal-submissions'),

  /*
   * A licence is money. The report's own id is the idempotency key, so a
   * double-submitted form or a retried request cannot charge an organisation
   * twice for the same report.
   */
  license: <T>(incidentId: string) =>
    send<T>(
      `/org/incidents/${encodeURIComponent(incidentId)}/license`,
      'POST',
      {},
      `license:${incidentId}`,
    ),
  publish: <T>(incidentId: string, body: unknown) =>
    send<T>(`/org/incidents/${encodeURIComponent(incidentId)}/publish`, 'POST', body),
  setStatus: <T>(incidentId: string, body: unknown) =>
    send<T>(`/org/incidents/${encodeURIComponent(incidentId)}/status`, 'POST', body),
  respond: <T>(incidentId: string, body: unknown) =>
    send<T>(`/org/incidents/${encodeURIComponent(incidentId)}/response`, 'POST', body),
  note: <T>(incidentId: string, body: unknown) =>
    send<T>(`/org/incidents/${encodeURIComponent(incidentId)}/notes`, 'POST', body),
  assign: <T>(body: unknown) => send<T>('/org/assignments', 'POST', body),
  invite: <T>(body: unknown) => send<T>('/org/invites', 'POST', body),
  createSurvey: <T>(body: unknown) => send<T>('/org/surveys', 'POST', body),
  checkout: <T>(body: unknown) => send<T>('/org/checkout', 'POST', body),
};

// ─── the signed-in person ──────────────────────────────────────────────────

/**
 * What this account has filed and earned.
 *
 * Reporter-scoped, and reachable by any signed-in account — which is why the
 * console's earnings page can be verified against a live backend while the
 * organisation pages cannot.
 */
export const me = {
  incidents: <T>() => collect<T>('/me/incidents'),
  earnings: <T>() => get<T>('/me/earnings'),
  commissions: <T>() => collect<T>('/me/commissions'),
};

// ─── platform ──────────────────────────────────────────────────────────────

/**
 * One report's content, for a desk that was handed only its id.
 *
 * Two endpoints can answer, and which one applies depends on where the report
 * has got to. `/editorial/{id}` is the pre-publication workspace, which is what
 * a report awaiting routing is; `/incidents/{id}` is the public record, which
 * only exists once it has been released. Both are tried because the routing
 * queue holds reports in both states.
 *
 * A failure returns null rather than throwing. One unreadable report must not
 * empty the whole queue — the operator can still see it is there, identified by
 * its reference, and can still route it. Losing eight rows because the ninth
 * 404s would be a worse failure than the one being fixed.
 */
async function incidentDetail(incidentId: string): Promise<Record<string, unknown> | null> {
  const encoded = encodeURIComponent(incidentId);
  /*
   * Temporary: what each endpoint actually answered.
   *
   * The merge came back empty and a swallowed error cannot say why. Probing
   * from outside settles only what a *plain account* is told — `/incidents/{id}`
   * answers 404 because the report is not published, and `/editorial/{id}`
   * answers 403 for a role that account does not hold. Whether a platform owner
   * is allowed into `/editorial` can only be learned from a request made as
   * one, and this console is the only thing that can make it.
   */
  const attempts: { path: string; status: number; message: string }[] = [];

  for (const path of [`/editorial/${encoded}`, `/incidents/${encoded}`]) {
    try {
      const detail = await get<Record<string, unknown>>(path);
      /*
       * The editorial workspace wraps the report rather than being it. Either
       * shape is unwrapped here so the desk never has to know which endpoint
       * answered.
       */
      const inner = detail.incident ?? detail.report ?? detail;
      await captureDevPayload('incident-detail', { path, keys: Object.keys(detail), detail });
      return inner as Record<string, unknown>;
    } catch (cause) {
      attempts.push({
        path,
        status: cause instanceof ApiUnavailable ? cause.status : 0,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      // Wrong state for this endpoint, or refused. Try the next.
    }
  }

  await captureDevPayload('incident-detail-failures', { incidentId, attempts });
  return null;
}

export const platform = {
  applications: <T>() => collect<T>('/platform/applications'),
  /*
   * **`/platform/organisations`, and it stays that way.**
   *
   * A distinct endpoint from `POST /platform/organisations`, which creates one:
   * this reads the list. The vocabulary rename swept the whole codebase to
   * "organisation" and briefly took this path with it, which pointed a GET at a
   * POST-only route — the kind of breakage a rename produces silently, because
   * the name reads correctly and only the wire disagrees.
   *
   * The method is named for the thing; the string is the server's.
   */
  organisations: <T>() => collect<T>('/platform/businesses'),
  payouts: <T>() => collect<T>('/platform/payouts'),
  /**
   * The routing queue, in the shape the desk reads.
   *
   * Normalised here rather than in each of the three pages that read it, so a
   * page cannot forget and render blank rows again.
   */
  /**
   * The routing queue, in the shape the desk reads.
   *
   * **Two requests, because the overview is not the report.** A captured
   * response settled what `/platform/routing` actually returns, and it is only
   * this:
   *
   *     {"items":[{"incidentId":"inc_2401a8b95171","matches":[]}], …}
   *
   * Two fields. No description, no media, no category, no timestamp, no
   * reporter. It is a list of routing *decisions* — which reports need one, and
   * what the matcher found — not a list of reports.
   *
   * The desk was reading it as reports, so every field resolved to `undefined`
   * and fell to a default. The operator saw eight identical rows reading OTHER
   * / "No description filed" / "No reference", each with an empty media tile:
   * "OTHER" was `?? 'other'`, "marketplace" was `?? 'marketplace'`, and the
   * React key was `?? ''` — the same empty string on all eight, which is a
   * duplicate-key error and means React cannot tell the rows apart at all.
   * Nothing on that screen was real.
   *
   * So the content is fetched per report and merged over the routing row. That
   * is one request per queued report, which is acceptable on a desk sized for a
   * person to work through and is the only way to get the data.
   */
  routing: async (): Promise<RoutingRow[]> => {
    /*
     * Paged, and the desk needs all of it.
     *
     * `limit` is documented as defaulting to 20 here. The desk read one page
     * and called it the queue, so the twenty-first report waiting to be routed
     * was on no screen — the same silence as the editorial queue, on the desk
     * that decides who receives a report at all.
     */
    const rows = await collect<
      Parameters<typeof normaliseRoutingItem>[0] & { incidentId?: string }
    >('/platform/routing', {
      // Temporary: this endpoint publishes no response schema and needs a
      // platform token, so a real response is the only specification available.
      // See lib/devCapture.ts.
      onFirstPage: (raw) => captureDevPayload('routing-raw', raw),
    });

    const merged = await Promise.all(
      rows.map(async (row) => {
        const id = row.incidentId ?? row.id;
        if (!id) return row;
        const detail = await incidentDetail(id);
        /*
         * The routing row wins on any field they share. It is the authority on
         * this report's place in the queue — its id and its matches — and the
         * incident record is the authority on what the report *is*.
         *
         * When the content cannot be read the row is marked, rather than left
         * to fall through to defaults. `category ?? 'other'` and
         * `destination ?? 'marketplace'` put the words OTHER and marketplace on
         * screen for eight reports nobody had read — an operator cannot tell a
         * report genuinely filed under "other" from one whose category never
         * arrived, and they route on exactly that.
         */
        return detail ? { ...detail, ...row } : { ...row, contentUnavailable: true };
      }),
    );

    await captureDevPayload('routing-merged', merged[0] ?? null);

    return merged.map(normaliseRoutingItem);
  },
  audit: <T>() => collect<T>('/platform/audit'),
  takedowns: <T>() => collect<T>('/platform/takedowns'),
  legalHolds: <T>() => collect<T>('/platform/legal-holds'),
  retentionPolicy: <T>() => get<T>('/platform/retention-policy'),
  retentionInventory: <T>() => get<T>('/platform/retention/inventory'),
  retentionJobs: <T>() => collect<T>('/platform/retention/jobs'),

  approve: <T>(id: string) =>
    send<T>(
      `/platform/applications/${encodeURIComponent(id)}/approve`,
      'POST',
      {},
      `approve:${id}`,
    ),
  /**
   * Create the organisation. The step that had no endpoint until now.
   *
   * `POST /platform/organisations` — the backend's own summary calls it "the
   * end of setup", which is the product owner's phrase for it: an organisation
   * registers, completes onboarding, an admin approves, and it is then live.
   * Before this existed, approval could only flip a status in a file this
   * console keeps, so an approved newsroom signed in to a working account with
   * no organisation behind it and every `/org/*` read answered 403.
   *
   * Keyed on the application, so a double-click or a retried request cannot
   * create the same newsroom twice.
   */
  createOrganisation: <T>(
    body: { name: string; sector: string; interests?: string[]; tier?: string },
    key: string,
  ) => send<T>('/platform/organisations', 'POST', body, `create-organisation:${key}`),

  /**
   * Put the applicant inside the organisation just created.
   *
   * By email, because that is what the application holds and what the person
   * signs in with — the console never sees their user id. Without this the
   * organisation exists and its own operator is still not a member of it, which
   * looks identical to the bug above from their side of the screen.
   */
  addOrganisationMember: <T>(orgId: string, body: { email: string; role: string }) =>
    send<T>(
      `/platform/organisations/${encodeURIComponent(orgId)}/members`,
      'POST',
      body,
      `add-member:${orgId}:${body.email}`,
    ),

  decideStep: <T>(id: string, stepId: string, body: unknown) =>
    send<T>(
      `/platform/applications/${encodeURIComponent(id)}/steps/${encodeURIComponent(stepId)}/decide`,
      'POST',
      body,
    ),
  screen: <T>(id: string) =>
    send<T>(`/platform/applications/${encodeURIComponent(id)}/screening`, 'POST', {}),
  // Releasing money. Keyed on the batch so a retry cannot pay twice.
  createPayoutBatch: <T>(body: unknown, key: string) =>
    send<T>('/platform/payouts/batches', 'POST', body, `payout-batch:${key}`),
  setRecipients: <T>(incidentId: string, body: unknown) =>
    send<T>(`/platform/routing/${encodeURIComponent(incidentId)}/recipients`, 'POST', body),
  decideTakedown: <T>(id: string, body: unknown) =>
    send<T>(`/platform/takedowns/${encodeURIComponent(id)}`, 'PATCH', body),
};

// ─── editorial ─────────────────────────────────────────────────────────────

/**
 * The triage queue with each report's content attached.
 *
 * The same shape of bug as the routing desk, in a second place. `/editorial/queue`
 * returns *cases* — `incidentId`, corroboration, contacts, notes, decisions —
 * and not the reports themselves. The workbench renders from `case.incident`,
 * which the queue does not send, so the page said "The queue is clear." while
 * the sidebar badge beside it read 19. Two numbers for one queue, and the
 * emptier one was the lie: there was work, and an editor could not see it.
 *
 * Each report is fetched by id, exactly as the routing desk does, through the
 * endpoint a signed-in editor is meant to use for this.
 */
export async function editorialQueueWithReports<C extends { incidentId?: string }>(): Promise<{
  cases: C[];
  reports: Record<string, unknown>[];
}> {
  /*
   * The queue items *are* the reports.
   *
   * Confirmed by reading the live endpoint with an editor token: each item is a
   * full incident — `id`, `reportId`, `category`, `description`, `media`,
   * `verification`, `vettingState` — and there is no `incident` wrapper and no
   * `incidentId` field anywhere on it.
   *
   * Both previous readings were wrong, in opposite directions. The original
   * `cases.map(c => c.incident)` looked for a wrapper that does not exist. My
   * first correction then read `item.incidentId` and fetched each report
   * separately — also absent, so it produced an empty list *and* a request per
   * row. Nineteen reports were sitting in the payload the whole time, while the
   * page said "The queue is clear." beside a sidebar badge reading 19.
   */
  const raw = await editorial.queue<Record<string, unknown>>();

  /*
   * Media paths made absolute before they leave the server.
   *
   * `media.url` arrives relative — `/v1/media/{id}?exp=…&sig=…` — and the
   * origin lives in a server-only variable, so a client component cannot build
   * it. The verification desk showed a black rectangle where the footage should
   * be for exactly this reason, which is a bad failure on the one screen whose
   * whole job is looking at the footage.
   */
  const reports = raw.map((report) => {
    const media = report.media as { url?: string; posterUrl?: string | null } | undefined;
    if (!media) return report;
    const kind = (media as { kind?: string }).kind;
    /*
     * A photo is its own poster.
     *
     * `media.posterUrl` is null for everything the service stores — for a video
     * because it generates no still, and for a *photo* because the photo is
     * already at `media.url`. Passing the null straight through gave the
     * verification desk a broken image on every photo report, which is the same
     * fault the routing desk had and the same fix: the still frame is the
     * poster if there is one, and the file itself when the file is an image.
     */
    const poster = media.posterUrl ?? (kind === 'photo' ? media.url : null);

    return {
      ...report,
      media: {
        ...media,
        ...(media.url ? { url: absoluteMedia(media.url) } : {}),
        ...(poster ? { posterUrl: absoluteMedia(poster) } : {}),
      },
    };
  });

  /*
   * The case — corroboration, contacts, notes, decisions — is a separate
   * record, and `/editorial/queue` does not carry it. `/editorial/{id}` returns
   * it as `{incident, editorial}`, but `editorial` is
   * `{verification, permittedRepresentation, corroborationChecks, auditTrail}`,
   * which is not the shape `EditorialCase` describes, and both arrays were
   * empty in every sample — so there is nothing to map it from with confidence.
   *
   * Left empty rather than guessed. The workbench already falls back to an
   * empty case, so the screen behaves exactly as it did; what changes is that
   * the reports are now there. Tracked in BACKEND-REQUESTS.md.
   */
  return { cases: [] as C[], reports: await withPlaceNames(reports) };
}

/**
 * Give every report a place a person recognises.
 *
 * The service resolves no place names — every incident comes back
 * `"label": null` beside the fix that produced it — so the desk was showing
 * `5.6028° N, 0.2179° W`. Nobody deciding whether a report is worth running
 * knows where 5.6028 is; the same point is **Abelenkpe, Accra**.
 *
 * Done here, on the server, because the whole queue shares a handful of places
 * and one lookup serves every row standing on it. A `label` the service did
 * send is never overwritten: it is the authority, and this only fills a gap.
 *
 * See `placeName` for the cache and the time budget. Nothing here can fail the
 * page — an unresolved point keeps its null label and the desk falls back to
 * the coordinates, exactly as it does today.
 */
export async function withPlaceNames<T>(reports: T[]): Promise<T[]> {
  const locationOf = (report: T) =>
    (report as { location?: (Point & { label?: string | null }) | null }).location ?? null;

  const points = reports
    .map(locationOf)
    .filter((location): location is Point & { label?: string | null } => Boolean(location));

  const places = await resolvePlaces(points);
  if (places.size === 0) return reports;

  return reports.map((report) => {
    const location = locationOf(report);
    if (!location || location.label) return report;

    const label = placeFor(places, location);
    return label ? ({ ...report, location: { ...location, label } } as T) : report;
  });
}

export const editorial = {
  queue: <T>() => collect<T>('/editorial/queue', { traceAs: 'editorial-queue-paging' }),
  decided: <T>() => collect<T>('/editorial/decided', { traceAs: 'editorial-decided' }),
  workspace: <T>(incidentId: string) => get<T>(`/editorial/${encodeURIComponent(incidentId)}`),
  transition: <T>(incidentId: string, body: unknown) =>
    send<T>(`/editorial/${encodeURIComponent(incidentId)}/transition`, 'POST', body),
  corroborate: <T>(incidentId: string, body: unknown) =>
    send<T>(`/editorial/${encodeURIComponent(incidentId)}/corroboration`, 'POST', body),
};

// ─── public ────────────────────────────────────────────────────────────────

/**
 * Readable without a console account.
 *
 * `/verify` is deliberately here: anybody handed a report reference must be
 * able to check it, including someone who has never signed in.
 */
export const publicApi = {
  organisations: <T>() => collect<T>('/organisations', { anonymous: true }),
  organisation: <T>(id: string) => apiRequest<T>(`/organisations/${encodeURIComponent(id)}`),
  incidents: <T>(query = '') => collect<T>(`/incidents${query}`, { anonymous: true }),
  byReference: <T>(reportId: string) =>
    apiRequest<T>(`/incidents/by-reference/${encodeURIComponent(reportId)}`),
  newsroom: <T>() => collect<T>('/newsroom/items', { anonymous: true }),
};

// ─── the admin dashboards ──────────────────────────────────────────────────

/**
 * Everything the nine admin dashboards read.
 *
 * One bundle rather than nine bespoke fetches, because the dashboards overlap
 * heavily and a per-role fetch list would drift the moment somebody adds a
 * widget. Each part is optional in the sense that it can come back empty — but
 * nothing here is invented, and a total failure takes the page.
 */
export interface AdminData {
  organisations: OrganisationAccount[];
  applications: OnboardingApplication[];
  payoutBatches: PayoutBatch[];
  commissions: CommissionEntry[];
  routing: RoutingItem[];
  incidents: Incident[];
  editorialCases: EditorialCase[];
  employees: Employee[];
  branches: Branch[];
  affiliations: OrgAffiliation[];
  invites: Invite[];
  membershipRequests: MembershipRequest[];
  /**
   * The append-only platform ledger.
   *
   * Loosely typed because `@dawuro/core` declares no shape for it — the ledger
   * is the server's record, and the console only ever renders it. Pinning a
   * shape here would be inventing a contract rather than reading one.
   */
  audit: Record<string, unknown>[];
}

/**
 * Read it all, tolerating the parts this role cannot see.
 *
 * An auditor can read the ledger but not the payout batches; a branch manager
 * the reverse. Failing the whole page because one endpoint is out of a role's
 * reach would leave every dashboard blank for everyone, so a refused part
 * comes back empty and the widget above it simply shows nothing — which is the
 * truthful rendering of "you cannot see this".
 *
 * `/platform/organisations` is the exception: it is the spine of every dashboard,
 * so its failure is the page's failure.
 */
export async function loadAdminData(): Promise<AdminData> {
  const soft = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

  const [
    organisations,
    applications,
    payoutBatches,
    routing,
    editorialCases,
    employees,
    branches,
    affiliations,
    invites,
    membershipRequests,
    audit,
  ] = await Promise.all([
    platform.organisations<OrganisationAccount>(),
    soft(platform.applications<OnboardingApplication>()),
    soft(platform.payouts<PayoutBatch>()),
    soft(platform.routing()),
    soft(editorial.queue<EditorialCase>()),
    soft(org.employees<Employee>()),
    soft(org.branches<Branch>()),
    soft(org.affiliations<OrgAffiliation>()),
    soft(org.invites<Invite>()),
    soft(org.membershipRequests<MembershipRequest>()),
    soft(platform.audit<Record<string, unknown>>()),
  ]);

  return {
    organisations,
    applications,
    payoutBatches,
    // Commission lines travel inside their batch; there is no platform-wide
    // ledger endpoint, and an empty list is the honest stand-in for one.
    commissions: payoutBatches.flatMap(
      (b) => (b as PayoutBatch & { entries?: CommissionEntry[] }).entries ?? [],
    ),
    routing,
    // The organisation inbox is the only incident set an operator is entitled
    // to; the public feed is published-only and would misrepresent the queue.
    incidents: await soft(org.inbox<Incident>()),
    editorialCases,
    employees,
    branches,
    affiliations,
    invites,
    membershipRequests,
    audit,
  };
}
