import Link from 'next/link';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { Panel, load } from '@/components/ui';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { normaliseOnboarding } from '@/lib/onboarding';
import { OnboardingWizard } from './OnboardingWizard';
import { SignInAgain } from './SignInAgain';

/**
 * Where a newly registered organisation lands.
 *
 * Registration creates a pending organisation on the service; this collects the
 * evidence, and submitting it sends the application to the Dawuro owner. The
 * application is read from `GET /org/onboarding` — the same record the platform
 * owner reviews — so there is one copy of it, and it is not on this machine.
 *
 * Three people reach this screen:
 *
 *   - An applicant with forms to fill in, or waiting on a decision.
 *   - An applicant whose organisation has just been approved, whose session
 *     predates the approval.
 *   - Somebody signed in with no organisation at all, who needs to register one.
 */
export default async function Page() {
  const session = await requireSession();

  const result = await load(() => org.onboarding<unknown>());

  if (!result.ok) {
    /*
     * No organisation to ask about. A 403 here is the expected answer for an
     * account that never registered one, and rendering it as an outage would
     * tell them the service is down while it works exactly as built.
     */
    const refused =
      result.error instanceof ApiUnavailable &&
      (result.error.status === 403 || result.error.status === 404);

    if (refused && !session.businessId) {
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
                  organisation has been registered against it.
                </p>
                <Link
                  href="/register/company"
                  className="mt-5 inline-block text-sm font-medium text-accent underline underline-offset-2"
                >
                  Register an organisation
                </Link>
              </Panel>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <PageHeader eyebrow="Onboarding" title="Your application" />
        <OrganisationOutage error={result.error} retryHref="/onboarding" />
      </>
    );
  }

  const { application, payloads } = normaliseOnboarding(result.data, session.businessName ?? '');

  if (application.approvedAtIso) {
    return (
      <>
        <PageHeader eyebrow="Onboarding" title="Your application" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-7 py-10">
            <Panel className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-success-wash">
                <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
              </div>
              <h2 className="mt-5 text-xl font-semibold">
                {application.organisationName || 'Your organisation'} is live
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                Your application was approved. Reports that match what you asked for will now
                arrive in your inbox, and you can license them or release them to the public feed.
                Sign in again to open your console.
              </p>
              <SignInAgain />
            </Panel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Complete your application"
        description={
          application.reference
            ? `Reference ${application.reference}. Fill in each step and attach the documents. Send it when you are ready.`
            : 'Fill in each step and attach the documents. Send it when you are ready.'
        }
      />
      <OnboardingWizard
        initial={application}
        initialPayloads={payloads}
        organisationName={application.organisationName}
      />
    </>
  );
}
