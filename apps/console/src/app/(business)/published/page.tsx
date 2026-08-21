import { PageHeader } from '@/components/shell';
import { Panel } from '@/components/ui';

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Published" title="Released to the public" description="What you licensed, and what you released." />
      <div className="px-8 py-6">
        <Panel className="p-8 text-center">
          <p className="text-sm text-text-muted">Not built yet.</p>
        </Panel>
      </div>
    </>
  );
}
