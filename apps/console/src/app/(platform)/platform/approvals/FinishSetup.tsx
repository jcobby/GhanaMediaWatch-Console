'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

/**
 * Creating the organisation for an approval the platform never heard about.
 *
 * Every application approved before `POST /platform/organisations` existed is
 * in this state: the decision was recorded here, the applicant was told yes,
 * and no organisation was ever created — so they sign in to a working account,
 * every `/org/*` read answers 403, and their console shows an outage. It is not
 * an edge case. Until that endpoint landed it was every approved application.
 *
 * Separate from approving, because these were approved weeks ago and nothing
 * about that decision is being revisited. The button finishes a job, it does
 * not make one.
 *
 * Safe to press twice: the server adopts an organisation that already exists
 * under the same name rather than creating a second one, and records the id so
 * the next press does nothing at all.
 */
export function FinishSetup({
  applicationId,
  organisationName,
}: {
  applicationId: string;
  organisationName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/platform/applications/${encodeURIComponent(applicationId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'provision' }),
      });
      const answer = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFailure(answer.error ?? `${organisationName} could not be set up.`);
        return;
      }
      router.refresh();
    } catch {
      setFailure('The console could not reach its own server. Check that it is still running.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5">
      <Button size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? 'Setting up…' : 'Finish setup'}
      </Button>
      {failure ? <p className="mt-1.5 text-2xs leading-relaxed text-danger">{failure}</p> : null}
    </div>
  );
}
