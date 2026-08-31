import { SAMPLE_INCIDENTS } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { MapWorkspace } from './MapWorkspace';

export default async function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Analysis"
        title="Map and trends"
        description="Where reports are concentrated, and whether it is getting worse."
      />
      <MapWorkspace reports={SAMPLE_INCIDENTS} />
    </>
  );
}
