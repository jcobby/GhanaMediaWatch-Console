import { formatRelativeTime, verificationMeta, type Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel, Outage, load } from '@/components/ui';
import { AssuranceBadge, VerificationBadge } from '@/components/TrustBadges';
import { editorial } from '@/lib/consoleApi';

/**
 * Reports the desk has finished with.
 *
 * Kept visible rather than archived. A verification that cannot be found again
 * cannot be revisited when new evidence turns up, and "disputed" exists
 * precisely because that happens.
 */
export default async function Page() {
  /*
   * The server's own record of what it has decided.
   *
   * `GET /editorial/decided` rather than a filter over every report: whether a
   * case is closed is the desk's ruling, not something a client re-derives, and
   * a client that re-derives it will eventually disagree.
   */
  const result = await load(() => editorial.decided<DecidedRow>());

  /*
   * The rows, whatever shape they arrive in.
   *
   * `/editorial/decided` publishes no response schema — the same gap that made
   * `/editorial/queue` read as empty for a day — so this accepts all three
   * readings rather than betting on one: a row that wraps the report, a row
   * that wraps it under `report`, or a row that *is* the report, which is what
   * the queue turned out to be.
   *
   * **This page crashed on exactly that bet.** It took `d.incident ?? d`, and
   * for a row with neither the fallback was the row itself: no `verification`,
   * `VERIFICATION_META[undefined]`, and *Cannot read properties of undefined*
   * took down the whole route. A desk showing nothing because one row was
   * shaped differently is a far worse failure than a row that reads oddly.
   *
   * Rows with no id at all are dropped rather than rendered as blanks: there is
   * nothing to show and nothing to open.
   */
  const decided = result.ok
    ? result.data
        .map((row) => row.incident ?? row.report ?? (row as unknown as Incident))
        .filter((incident): incident is Incident => Boolean(incident?.id))
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Decided"
        description="Closed cases, kept so they can be reopened when evidence changes."
      />
      {!result.ok ? (
        <Outage error={result.error} retryHref="/editorial/decided" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-1.5 px-7 py-6">
            {decided.length === 0 ? (
              <Panel className="p-10 text-center text-sm text-text-muted">
                Nothing decided yet.
              </Panel>
            ) : (
              decided.map((incident) => (
                <Panel key={incident.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xs bg-canvas-raise px-1.5 py-0.5 font-mono text-2xs">
                      {incident.reportId}
                    </span>
                    <AssuranceBadge assurance={incident.assurance} showLabel={false} />
                    <VerificationBadge state={incident.verification} />
                    <span className="ml-auto text-2xs text-text-faint">
                      {formatRelativeTime(incident.capturedAtIso) ?? ''}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{incident.description}</p>
                  <p className="mt-1.5 text-2xs italic text-text-faint">
                    {verificationMeta(incident.verification).permittedRepresentation}
                  </p>
                </Panel>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A decided case, in any of the shapes the endpoint might use.
 *
 * Every field optional because none of them is documented. Written down as a
 * type rather than cast away at the call site so the guess is visible, and so
 * the day a schema is published there is one place to correct.
 */
interface DecidedRow {
  incidentId?: string;
  incident?: Incident;
  report?: Incident;
}
