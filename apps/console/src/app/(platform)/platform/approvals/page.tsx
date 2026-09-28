import type { OrganisationApplication } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';
import { normaliseOnboarding } from '@/lib/onboarding';
import { ApprovalsWorkspace } from './ApprovalsWorkspace';

/**
 * The gate on who may license footage filed by the public.
 *
 * One queue, from the service. This page used to merge it with applications the
 * console kept in a file on its own disk, because registration could not create
 * an organisation; it can now, so every application is here and nowhere else.
 */
export default async function Page() {
  const result = await load(async () => {
    const all = await platform.applications<Record<string, unknown>>();

    /*
     * Normalised, because `/platform/applications` sends steps as a map keyed by
     * step id and the review panel reads a list. Handed over raw, the panel
     * crashed on the first application.
     */
    const inOnboarding = all
      .filter((row) => typeof row.reference === 'string' && !row.approvedAtIso)
      /*
       * The answers travel with the application, not just its status.
       *
       * This took `.application` and dropped `.payloads` on the floor — which is
       * everything the applicant actually typed. The review panel could then
       * only report that a step had been *sent*, so "What they submitted" read
       * "Sent 9m" and nothing else, and a platform owner was asked to approve
       * an organisation's legal name, registration number and authorised officer
       * while being shown none of the three.
       *
       * It is also why no organisation name appeared anywhere: the service sends
       * none at the top level, and the legal name is in the organisation step's
       * payload.
       */
      .map((row) => {
        const { application, payloads } = normaliseOnboarding(row);
        return { ...application, payloads };
      })
      // Submitted first: those are waiting on a person. Drafts are still being typed.
      .sort((a, b) => Number(Boolean(b.submittedAtIso)) - Number(Boolean(a.submittedAtIso)));

    return {
      pending: all.filter((row) => row.status === 'pending') as unknown as OrganisationApplication[],
      inOnboarding,
    };
  });

  const waiting = result.ok
    ? result.data.pending.length + result.data.inOnboarding.filter((a) => a.submittedAtIso).length
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Approvals"
        description={
          // A count is a claim about the queue. While the service is unreachable
          // there is no queue to count.
          !result.ok
            ? 'The queue could not be read.'
            : waiting === 0
              ? 'No applications waiting for a decision.'
              : `${waiting} ${waiting === 1 ? 'organisation' : 'organisations'} waiting for a decision.`
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {result.ok ? (
          <ApprovalsWorkspace
            applications={result.data.pending}
            inOnboarding={result.data.inOnboarding}
          />
        ) : (
          <Outage error={result.error} retryHref="/platform/approvals" />
        )}
      </div>
    </>
  );
}
