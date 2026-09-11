import { describeApiFailure } from '@/lib/apiError';
import { Panel } from './Panel';

/**
 * What a page shows when the backend did not answer it.
 *
 * The console has no fixture fallback by design, so this is what replaces the
 * data rather than a stale copy of it. That makes the wording load-bearing: an
 * operator seeing an empty inbox needs to know whether the queue is genuinely
 * empty or whether the service is down, because only one of those means there
 * is nothing to do.
 *
 * The server's own message is never rendered. It leaks internals, and for a
 * 500 it says nothing an operator can act on.
 */
export function Outage({ error, retryHref }: { error: unknown; retryHref?: string }) {
  const { title, body } = describeApiFailure(error);

  return (
    <Panel className="mx-auto my-10 max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{body}</p>
      {retryHref ? (
        <a
          href={retryHref}
          className="mt-6 inline-flex h-9 items-center rounded-pill bg-accent px-4 text-sm font-medium text-white"
        >
          Try again
        </a>
      ) : null}
    </Panel>
  );
}

/**
 * A page's data, or the reason there is none.
 *
 * Every rewired page has the same shape — fetch, and if that fails render the
 * outage instead of the workspace — and writing that `try/catch` forty times
 * invites forty subtly different versions of it, some of which will swallow the
 * error and render an empty page that looks like real emptiness.
 */
export async function load<T>(
  fetcher: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fetcher() };
  } catch (error) {
    return { ok: false, error };
  }
}
