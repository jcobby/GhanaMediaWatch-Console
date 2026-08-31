import { BUSINESSES, EMPLOYEES } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationsWorkspace } from './OrganisationsWorkspace';

export default async function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description="Everyone licensing footage, what they pay, and who can act on it."
      />
      <OrganisationsWorkspace businesses={BUSINESSES} employees={EMPLOYEES} />
    </>
  );
}
