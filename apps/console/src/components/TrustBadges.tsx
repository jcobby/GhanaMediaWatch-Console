import { AlertTriangle, EyeOff, ShieldCheck, ShieldAlert, Siren } from 'lucide-react';
import {
  ASSURANCE_META,
  SEVERITY_META,
  VERIFICATION_META,
  type AssuranceClass,
  type HandlingRequirement,
  type Severity,
  type VerificationState,
} from '@dawuro/core';
import { cn } from '@/lib/cn';

/**
 * How a report's trust status is shown.
 *
 * Two badges, always both, never merged. Assurance is a technical fact about
 * the file; verification is an editorial judgement about the claim. A single
 * combined "trust score" would be the most dangerous component in the product,
 * because it would let a perfect hash read as a checked story.
 *
 * The label text is taken from the model rather than written here. Each state
 * has exactly one permitted phrase, and a component free to invent its own
 * wording is how "capture integrity verified" becomes "verified".
 */
export function AssuranceBadge({
  assurance,
  showLabel = true,
}: {
  assurance: AssuranceClass;
  showLabel?: boolean;
}) {
  const meta = ASSURANCE_META[assurance];
  const trusted = assurance === 'A' || assurance === 'D';

  return (
    <span
      title={meta.description}
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-2xs font-medium"
      style={{ backgroundColor: `${meta.hue}1A`, color: meta.hue }}
    >
      {trusted ? (
        <ShieldCheck className="h-3 w-3" strokeWidth={2.4} />
      ) : (
        <ShieldAlert className="h-3 w-3" strokeWidth={2.4} />
      )}
      <span className="font-semibold">{assurance}</span>
      {showLabel ? <span className="font-normal">{meta.permittedLabel}</span> : null}
    </span>
  );
}

export function VerificationBadge({ state }: { state: VerificationState }) {
  const meta = VERIFICATION_META[state];

  return (
    <span
      title={meta.meaning}
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-2xs font-medium"
      style={{ backgroundColor: `${meta.hue}1A`, color: meta.hue }}
    >
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  if (severity === 'observation') return null;

  return (
    <span
      title={meta.hint}
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-medium"
      style={{ backgroundColor: `${meta.hue}1A`, color: meta.hue }}
    >
      {severity === 'emergency' ? <Siren className="h-3 w-3" strokeWidth={2.4} /> : null}
      {meta.label}
    </span>
  );
}

const HANDLING_COPY: Record<HandlingRequirement, { label: string; detail: string }> = {
  redact_before_publication: {
    label: 'Redact before publication',
    detail: 'Faces or identifying detail must be obscured first.',
  },
  viewer_warning: {
    label: 'Viewer warning required',
    detail: 'Distressing content. Warn before playback.',
  },
  restrict_location: {
    label: 'Location restricted',
    detail: 'A private address is visible. Do not publish the coordinates.',
  },
  editorial_review_required: {
    label: 'Editorial review required',
    detail: 'A person must look at this whatever the automated checks say.',
  },
};

/**
 * What must happen to this footage before anyone sees it.
 *
 * Shown as a block rather than as chips. These are obligations, not tags, and a
 * row of small pills reads as metadata somebody can skim past.
 */
export function HandlingNotice({
  handling,
  className,
}: {
  handling: HandlingRequirement[];
  className?: string;
}) {
  if (handling.length === 0) return null;

  return (
    <ul
      className={cn(
        'space-y-1.5 rounded-md border border-warning/25 bg-warning-wash/35 p-3',
        className,
      )}
    >
      {handling.map((requirement) => {
        const copy = HANDLING_COPY[requirement];
        const Icon = requirement === 'restrict_location' ? EyeOff : AlertTriangle;
        return (
          <li key={requirement} className="flex items-start gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={2.2} />
            <div className="text-xs leading-relaxed">
              <span className="font-medium text-text-primary">{copy.label}</span>{' '}
              <span className="text-text-muted">{copy.detail}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
