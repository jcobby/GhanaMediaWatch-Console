import type { OnboardingApplication } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { Panel, load } from '@/components/ui';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { applicationFor, type HeldApplication } from '@/lib/applications';
import { OnboardingWizard } from './OnboardingWizard';
import { ApplicationOutcome } from './ApplicationOutcome';

/**
 * Where a newly registered organisation lands.
 *
 * Registration says who is asking; this collects the evidence, and submitting
 * it is what sends the application to the Dawuro owner to approve or reject.
 * Registration and onboarding are one continuous act from the applicant's side.
 *
 * Three people reach this screen:
 *
 *   - A member of an organisation the platform already knows about, whose real
 *     application comes from `/org/onboarding`.
 *   - Somebody who registered here and has forms to fill in. The backend has no
 *     endpoint that creates an organisation, so `/org/onboarding` answers 403
 *     for them — which is the expected reply, not a fault. Their application is
 *     the one this console is holding.
 *   - Somebody whose application has been submitted or decided, who needs to
 *     see where it stands.
 *
 * The middle case used to get a dead end: a panel explaining that setting up an
 * organisation was not something they could do, and nothing to fill in. That
 * was true of the backend and wrong as a product — they had just typed an
 * organisation's details and the next thing they were shown was a wall.
 */
export default async function Page() {
  const session = await requireSession();

  const result = await load(() => org.onboarding<OnboardingApplication>());

  if (result.ok) {
    return (
      <>
        <PageHeader
          eyebrow="Onboarding"
          title="Complete your application"
          description={
            result.data.reference
              ? `Reference ${result.data.reference} — each step is reviewed separately.`
              : 'Each step is reviewed separately.'
          }
        />
        <OnboardingWizard
          initial={result.data}
          organisationName={result.data.organisationName ?? session.businessName ?? ''}
        />
      </>
    );
  }

  /*
   * Refused because there is no organisation on the backend, not because
   * anything broke. A 403 here is the expected answer for somebody who
   * registered through this console, and rendering it as an outage would tell
   * them the service is down while it works exactly as built.
   */
  const refused =
    result.error instanceof ApiUnavailable &&
    (result.error.status === 403 || result.error.status === 404);

  if (!refused) {
    return (
      <>
        <PageHeader eyebrow="Onboarding" title="Your application" />
        <OrganisationOutage error={result.error} retryHref="/onboarding" />
      </>
    );
  }

  const held = await applicationFor(session.email);

  if (!held) {
    /*
     * Signed in, no organisation on the backend, and no application here
     * either. Rare — an account created outside the registration form — and it
     * gets a plain statement rather than a wizard that would save nowhere.
     */
    return (
      <>
        <PageHeader eyebrow="Onboarding" title="Your application" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-7 py-8">
            <Panel className="p-8">
              <h2 className="text-lg font-semibold text-text-primary">
                We have no application for this account.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                You are signed in as{' '}
                <span className="font-medium text-text-secondary">{session.email}</span>, but no
                organisation has been registered against it. Register one to begin.
              </p>
            </Panel>
          </div>
        </div>
      </>
    );
  }

  // Submitted or decided: the forms are closed and what matters is the answer.
  if (held.status !== 'draft') {
    return (
      <>
        <PageHeader
          eyebrow="Onboarding"
          title="Your application"
          description={`${held.organisationName} — reference ${held.id.slice(0, 12)}`}
        />
        <ApplicationOutcome application={held} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Complete your application"
        description="Fill in each step and attach the documents. Send it when you are ready."
      />
      <OnboardingWizard
        initial={asOnboardingApplication(held)}
        organisationName={held.organisationName}
        /*
         * The applicant's own store. With it the wizard saves as they type and
         * submits for real; without it the wizard is what it used to be — four
         * steps of React state discarded on navigation.
         */
        held={held}
      />
    </>
  );
}

/**
 * The held application in the shape the wizard already reads.
 *
 * A translation, not an invention: every field comes from what the applicant
 * entered or from where the application has actually got to. The wizard was
 * written against `OnboardingApplication` and there is no reason to rewrite it
 * around a second type that says the same things.
 */
function asOnboardingApplication(held: HeldApplication): OnboardingApplication {
  return {
    reference: held.id.slice(0, 12),
    businessId: held.id,
    organisationName: held.organisationName,
    steps: held.onboarding?.steps ?? [],
    documents:
      held.onboarding?.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        uploadedAtIso: document.uploadedAtIso,
        reviewedOk: null,
      })) ?? [],
    // Screening is a backend capability that does not exist. Null is "not run",
    // which is the truth; false would say it ran and found something.
    screeningRunAtIso: null,
    screeningClear: null,
    submittedAtIso: held.submittedAtIso ?? null,
    approvedAtIso: held.status === 'approved' ? (held.decidedAtIso ?? null) : null,
  };
}
