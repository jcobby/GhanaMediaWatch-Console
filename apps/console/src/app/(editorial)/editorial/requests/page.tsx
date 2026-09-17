import type { Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { editorial } from '@/lib/consoleApi';
import { RequestsList } from './RequestsList';

/**
 * Organisations asking to publish.
 *
 * An organisation that licensed a report can ask for it to be published under
 * its name. Nothing reaches the public feed without an editor, so each request
 * waits here: approve it onto a desk — optionally as a top story — or decline it
 * with a reason the organisation will read.
 */
export default async function Page() {
  const result = await load(() => editorial.publicationRequests<Incident>());

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Organisation requests"
        description="Reports organisations have licensed and asked to publish under their name."
      />
      {!result.ok ? (
        <Outage error={result.error} retryHref="/editorial/requests" />
      ) : (
        <RequestsList initial={result.data} />
      )}
    </>
  );
}
