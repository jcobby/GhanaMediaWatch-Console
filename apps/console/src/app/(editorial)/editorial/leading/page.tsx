import type { Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { editorial } from '@/lib/consoleApi';
import { LeadingList } from './LeadingList';

/**
 * What leads the feed right now.
 *
 * The running order of the front page, in one place. A lead set on a report and
 * never looked at again is how a front page stays frozen on yesterday's story;
 * this is where an editor sees every lead across every desk and takes one off.
 *
 * `GET /editorial/leading` answers with current leads only — expired ones drop
 * out on their own — most recently led first.
 */
export default async function Page() {
  const result = await load(() => editorial.leading<Incident>());

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Leading"
        description="What the phone shows as top stories: these first, then the newest reports on each desk."
      />
      {!result.ok ? (
        <Outage error={result.error} retryHref="/editorial/leading" />
      ) : (
        <LeadingList initial={result.data} />
      )}
    </>
  );
}
