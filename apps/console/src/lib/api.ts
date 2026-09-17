import { ApiUnavailable, type ApiErrorCode } from './apiError';

/**
 * The console's server-side client for the Dawuro API.
 *
 * **Server only.** Every caller is a Server Component or a route handler, and
 * the backend token is attached here rather than in the browser: the console's
 * own session cookie is httpOnly precisely so that JavaScript cannot read it,
 * and shipping a second credential to the page would give that away for free.
 *
 * There is no fixture fallback, deliberately. A console that quietly serves
 * seeded data when the backend is down shows an operator a queue that is not
 * real, and they will act on it. An outage has to look like an outage.
 */

const BASE = (process.env.DAWURO_API_URL ?? '').replace(/\/+$/, '');

/** Whether the console is pointed at a backend at all. */
export const isLiveBackend = BASE.length > 0;

/**
 * An absolute upstream URL for a versioned path.
 *
 * For the handful of routes whose answer is *not* JSON and so cannot go through
 * `apiRequest` — an onboarding document downloaded for review is bytes, and
 * buffering it here to hand it on would hold the whole file per request. Those
 * routes fetch this URL themselves and stream the response.
 *
 * The origin stays server-side: `DAWURO_API_URL` is deliberately not a
 * `NEXT_PUBLIC_` variable, and nothing returned here may be rendered into a page.
 */
export function upstreamUrl(path: string): string {
  return `${BASE}/v1${path}`;
}

/*
 * Say which backend this process is talking to, once, at startup.
 *
 * `DAWURO_API_URL` is read when the server boots, so editing `.env.local` under
 * a running dev server changes nothing until it is restarted — and there is no
 * sign of that on any screen. A whole afternoon went into a console that was
 * still calling a dead tunnel while the file on disk named a live host, with
 * both of us reading the file rather than the process.
 *
 * The host only. Never the path, never a token: this line goes to a terminal
 * that gets pasted into chats and screenshots.
 */
if (process.env.NODE_ENV !== 'production') {
  console.log(
    `  API  ${isLiveBackend ? new URL(BASE).host : 'not configured — set DAWURO_API_URL'}`,
  );
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * A body sent as bytes rather than as JSON.
   *
   * One endpoint needs it: the onboarding document upload, which takes the raw
   * file on `PUT /org/onboarding/documents/{documentType}/bytes` and checks it
   * against the `sha256` declared a moment earlier. Everything else this console
   * sends is JSON, so this is deliberately narrow — when it is set, `body` is
   * ignored and the caller supplies its own `Content-Type` through `headers`.
   */
  rawBody?: ArrayBuffer;
  /** The caller's backend token, taken from their server-side session. */
  token?: string;
  /** Requests that hang are worse than requests that fail. */
  timeoutMs?: number;
  /**
   * A stable key for an operation that can be replayed.
   *
   * Supply one where retrying the same action must not perform it twice — a
   * payout release, a licence purchase. Left unset, a fresh key is generated
   * per call, which is correct for a one-shot action and is required either
   * way: the server rejects a state-changing request that carries no key.
   */
  idempotencyKey?: string;
  /**
   * Extra headers, for the few endpoints that take one.
   *
   * `If-Match` on the news-value store is the reason this exists: the
   * version is how two editors on one report are stopped from silently
   * overwriting each other, and it travels in a header rather than a body.
   */
  headers?: Record<string, string>;
}

/**
 * A caller's stable key, in the shape the server will accept.
 *
 * **The server requires a UUID v4** — it answers `Idempotency-Key must be a
 * UUID v4. (400)` to anything else — and every stable key in this console was a
 * readable string: `publish:inc_832d570b658f`, `route:inc_…:biz_a,biz_b`,
 * `license:inc_…`, `payout-batch:…`, `approve:…`. So every action that mattered
 * enough to be made replay-safe was rejected outright, while one-shot actions,
 * which fall through to `randomUUID()`, worked. Releasing a report to the
 * public feed failed and licensing never ran at all.
 *
 * Hashing keeps the property the key exists for. The same operation always
 * produces the same UUID, so a double-clicked button or a retried request is
 * still recognised by the server as the same action — a reporter is paid once,
 * a report is released once. A random UUID per attempt would satisfy the format
 * and silently destroy that guarantee, which is the tempting wrong fix.
 *
 * The version and variant bits are set so the result is a well-formed v4 rather
 * than merely UUID-shaped. Exported for its tests.
 */
export async function stableKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const bytes = new Uint8Array(digest).slice(0, 16);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isLiveBackend) {
    throw new ApiUnavailable('NOT_CONFIGURED', 0, 'DAWURO_API_URL is not set.');
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  const method = options.method ?? 'GET';
  const changesState = method !== 'GET';

  const headers: Record<string, string> = {
    // Bytes carry their own type; the caller sets it through `headers`.
    ...(options.rawBody === undefined ? { 'Content-Type': 'application/json' } : {}),
    Accept: 'application/json',
    /*
     * Dev tunnels answer an unrecognised client with an HTML interstitial
     * rather than the API. Without this header every response parses as
     * "unexpected token <", which surfaces as an unreachable backend and sends
     * whoever is debugging it looking at the network instead of at a header.
     */
    'X-Tunnel-Skip-AntiPhishing-Page': 'true',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };

  /*
   * Required, not optional. The server rejects a state-changing request with
   * no `Idempotency-Key`, so this is the difference between a working action
   * and a 400 that reads like a validation bug.
   */
  if (changesState) {
    headers['Idempotency-Key'] = options.idempotencyKey
      ? await stableKey(options.idempotencyKey)
      : crypto.randomUUID();
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}/v1${path}`, {
      method,
      headers,
      ...(options.rawBody !== undefined
        ? { body: options.rawBody }
        : options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      signal: controller.signal,
      // Console data is operational: a cached inbox is a wrong inbox.
      cache: 'no-store',
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiUnavailable(
      aborted ? 'TIMEOUT' : 'UNREACHABLE',
      0,
      aborted ? 'The backend did not respond in time.' : 'The backend could not be reached.',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* A non-JSON body from a gateway or a tunnel interstitial. */
  }

  logExchange(method, path, response.status, Date.now() - startedAt, parsed);

  if (!response.ok) {
    const envelope =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as { error: { code?: string; message?: string } }).error
        : null;
    throw new ApiUnavailable(
      (envelope?.code as ApiErrorCode) ?? 'UNREACHABLE',
      response.status,
      envelope?.message ?? `Request failed with status ${response.status}.`,
    );
  }

  return parsed as T;
}

/**
 * Whether the console prints what it sends and receives.
 *
 * On in development, because three of the endpoints this console depends on —
 * `/platform/routing`, `/editorial/queue` and `/org/inbox` — publish no response
 * schema at all. Their field names had to be inferred, and the failure mode of
 * a wrong guess is a silently empty queue rather than an error. The only way to
 * settle what a queue actually returns is to look at it.
 *
 * Set `DAWURO_LOG_API=0` to quieten it. Never on in production: these bodies
 * carry reporter identities and unmasked locations.
 */
const LOG_API = process.env.NODE_ENV !== 'production' && process.env.DAWURO_LOG_API !== '0';

/** Values that must never be printed, however deeply they are nested. */
const REDACTED = new Set([
  'accessToken',
  'refreshToken',
  'deviceToken',
  'password',
  'authorization',
]);

function logExchange(
  method: string,
  path: string,
  status: number,
  ms: number,
  body: unknown,
): void {
  if (!LOG_API) return;

  const marker = status >= 400 ? 'ERR' : 'ok ';
  const shape = describeShape(body);
  console.log(`  API ${marker} ${status} ${method} ${path} ${ms}ms  ${shape}`);

  const seen = new WeakSet<object>();
  const json = JSON.stringify(
    body,
    (key, value: unknown) => {
      if (REDACTED.has(key)) return '<redacted>';
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '<circular>';
        seen.add(value);
      }
      return value;
    },
    2,
  );
  if (!json) return;
  // Long enough to read a queue page, short enough not to bury the next request.
  const trimmed = json.length > 2000 ? `${json.slice(0, 2000)}\n… truncated` : json;
  console.log(trimmed.replace(/^/gm, '      '));
}

/**
 * A one-line summary of what came back.
 *
 * The question being asked of this log is almost always "did the queue have
 * anything in it, and what is the wrapper called" — so the keys and the array
 * lengths are the answer, and they belong on the status line where they can be
 * read without scrolling through the body.
 */
function describeShape(body: unknown): string {
  if (Array.isArray(body)) return `array(${body.length})`;
  if (body === null || typeof body !== 'object') return typeof body;
  const entries = Object.entries(body as Record<string, unknown>).map(([k, v]) =>
    Array.isArray(v) ? `${k}[${v.length}]` : k,
  );
  return `{ ${entries.join(', ')} }`;
}
