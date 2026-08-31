import { SAMPLE_INCIDENTS, VERIFICATION_META, formatRelativeTime } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel } from '@/components/ui';
import { AssuranceBadge, VerificationBadge } from '@/components/TrustBadges';

/**
 * Reports the desk has finished with.
 *
 * Kept visible rather than archived. A verification that cannot be found again
 * cannot be revisited when new evidence turns up, and "disputed" exists
 * precisely because that happens.
 */
export default async function Page() {
  const decided = SAMPLE_INCIDENTS.filter(
    (i) => VERIFICATION_META[i.verification].mayUseWordVerified || i.verification === 'rejected',
  );

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Decided"
        description="Closed cases, kept so they can be reopened when evidence changes."
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-1.5 px-7 py-6">
          {decided.length === 0 ? (
            <Panel className="p-10 text-center text-sm text-text-muted">Nothing decided yet.</Panel>
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
                  {VERIFICATION_META[incident.verification].permittedRepresentation}
                </p>
              </Panel>
            ))
          )}
        </div>
      </div>
    </>
  );
}
