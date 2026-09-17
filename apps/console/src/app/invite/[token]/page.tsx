import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Panel, load } from '@/components/ui';
import { publicApi } from '@/lib/consoleApi';
import { InviteAcceptForm } from './InviteAcceptForm';

/**
 * Someone following an invitation link.
 *
 * A dead link gets a plain explanation and a route onward, never a blank page
 * or a login redirect. Whoever arrives here was sent by a colleague and has no
 * idea what Dawuro is; telling them "unauthorised" would be useless.
 *
 * **This page used to say invitations could not be checked at all.** That was
 * true when the only invite endpoint was `GET /org/invites` — authenticated and
 * scoped to the organisation that issued it, so a person without an account had
 * nothing they could ask. `GET /invites/{token}` is public now, so the link is
 * resolved and the invitation is shown for what it is.
 *
 * Before that it resolved tokens against a seeded list, which meant every real
 * invitation produced "this link is not valid" while a handful of fixture
 * tokens produced a convincing acceptance screen for organisations that do not
 * exist. Both answers were wrong and the wrong one was the confident one.
 */

/** What the lookup carries, read defensively: it publishes no response schema. */
interface InviteLookup {
  token?: string;
  organisationName?: string;
  orgName?: string;
  organisation?: { name?: string };
  kind?: string;
  expiresAtIso?: string;
  revokedAtIso?: string | null;
  maxUses?: number | null;
  usedCount?: number;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const result = await load(() => publicApi.invite<InviteLookup>(token));

  /*
   * A link the service will not resolve is dead to this page, whatever the
   * reason. The distinction between "never existed" and "expired" is the
   * service's to make and it does not tell us, so the copy avoids claiming
   * either — it says what to do instead.
   */
  if (!result.ok) {
    return (
      <Dead
        title="This invitation cannot be used"
        body="The link may have expired, been used already, or been withdrawn. Ask whoever invited you to send a new one."
      />
    );
  }

  const invite = result.data;
  const organisationName =
    text(invite.organisationName) ??
    text(invite.orgName) ??
    text(invite.organisation?.name) ??
    'the organisation that invited you';

  /*
   * Spent or withdrawn, as far as the fields we can read say. The service
   * refuses it either way on acceptance — this only saves somebody filling in a
   * form that cannot succeed.
   */
  const spent =
    Boolean(invite.revokedAtIso) ||
    (typeof invite.maxUses === 'number' &&
      typeof invite.usedCount === 'number' &&
      invite.usedCount >= invite.maxUses);

  if (spent) {
    return (
      <Dead
        title="This invitation has already been used"
        body={`Ask ${organisationName} for a new link. Each one can only be used the number of times they set.`}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-5 text-center">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">Dawuro</p>
        <h1 className="mt-1.5 text-xl font-semibold">Join {organisationName}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          You were invited by someone inside {organisationName}. Set up your sign-in and you will
          be added to their team.
        </p>
      </div>
      <InviteAcceptForm token={token} organisationName={organisationName} />
    </main>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Panel className="p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-warning-wash">
          <AlertCircle className="h-5 w-5 text-warning" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{body}</p>
        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </Panel>
    </main>
  );
}
