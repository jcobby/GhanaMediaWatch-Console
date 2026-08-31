import { BUSINESSES, onboardingReference, type OnboardingApplication } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { OnboardingWizard } from './OnboardingWizard';

/**
 * Where a newly registered organisation lands.
 *
 * Registration says who is asking; this collects the evidence. A fresh
 * application starts empty — the fixtures deliberately do not pre-fill it,
 * because the whole point of the screen is what an applicant sees on day one.
 */
export default async function Page() {
  const session = await requireSession();
  const business = BUSINESSES.find((b) => b.id === session.businessId) ?? BUSINESSES[1]!;

  const application: OnboardingApplication = {
    reference: onboardingReference(1),
    businessId: business.id,
    organisationName: business.name,
    steps: [],
    documents: [],
    screeningRunAtIso: null,
    screeningClear: null,
    submittedAtIso: null,
    approvedAtIso: null,
  };

  return (
    <>
      <PageHeader
        eyebrow="Onboarding"
        title="Complete your application"
        description={`Reference ${application.reference} — each step is reviewed separately.`}
      />
      <OnboardingWizard initial={application} organisationName={business.name} />
    </>
  );
}
