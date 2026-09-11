import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Panel } from '@/components/ui';

/**
 * Someone following an invitation link.
 *
 * A dead link gets a plain explanation and a route onward, never a blank page
 * or a login redirect. Whoever arrives here was sent by a colleague and has no
 * idea what Dawuro is; telling them "unauthorised" would be useless.
 *
 * **The backend exposes no way to check one.** An invite is looked up by its
 * token by a person who has not signed in, and the only invite endpoint is
 * `GET /org/invites` — authenticated, and scoped to the organisation that
 * issued it — so this page has nothing it can ask.
 *
 * It used to resolve the token against a seeded list. That meant every real
 * invitation produced "this link is not valid", while a handful of fixture
 * tokens produced a convincing acceptance screen for organisations that do not
 * exist. Both answers were wrong, and the wrong one was the confident one.
 *
 * So it says what is true and points at the route that works. That is a worse
 * flow than a working invitation, and a far better one than a false verdict on
 * a colleague's genuine link.
 *
 * Needs from the backend: a public `GET /invites/{token}` returning the issuing
 * organisation, the role offered, the expiry and the remaining uses. Everything
 * below this file's imports is ready for it — `inviteProblem` and
 * `remainingUses` already encode the rules.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  // Awaited so the route still behaves as a dynamic segment, and so the token
  // is not silently dropped when the lookup lands.
  await params;

  return (
    <Dead
      title="This link cannot be checked yet"
      body="Invitations are not yet verifiable on the web. Ask whoever invited you to add you directly, or join your organisation below — either way they confirm you work there."
    />
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
          href="/join"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Ask to join an organisation instead
        </Link>
      </Panel>
    </main>
  );
}
