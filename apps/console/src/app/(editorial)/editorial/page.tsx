import { EDITORIAL_CASES, SAMPLE_INCIDENTS, VERIFICATION_META } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { Workbench } from './Workbench';

export default async function Page() {
  const user = await requireSession();

  // Decided reports move to the record; the desk shows only live work.
  const open = SAMPLE_INCIDENTS.filter(
    (i) => !VERIFICATION_META[i.verification].mayUseWordVerified && i.verification !== 'rejected',
  );

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Triage"
        description="Ordered by what needs attention, not by what arrived first."
      />
      <Workbench reports={open} cases={EDITORIAL_CASES} editorName={user.displayName} />
    </>
  );
}
