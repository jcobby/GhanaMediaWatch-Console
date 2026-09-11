import type { EditorialCase, Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { editorialQueueWithReports } from '@/lib/consoleApi';
import { Workbench } from './Workbench';

/**
 * The triage queue, read from the backend.
 *
 * `GET /editorial/queue` is already the *open* work — the server decides what
 * counts as undecided, and it must, because that judgement drives what may be
 * called verified. Filtering a full list client-side, as this page used to,
 * would put a second opinion about verification in the browser.
 */
export default async function Page() {
  const user = await requireSession();
  const result = await load(async () => {
    /*
     * The cases and the reports are two requests, because they are two things.
     *
     * `/editorial/queue` returns cases — `incidentId`, corroboration, contacts,
     * notes, decisions — and never the report itself. Reading `case.incident`
     * therefore found nothing on every row, so this page rendered "The queue is
     * clear." while the sidebar badge beside it read 19. The badge was right.
     */
    const { cases, reports } = await editorialQueueWithReports<
      EditorialCase & { incident?: Incident }
    >();
    return { cases, reports: reports as unknown as Incident[] };
  });

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Triage"
        description="Ordered by what needs attention, not by what arrived first."
      />
      {result.ok ? (
        <Workbench
          reports={result.data.reports}
          cases={result.data.cases}
          editorName={user.displayName}
        />
      ) : (
        <Outage error={result.error} retryHref="/editorial" />
      )}
    </>
  );
}
