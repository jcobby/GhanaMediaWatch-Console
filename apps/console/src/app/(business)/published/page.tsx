import { BUSINESSES, SAMPLE_INCIDENTS } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { PublishedWorkspace } from './PublishedWorkspace';

export default async function Page() {
  const session = await requireSession();
  const business = BUSINESSES.find((b) => b.id === session.businessId) ?? BUSINESSES[1]!;
  // Stands in for the licensed set until the API provides it.
  const licensed = SAMPLE_INCIDENTS.slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Published"
        title="Released reports"
        description="What you licensed, and what the public can see."
      />
      <PublishedWorkspace licensed={licensed} business={business} />
    </>
  );
}
