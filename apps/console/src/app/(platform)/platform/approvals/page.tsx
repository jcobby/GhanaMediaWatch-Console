import type { OrganisationApplication, OnboardingApplication } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';
import { applicationsAwaitingDecision, decidedApplications } from '@/lib/applications';
import { ApprovalsWorkspace } from './ApprovalsWorkspace';
import { HeldApplications } from './HeldApplications';
import { DecidedApplications } from './DecidedApplications';

/**
 * The gate on who may license footage filed by the public.
 *
 * Only pending applications are listed. A decided one is a record, not a task,
 * and mixing the two turns a work queue into an archive nobody trusts.
 */
export default async function Page() {
  const result = await load(async () => {
    const all = await platform.applications<OrganisationApplication & OnboardingApplication>();
    return {
      // Awaiting a yes or no.
      pending: all.filter((a) => a.status === 'pending'),
      // Already partway through onboarding, reviewed step by step.
      inOnboarding: all.filter((a) => a.reference && !a.approvedAtIso),
    };
  });

  /*
   * Read separately from the backend queue, and on purpose.
   *
   * These are people who registered through this console and whom the API
   * cannot yet be told about. Folding them into `load()` would mean a backend
   * outage hid them, and they are the half that is always readable — they live
   * on this machine. An operator seeing an outage for one queue and the other
   * queue intact is accurate; losing both to one failure is not.
   */
  const held = await applicationsAwaitingDecision();
  /*
   * What was already answered, so a decision does not vanish on being made.
   *
   * Approving removed an organisation from the queue and put it nowhere: no
   * confirmation the decision registered, no record of the choice, and no sign
   * that approving does not by itself create the organisation. Since that step
   * is manual, the approved list is the outstanding work.
   */
  const decided = await decidedApplications();

  const pending = result.ok ? result.data.pending : [];

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Approvals"
        description={
          // A count is a claim about the queue. While the backend is unreachable
          // there is no queue to count, and "No organisations waiting" would be
          // a statement the console cannot support.
          !result.ok
            ? held.length > 0
              ? `The main queue could not be read. ${held.length} registered here are shown below.`
              : 'The queue could not be read.'
            : pending.length + held.length === 0
              ? decided.length > 0
                ? 'Nothing waiting. Already-decided applications are below.'
                : 'No organisations waiting.'
              : `${pending.length + held.length} organisations requesting access to footage.`
        }
      />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        {held.length > 0 ? (
          <div className="px-7 pt-6">
            <HeldApplications applications={held} />
          </div>
        ) : null}
        {decided.length > 0 ? (
          <div className={held.length > 0 ? 'px-7' : 'px-7 pt-6'}>
            <DecidedApplications applications={decided} />
          </div>
        ) : null}
        {result.ok ? (
          <ApprovalsWorkspace applications={pending} inOnboarding={result.data.inOnboarding} />
        ) : (
          <Outage error={result.error} retryHref="/platform/approvals" />
        )}
      </div>
    </>
  );
}
