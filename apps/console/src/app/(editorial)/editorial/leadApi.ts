/**
 * Setting or clearing a feed lead, from any desk screen.
 *
 * One request shape for the Top story panel, the Decided list and the Leading
 * page, so the three cannot drift apart. Client-safe: it calls this console's
 * own route, which holds the token.
 */

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
 * Tuesday, and "until cleared" is for the story that genuinely stays the story.
 */
export const LEAD_EXPIRIES = [
  { value: '6', label: '6 hours', hours: 6 },
  { value: '24', label: '24 hours', hours: 24 },
  { value: '72', label: '3 days', hours: 72 },
  { value: 'none', label: 'Until cleared', hours: null },
] as const;

export type LeadExpiry = (typeof LEAD_EXPIRIES)[number]['value'];

export type LeadAnswer = { ok: true; state: LeadState } | { ok: false; error: string };

export async function sendLead(
  incidentId: string,
  lead: boolean,
  expiry: LeadExpiry = '24',
): Promise<LeadAnswer> {
  const hours = LEAD_EXPIRIES.find((option) => option.value === expiry)?.hours ?? null;
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
      return {
        ok: false,
        error: answer.error
          ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
          : 'That could not be saved.',
      };
    }
    // The service's answer, not the request: it knows whether the expiry held.
    return {
      ok: true,
      state: {
        lead: answer.result?.lead ?? lead,
        leadAt: answer.result?.leadAt ?? null,
        leadUntil: answer.result?.leadUntil ?? null,
      },
    };
  } catch {
    return { ok: false, error: 'The console could not reach its own server. Nothing was changed.' };
  }
}

/** "15 Sep, 18:00" — when a lead lapses. */
export function formatLeadUntil(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
