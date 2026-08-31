import Link from 'next/link';
import { AlertCircle, Clock, MapPin } from 'lucide-react';
import {
  ASSURANCE_META,
  SAMPLE_INCIDENTS,
  VERIFICATION_META,
  formatExactCapture,
} from '@dawuro/core';
import { Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { AssuranceBadge, VerificationBadge } from '@/components/TrustBadges';

/**
 * What the platform established about one report, for anyone.
 *
 * The media is shown watermarked, because this is a check rather than a
 * distribution channel — nobody should be able to source clean footage by
 * pasting codes into it.
 */
export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const incident = SAMPLE_INCIDENTS.find(
    (i) => i.reportId.toUpperCase() === reportId.toUpperCase(),
  );

  if (!incident) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <Panel className="p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-warning-wash">
            <AlertCircle className="h-5 w-5 text-warning" strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-lg font-semibold">No report with that code</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            Check the code stamped on the footage. If it is right and this page still says no, the
            clip did not come from Dawuro.
          </p>
          <Link
            href="/verify"
            className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
          >
            Try another code
          </Link>
        </Panel>
      </main>
    );
  }

  const assurance = ASSURANCE_META[incident.assurance];
  const verification = VERIFICATION_META[incident.verification];
  const captured = formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-12">
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
        Dawuro Platform
      </p>
      <h1 className="mt-2 font-mono text-2xl font-semibold tracking-widest">{incident.reportId}</h1>

      <MediaFrame
        className="mt-5"
        posterUrl={incident.media.posterUrl}
        alt={incident.description}
        when={captured}
        where={incident.location.label}
        isVideo={incident.media.kind === 'video'}
        watermark
      />

      <Panel className="mt-4 p-5">
        <p className="text-[15px] leading-relaxed">{incident.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <AssuranceBadge assurance={incident.assurance} />
          <VerificationBadge state={incident.verification} />
        </div>

        <dl className="mt-4 space-y-3 border-t border-hairline/[0.07] pt-4">
          <div>
            <dt className="text-2xs uppercase tracking-wider text-text-faint">
              How it was captured
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              {assurance.description}
            </dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-text-faint">
              How far it has been checked
            </dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              {verification.meaning}
            </dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-text-faint">
              What may be said about it
            </dt>
            {/* The permitted phrase verbatim. This page is where an over-claim
                would do the most damage. */}
            <dd className="mt-0.5 text-xs font-medium leading-relaxed">
              {verification.permittedRepresentation}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline/[0.07] pt-4 text-xs text-text-muted">
          {incident.location.label ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {incident.location.label}
            </span>
          ) : null}
          {captured ? (
            <span className="tabular flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {captured}
            </span>
          ) : null}
        </div>
      </Panel>

      <p className="mt-6 text-center text-xs text-text-faint">
        <Link href="/verify" className="font-medium text-accent hover:underline">
          Check another code
        </Link>
      </p>
    </main>
  );
}
