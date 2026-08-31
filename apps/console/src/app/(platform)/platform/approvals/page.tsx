import { BUSINESS_APPLICATIONS } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { ApprovalsWorkspace } from './ApprovalsWorkspace';

/**
 * The gate on who may license footage filed by the public.
 *
 * Only pending applications are listed. A decided one is a record, not a task,
 * and mixing the two turns a work queue into an archive nobody trusts.
 */
export default async function Page() {
  const pending = BUSINESS_APPLICATIONS.filter((a) => a.status === 'pending');

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Approvals"
        description={
          pending.length === 0
            ? 'No organisations waiting.'
            : `${pending.length} organisations requesting access to footage.`
        }
      />
      <ApprovalsWorkspace applications={pending} />
    </>
  );
}
