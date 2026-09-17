'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { formatRelativeTime } from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Whether a report leads the feed, as the service reports it. */
export interface LeadState {
  lead: boolean;
  leadAt: string | null;
  leadUntil: string | null;
}

/**
 * How long a lead holds before the report drops back into normal order.
 *
 * A day by default. A lead nobody clears is a front page frozen on last
 * Tuesday, and "until cleared" is offered for the story that genuinely stays
 * the story — a flood still rising, an election count — not as the default.
 */
const EXPIRIES = [
  { value: '6', label: '6 hours', hours: 6 },
  { value: '24', label: '24 hours', hours: 24 },
  { value: '72', label: '3 days', hours: 72 },
  { value: 'none', label: 'Until cleared', hours: null },
] as const;

type Expiry = (typeof EXPIRIES)[number]['value'];

/**
 * Which stories lead the feed — the editor's call, at last.
 *
 * The phone's top-story rotation takes the first reports the service returns
 * for a desk. Until `PATCH /editorial/{id}` existed that was simply the most
 * recently published, so a pothole published a minute after a fatal accident
 * led above it and nobody could change that. Led reports now come first.
 *
 * **Separate from the verification decision.** Whether something is true and
 * whether it leads are different judgements, and an editor must be able to lead
 * a report published an hour ago — or take one off the top — without recording
 * a new verification in a permanent history.
 */
export function LeadPanel({
  incidentId,
  published,
  section,
  state,
  onChange,
}: {
  incidentId: string;
  /** Only a report on the public feed can lead it. */
  published: boolean;
  section: string | null;
  state: LeadState;
  onChange: (next: LeadState) => void;
}) {
  const [expiry, setExpiry] = useState<Expiry>('24');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (lead: boolean) => {
    setBusy(true);
    setError(null);
    const hours = EXPIRIES.find((option) => option.value === expiry)?.hours ?? null;
    const leadUntil = lead && hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null;

    try {
      const res = await fetch(`/api/editorial/${encodeURIComponent(incidentId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lead', lead, leadUntil }),
      });
      const answer = (await res.json()) as {
        error?: string;
        upstreamStatus?: number;
        result?: Partial<LeadState>;
      };
      if (!res.ok) {
        setError(
          answer.error
            ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
            : 'That could not be saved.',
        );
        return;
      }
      // The service's answer, not the request: it knows whether the expiry held.
      onChange({
        lead: answer.result?.lead ?? lead,
        leadAt: answer.result?.leadAt ?? null,
        leadUntil: answer.result?.leadUntil ?? null,
      });
    } catch {
      setError('The console could not reach its own server. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const desk = section ? `${section.charAt(0).toUpperCase()}${section.slice(1)}` : 'its';

  return (
    <Panel className={cn('p-4', state.lead && 'border-accent/35 bg-accent-wash/30')}>
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
        <Star
          className={cn('h-3 w-3', state.lead ? 'fill-accent text-accent' : 'text-text-faint')}
          strokeWidth={2}
        />
        Top story
      </p>

      {!published ? (
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          Only a report on the public feed can lead it. Record it as Verified with “Also lead the
          feed” ticked to publish and lead in one step.
        </p>
      ) : state.lead ? (
        <>
          <p className="mt-2 text-sm font-medium text-text-primary">
            Leading the {desk} feed
          </p>
          <p className="mt-0.5 text-2xs text-text-muted">
            {state.leadAt ? `Led ${formatRelativeTime(state.leadAt) ?? 'recently'} ago` : 'Leading'}
            {state.leadUntil
              ? ` · until ${new Date(state.leadUntil).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : ' · until an editor clears it'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={() => void send(false)}
          >
            Stop leading
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Put this at the top of the {desk} feed, ahead of newer reports. The phone’s top-story
            slides show led reports first.
          </p>
          <p className="mt-3 text-2xs font-medium text-text-secondary">For how long</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Lead expiry">
            {EXPIRIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setExpiry(option.value)}
                aria-pressed={expiry === option.value}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-2xs transition',
                  expiry === option.value
                    ? 'border-accent bg-accent text-text-on-dark'
                    : 'border-hairline/15 text-text-muted hover:border-hairline/35',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button size="sm" className="mt-3" disabled={busy} onClick={() => void send(true)}>
            <Star className="h-3.5 w-3.5" strokeWidth={2} /> Lead the feed
          </Button>
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-sm border border-danger/25 bg-danger-wash/40 p-2.5 text-2xs leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
