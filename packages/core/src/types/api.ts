/**
 * The API contract as TypeScript.
 *
 * This file is the single source of truth for every shape crossing the network
 * boundary, and it mirrors API_CONTRACT.md exactly. If the two disagree, the
 * document is what the backend engineer builds against — fix both together.
 *
 * Enumerations are closed unions on purpose: adding a server-side value without
 * shipping the client first is a breaking change, and this makes that a compile
 * error rather than a runtime surprise.
 */

// ─── enumerations ──────────────────────────────────────────────────────────

import type { AssuranceClass, VerificationState } from './assurance';
import type { HandlingRequirement, Severity } from './context';

export const INCIDENT_CATEGORIES = [
  // Emergency
  'fire',
  'accident',
  'flood',
  'weather',
  'health',
  // Crime and safety
  'crime',
  'disorder',
  'protest',
  // Public services
  'utility',
  'water',
  'sanitation',
  'road',
  'transport',
  'infrastructure',
  'education',
  // Governance
  'corruption',
  'election',
  'chieftaincy',
  'land',
  // Environment
  'galamsey',
  'environment',
  'wildlife',
  // Catch-all
  'other',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/**
 * The coarse public-feed state.
 *
 * Superseded by VerificationState, which carries the eight editorial states and
 * the language permitted for each. Retained because the public feed renders
 * this, and `vettingStateFor` maps down to it.
 */
export type VettingState = 'pending_review' | 'published' | 'rejected' | 'restricted';

/**
 * What was captured.
 *
 * Audio is a first-class report type, not a lesser one: describing an incident
 * from somewhere safe carries none of the risk of filming it, and it is the
 * only mode that works in the dark or in a crowd.
 */
export type MediaKind = 'photo' | 'video' | 'audio';

/** `low` means the reporter used the reduced-accuracy escape hatch at capture. */
export type LocationConfidence = 'high' | 'low';

/**
 * How much of the capture timestamp the reporter allowed to be published.
 *
 * This is explicit rather than inferred, and that matters: when `showTime` is
 * false the server truncates to midnight UTC, and a client inferring precision
 * from the value alone cannot tell a suppressed time from an incident that
 * genuinely happened at 00:00. Guessing there would either leak a real midnight
 * capture or mislabel a hidden one.
 */
export type TimePrecision = 'exact' | 'date_only' | 'hidden';

// ─── media ─────────────────────────────────────────────────────────────────

export interface IncidentMedia {
  kind: MediaKind;
  url: string;
  /** Still frame for video; the client shows it while the player warms up. */
  posterUrl: string;
  width: number;
  height: number;
  durationMs?: number;
  byteSize?: number;
}

// ─── location ──────────────────────────────────────────────────────────────

/**
 * Public location. Every field is nullable because `showLocation: false`
 * suppresses them server-side — the client must never assume they are present.
 */
export interface PublicLocation {
  latitude: number | null;
  longitude: number | null;
  /** Human-readable place, e.g. "Kaneshie, Accra". */
  label: string | null;
  confidence: LocationConfidence;
}

/** Full precision. Author-only — never returned on a public endpoint. */
export interface PreciseLocation extends PublicLocation {
  accuracyM: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  isMocked: boolean;
}

// ─── news sections ─────────────────────────────────────────────────────────

/**
 * The news desk a report ran on.
 *
 * The mobile home screen is a newsroom feed, so a reader navigates by desk —
 * Ghana, Africa, World — the way they would pick up a section of a paper.
 *
 * **This is not a coarser `IncidentCategory`, and the two must not be merged.**
 * They are set by different people at different times and drive different
 * things: the reporter picks a category at capture and it decides routing,
 * commission and the editorial queue; an editor picks a desk at publication
 * and it decides nothing but where the story appears. A burst main in Kaneshie
 * is a `flood` on the `ghana` desk.
 *
 * Collapsing them costs one of the two: either the newsroom inherits a
 * 23-value taxonomy it has no use for, or routing loses the precision it
 * depends on — an institution subscribed to `flood` must not start receiving
 * everything filed under a "Ghana" heading.
 */
export type NewsSection = 'ghana' | 'africa' | 'world' | 'business' | 'politics' | 'sport';

/** Order as a newsroom runs them: nearest first. Both clients render this order. */
export const NEWS_SECTIONS: NewsSection[] = [
  'ghana',
  'africa',
  'world',
  'business',
  'politics',
  'sport',
];

/** Desk labels for the editorial picker. */
export const NEWS_SECTION_LABEL: Record<NewsSection, string> = {
  ghana: 'Ghana News',
  africa: 'Africa News',
  world: 'World News',
  business: 'Business News',
  politics: 'Politics',
  sport: 'Sport',
};

/**
 * Where a feed item came from.
 *
 * `citizen_report` is the product: a person filmed it, the GPS gate passed, the
 * trust model applies, and the reporter earns if an institution licenses it.
 *
 * `newsroom` is the agency's own copy — wire and desk-written stories. The feed
 * has six desks and only Ghana can be filled by citizens standing in front of
 * something; the rest are the newsroom's.
 *
 * The distinction is load-bearing, not cosmetic. Before it existed the wire
 * stories were dressed as incident reports: a summit in Abuja carried GPS
 * coordinates, a named citizen reporter who had supposedly filmed it, and a
 * capture timestamp. Both halves of the product's promise quietly broke — a
 * reader could no longer trust that "captured here, then" meant it, and the
 * commission model had a report with a reporter nobody could pay.
 *
 * A `newsroom` item is outside the trust model rather than exempted from it:
 * there is no capture to classify, no location to verify, and nobody to pay.
 */
export type ItemOrigin = 'citizen_report' | 'newsroom';

// ─── publisher ─────────────────────────────────────────────────────────────

export type Publisher =
  | { kind: 'anonymous' }
  | { kind: 'user'; id: string; displayName: string; avatarUrl: string | null }
  /**
   * An institution that licensed the report and then released it under its own
   * name. The reporter is still the author and still earns commission; the
   * organisation is only the publisher. Those are different roles.
   *
   * `verified` is the institution's onboarding status, not the report's
   * verification state. Two unrelated things with unfortunately similar names —
   * a fully onboarded organisation can publish an unverified report, so never
   * render one from the other.
   */
  | {
      kind: 'organisation';
      id: string;
      displayName: string;
      verified: boolean;
      logoUrl: string | null;
    };

// ─── display flags ─────────────────────────────────────────────────────────

/**
 * Set by the reporter at review time, editable later by the account owner.
 *
 * These are DISPLAY flags, not storage flags — the server keeps the true values
 * for vetting and lawful process, but must null them out on public responses.
 * The client enforces the same rules independently. Both layers are required:
 * client-only hiding leaks coordinates into every phone's cache, server-only
 * hiding breaks the moment one client has a bug.
 */
export interface DisplayFlags {
  showLocation: boolean;
  showDate: boolean;
  showTime: boolean;
}

// ─── incident ──────────────────────────────────────────────────────────────

export interface IncidentCounts {
  reactions: number;
  comments: number;
}

/** What the feed, map and public detail endpoints return. */
export interface Incident {
  id: string;
  /**
   * The short reference stamped on the footage and quoted afterwards.
   *
   * Distinct from `id`: `id` is for machines, `reportId` is what a reporter
   * reads down a phone line and what appears burned into the frame.
   */
  reportId: string;
  /** Filmed by a citizen, or written by the newsroom. See `ItemOrigin`. */
  origin: ItemOrigin;
  category: IncidentCategory;
  /**
   * The desk this ran on. Set by an editor at publication — see `NewsSection`
   * for why it is separate from `category`.
   *
   * Non-null on anything published. A report with no desk does not appear in
   * the mobile feed at all, which is a silent disappearance rather than an
   * error, so the editorial workbench requires a choice before publishing.
   */
  section: NewsSection;
  description: string;
  vettingState: VettingState;
  publishedAt: string;
  media: IncidentMedia;
  location: PublicLocation;
  /** Null when `showDate` is false; truncated to midnight when `showTime` is. */
  capturedAtIso: string | null;
  /** What the client is allowed to render from `capturedAtIso`. See TimePrecision. */
  capturedAtPrecision: TimePrecision;
  publisher: Publisher;
  /**
   * How the media got here, technically. A fact, not a judgement.
   */
  assurance: AssuranceClass;
  /**
   * How far editorial has got. A judgement, not a fact.
   *
   * Kept separate from `assurance` on purpose: a file can have flawless
   * integrity and still show a staged event, and the day those two collapse
   * into one field is the day something unverified gets published as verified.
   */
  verification: VerificationState;
  /** The reporter's own account of how urgent it is. */
  severity: Severity;
  /** A nearby name people use, when coordinates are not enough. */
  landmark: string | null;
  /** What must happen before this can be shown, from the consent flags. */
  handling: HandlingRequirement[];
  counts: IncidentCounts;
  viewerHasReacted: boolean;
  /** Metres from the viewer. Present only when the query passed `near`. */
  distanceM?: number;
}

/** The author's own view — adds everything the public must not see. */
export interface AuthoredIncident extends Omit<Incident, 'location'> {
  location: PreciseLocation;
  displayFlags: DisplayFlags;
  isAnonymous: boolean;
  rejectionReason: string | null;
  /** Mirrors the client's local row id so the outbox can reconcile. */
  clientId: string;
}

// ─── pagination ────────────────────────────────────────────────────────────

/** Cursor-based. Offsets would duplicate and skip as reports clear review. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeedQuery {
  limit?: number;
  cursor?: string;
  category?: IncidentCategory[];
  near?: { latitude: number; longitude: number };
  radiusM?: number;
  since?: string;
  until?: string;
  sort?: 'recent' | 'nearby';
}

// ─── errors ────────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'INCIDENT_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UPLOAD_EXPIRED'
  | 'MEDIA_TOO_LARGE'
  | 'GPS_ACCURACY_REJECTED'
  | 'MEDIA_HASH_MISMATCH'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'MAINTENANCE'
  | 'NETWORK_UNAVAILABLE';

/**
 * Typed error thrown by every ApiClient implementation.
 *
 * `retryable` is what the outbox switches on — returning a non-retryable code
 * for a transient failure strands a report, and a retryable code for a
 * permanent one makes the device retry hourly forever.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(init: {
    code: ApiErrorCode;
    status: number;
    message: string;
    retryable?: boolean;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.requestId = init.requestId;
    this.retryable = init.retryable ?? RETRYABLE_CODES.has(init.code);
  }
}

const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([
  'RATE_LIMITED',
  'INTERNAL',
  'MAINTENANCE',
  'NETWORK_UNAVAILABLE',
]);
