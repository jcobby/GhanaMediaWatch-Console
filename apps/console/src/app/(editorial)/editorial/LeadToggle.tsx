'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { formatRelativeTime } from '@dawuro/core';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  LEAD_EXPIRIES,
  formatLeadUntil,
  sendLead,
  type LeadExpiry,
  type LeadState,
} from './leadApi';

/**
 * Lead or stop leading a report that is already published — inline, on a row.
 *
 * Triage only lists reports still waiting for a decision, so once a report was
 * published there was nowhere to put it on the top stories or take it off. This
 * sits on every published row of the Decided list for exactly that.
 */
export function LeadToggle({
  incidentId,
  section,
  initial,
}: {
  incidentId: string;
  section: string | null;
  initial: LeadState;
}) {
  const [state, setState] = useState<LeadState>(initial);
  const [expiry, setExpiry] = useState<LeadExpiry>('24');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (lead: boolean) => {
    setBusy(true);
    setError(null);
    const answer = await sendLead(incidentId, lead, expiry);
    if (answer.ok) setState(answer.state);
    else setError(answer.error);
    setBusy(false);
  };

  const desk = section ? `${section.charAt(0).toUpperCase()}${section.slice(1)}` : 'its';
  const selectId = `lead-expiry-${incidentId}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            state.lead ? 'font-medium text-accent' : 'text-text-muted',
          )}
        >
          <Star
            className={cn('h-3.5 w-3.5', state.lead ? 'fill-accent text-accent' : 'text-text-faint')}
            strokeWidth={2}
          />
          {state.lead
            ? `Leading the ${desk} feed${
                state.leadAt ? ` · led ${formatRelativeTime(state.leadAt) ?? 'recently'} ago` : ''
              }${state.leadUntil ? ` · until ${formatLeadUntil(state.leadUntil)}` : ' · until cleared'}`
            : `Not a top story on the ${desk} feed`}
        </span>

        <span className="ml-auto flex items-center gap-2">
          {state.lead ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void change(false)}>
              Stop leading
            </Button>
          ) : (
            <>
              <label htmlFor={selectId} className="sr-only">
                Lead for how long
              </label>
              <select
                id={selectId}
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as LeadExpiry)}
                className="h-8 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-xs"
              >
                {LEAD_EXPIRIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={busy} onClick={() => void change(true)}>
                <Star className="h-3.5 w-3.5" strokeWidth={2} /> Lead the feed
              </Button>
            </>
          )}
        </span>
      </div>

      {error ? <p className="text-2xs leading-relaxed text-danger">{error}</p> : null}
    </div>
  );
}
