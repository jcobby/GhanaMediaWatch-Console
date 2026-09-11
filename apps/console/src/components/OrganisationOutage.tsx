import 'server-only';
import Link from 'next/link';
import { ApiUnavailable } from '@/lib/apiError';
import { readSession } from '@/lib/session';
import { apiRequest } from '@/lib/api';
import type { CallerDescription } from '@/lib/auth';
import { Outage, Panel } from './ui';

/**
 * What an organisation's page shows when the server refused it.
 *
 * Mostly this is `Outage`, unchanged. It exists for two cases it gets wrong,
 * and both of them tell a working customer that their account is at fault.
 *
 * **A session that does not know its organisation.** `/org/*` is scoped by an
 * `X-Dawuro-Org` header naming the organisation a request is for, and the
 * console takes that id from the session, which learns it from `/me` at
 * sign-in. A session minted before the organisation existed carries no id, so
 * no header goes out and the service refuses every organisation page:
 * `FORBIDDEN: X-Dawuro-Org header is required for organisation endpoints`.
 * Signing in again writes the id into the session and the header starts being
 * sent — so "sign in again" is a real instruction here rather than a guess.
 *
 * **This used to be the only story, and it was the wrong one.** The console
 * blamed the token and told operators, at length, that the service was
 * contradicting itself. It was not: the console had simply never sent the
 * header on any request. That is fixed in `consoleApi`, and the branch that
 * described the contradiction now describes what is actually left — a refusal
 * of a request that named the organisation correctly.
 *
 * **No organisation at all.** The older case, and now the rarer one: an
 * application this console approved before that endpoint existed. Nothing was
 * ever created, so no amount of signing in helps. That is a fault at our end
 * and is described as one — an earlier version called it a step still to come,
 * which made a defect sound like a process and meant nobody would fix it.
 *
 * The two are told apart by asking the server. `GET /me` reports the caller's
 * organisation and memberships, so if it names one the session is simply behind;
 * if it names none there is genuinely nothing there yet. Guessing between them
 * would put the wrong instruction in front of half the people who see this.
 *
 * **Why this is a separate file rather than a branch inside `Outage`.** The
 * check needs the session, and `Outage` is exported from `components/ui`, a
 * barrel that client components import. Putting `readSession` behind it pulled
 * `next/headers` into the client bundle and every organisation page answered 500.
 * Server-only concerns stay out of that barrel.
 */
export async function OrganisationOutage({
  error,
  retryHref,
}: {
  error: unknown;
  retryHref?: string;
}) {
  const state = await organisationState(error);

  if (state === 'session_behind') {
    return (
      <Panel className="mx-auto my-10 max-w-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-text-primary">Sign in again to finish</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Your organisation is set up and your account is a member of it. This browser signed in
          before that happened, so it does not yet know which organisation to ask for &mdash; and
          the service will not open these pages without being told.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Signing out and back in is the whole fix. Nothing is lost and there is nothing to redo.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-9 items-center rounded-sm bg-gradient-to-br from-accent to-accent-alt px-4 text-sm font-medium text-text-on-dark hover:brightness-110"
        >
          Sign in again
        </Link>
      </Panel>
    );
  }

  if (state === 'refused_with_scope') {
    return (
      <Panel className="mx-auto my-10 max-w-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-text-primary">
          Your organisation is set up, but this page was refused
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          This browser knows which organisation you operate and asked for it by name. The service
          confirms your account is a member of it and declined anyway, so there is nothing here for
          you to correct and signing in again will not change the answer.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Everything you have sent is safe and nothing needs re-doing. This page fills in on its own
          once the refusal stops.
        </p>
      </Panel>
    );
  }

  if (state === 'no_organisation') {
    return (
      <Panel className="mx-auto my-10 max-w-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-text-primary">
          We cannot load your organisation
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Your application was approved and your account is active. This is a fault at our end, not
          something wrong with your account and not anything you can fix from here &mdash; the
          service is not returning your organisation, so there are no reports, no team and no
          history to show.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Everything you sent is safe and nothing needs re-doing. We are aware of it, and this page
          fills in on its own once it is corrected.
        </p>
      </Panel>
    );
  }

  return <Outage error={error} {...(retryHref ? { retryHref } : {})} />;
}

type OrganisationState = 'session_behind' | 'refused_with_scope' | 'no_organisation' | 'other';

/**
 * Whether this refusal is about the organisation, and which way.
 *
 * Narrow on purpose: a 403 *and* an organisation session. Any other refusal keeps
 * the general wording, which is right for it — an organisation denied a single
 * endpoint by a real permission rule must not be told its whole organisation is
 * missing.
 *
 * Two facts decide it, and between them they cover every case honestly.
 *
 * **Does the caller have an organisation at all?** `/me` answers, and it is
 * asked of the server rather than of the session, because the session is the
 * thing under suspicion. No organisation means there is nothing to be behind.
 *
 * **Did this request name one?** `/org/*` is scoped by the `X-Dawuro-Org`
 * header, which `consoleApi` fills from `session.businessId`. If the session has
 * no id, no header went out and that alone explains the 403 — signing in again
 * writes the id and the next request carries it. If the session *does* have one,
 * the request was correctly scoped and was refused anyway, which is not
 * something the person reading the page can act on, and the page says so rather
 * than sending them round a loop.
 *
 * This replaces a clock. The old version compared the cookie's age against ten
 * minutes to guess whether signing in had already been tried — a proxy for a
 * question it could not otherwise answer, back when the cause was unknown. The
 * header makes the real question checkable, so the guess is gone.
 *
 * `/me` failing is treated as "no organisation": it is the older, safer message,
 * and telling somebody to sign in again when we could not check would send them
 * round a loop that changes nothing.
 */
async function organisationState(error: unknown): Promise<OrganisationState> {
  if (!(error instanceof ApiUnavailable) || error.status !== 403) return 'other';

  const session = await readSession();
  if (session?.accountType !== 'organisation') return 'other';

  if (!session.accessToken) return 'no_organisation';

  try {
    const me = await apiRequest<CallerDescription>('/me', {
      token: session.accessToken,
      timeoutMs: 8_000,
    });
    const hasOrganisation = Boolean(me?.orgId ?? me?.memberships?.some((m) => m.orgId));
    if (!hasOrganisation) return 'no_organisation';

    // A member whose session cannot name the organisation sent no scope header.
    // That is the one case signing in again genuinely repairs.
    return session.businessId ? 'refused_with_scope' : 'session_behind';
  } catch {
    return 'no_organisation';
  }
}
