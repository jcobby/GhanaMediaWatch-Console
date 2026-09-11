/**
 * Why the console could not get its data.
 *
 * Distinct from the backend's own error codes because two of these never come
 * from the backend at all: it is not configured, or it did not answer. An
 * operator needs those told apart — "nobody has pointed this console at a
 * server" and "the server is down" call for different people.
 */
export type ApiErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNREACHABLE'
  | 'TIMEOUT'
  | 'MAINTENANCE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'INTERNAL';

export class ApiUnavailable extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiUnavailable';
  }
}

/** What to put on screen. Never the server's own message — see BACKEND_SPEC §2.5. */
export function describeApiFailure(error: unknown): { title: string; body: string } {
  const code = error instanceof ApiUnavailable ? error.code : 'INTERNAL';

  switch (code) {
    case 'NOT_CONFIGURED':
      return {
        title: 'No backend configured',
        body: 'DAWURO_API_URL is not set, so this console has nothing to read from. This is a deployment setting, not an outage.',
      };
    case 'UNREACHABLE':
      return {
        title: 'Cannot reach the service',
        body: 'The backend did not answer. Nothing here is stale data — the console does not fall back to samples, so this page stays empty until it is back.',
      };
    case 'TIMEOUT':
      return {
        title: 'The service is slow to respond',
        body: 'The request timed out. Try again in a moment.',
      };
    case 'MAINTENANCE':
      return {
        title: 'Dawuro is being updated',
        body: 'The service is briefly down for maintenance. Nothing has been lost.',
      };
    case 'TOKEN_EXPIRED':
    case 'TOKEN_INVALID':
      return { title: 'Signed out', body: 'Your session ended. Sign in again to carry on.' };
    case 'FORBIDDEN':
      return {
        title: 'Not available on this account',
        body: 'This account does not have access to that.',
      };
    default:
      return {
        title: 'Something went wrong at our end',
        body: 'This is not your connection. Try again shortly.',
      };
  }
}
