'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import {
  CATEGORY_META,
  NEWS_SECTIONS,
  NEWS_SECTION_LABEL,
  formatExactCapture,
  formatPlace,
  formatRelativeTime,
  type Incident,
  type NewsSection,
} from '@dawuro/core';
import { Badge, Button, Panel, useToast } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { mediaHref } from '@/lib/mediaHref';
import { cn } from '@/lib/cn';
import { LEAD_EXPIRIES, type LeadExpiry } from '../leadApi';

/**
 * A request as the list may carry it. The endpoint answers with incidents; the
 * request's own note and chosen desk are read from whichever field carries them.
 */
type RequestRow = Incident & {
  publicationNote?: string | null;
  requestedSection?: NewsSection | null;
  requestedAt?: string | null;
  publicationRequest?: {
    note?: string | null;
    section?: NewsSection | null;
    requestedAt?: string | null;
  } | null;
};

export function RequestsList({ initial }: { initial: Incident[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial as RequestRow[]);

  if (rows.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-7">
          <Panel className="p-10 text-center">
            <p className="text-sm font-medium">No requests waiting</p>
            <p className="mt-1 text-xs text-text-muted">
              Organisations&rsquo; requests to publish appear here.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-7">
        {rows.map((row) => (
          <RequestCard
            key={row.id}
            row={row}
            onDecided={() => {
              setRows((prev) => prev.filter((r) => r.id !== row.id));
              router.refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RequestCard({ row, onDecided }: { row: RequestRow; onDecided: () => void }) {
  const requested = row.publicationRequest?.section ?? row.requestedSection ?? row.section ?? 'ghana';
  const note = row.publicationRequest?.note ?? row.publicationNote ?? null;
  const askedAt = row.publicationRequest?.requestedAt ?? row.requestedAt ?? null;
  const organisation = row.publisher?.kind === 'organisation' ? row.publisher.displayName : 'An organisation';

  const [section, setSection] = useState<NewsSection>(requested);
  const [lead, setLead] = useState(false);
  const [expiry, setExpiry] = useState<LeadExpiry>('24');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const toast = useToast();
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const meta = CATEGORY_META[row.category];

  async function decide(decision: 'approve' | 'decline') {
    setBusy(decision);
    setFailure(null);
    const hours = LEAD_EXPIRIES.find((option) => option.value === expiry)?.hours ?? null;
    const body =
      decision === 'approve'
        ? {
            decision,
            section,
            lead,
            ...(lead ? { leadUntil: hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null } : {}),
          }
        : { decision, reason: reason.trim() };
    try {
      const res = await fetch(`/api/editorial/publication-requests/${encodeURIComponent(row.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFailure(answer?.error ?? `That could not be sent — the service answered ${res.status}.`);
        return;
      }
      /*
       * The card disappears either way, which on its own says only that
       * *something* happened. Which desk it went to, and whether it leads, are
       * decisions the editor just made and should hear back.
       */
      if (decision === 'approve') {
        toast.success(
          `Published to ${NEWS_SECTION_LABEL[section]}`,
          lead ? 'Set as a top story on the homepage.' : `${organisation} has been told.`,
        );
      } else {
        toast.success('Request declined', `${organisation} has been told why.`);
      }
      onDecided();
    } catch {
      setFailure('The console could not reach its own server. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="h-2 w-2 rounded-pill" style={{ backgroundColor: meta?.hue }} />
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {meta?.label ?? row.category}
        </span>
        <Badge tone="info">From {organisation}</Badge>
        {askedAt ? (
          <span className="ml-auto text-2xs text-text-faint">Asked {formatRelativeTime(askedAt) ?? 'recently'}</span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-relaxed">{row.description || 'No description filed.'}</p>

      {note ? (
        <p className="mt-2 rounded-sm bg-canvas-raise px-3 py-2 text-xs leading-relaxed text-text-secondary">
          <span className="font-medium text-text-primary">Their note:</span> {note}
        </p>
      ) : null}

      <MediaFrame
        className="mt-3"
        posterUrl={mediaHref(row.id)}
        {...(row.media.kind === 'video' ? { videoUrl: mediaHref(row.id) } : {})}
        alt={row.description}
        when={formatExactCapture(row.capturedAtIso, row.capturedAtPrecision)}
        where={formatPlace(row.location)}
        isVideo={row.media.kind === 'video'}
        byteSize={row.media.byteSize}
      />

      {declining ? (
        <div className="mt-3 rounded-md border border-danger/25 bg-danger-wash/25 p-3.5">
          <label htmlFor={`decline-${row.id}`} className="text-xs font-medium">
            Why not?
          </label>
          <p className="mt-0.5 text-2xs text-text-muted">Sent to {organisation}.</p>
          <textarea
            id={`decline-${row.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="The location cannot be confirmed from the footage."
            className="mt-2 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-sm"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setDeclining(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={busy === 'decline'}
              disabled={reason.trim().length < 4}
              onClick={() => void decide('decline')}
            >
              Decline request
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3 border-t border-hairline/[0.07] pt-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
              Desk{requested ? ` · they asked for ${NEWS_SECTION_LABEL[requested]}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {NEWS_SECTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSection(value)}
                  aria-pressed={section === value}
                  className={cn(
                    'rounded-pill border px-3 py-1.5 text-xs transition',
                    section === value
                      ? 'border-accent bg-accent-wash text-accent'
                      : 'border-hairline/12 text-text-muted hover:border-accent/30',
                  )}
                >
                  {NEWS_SECTION_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={lead} onChange={(e) => setLead(e.target.checked)} />
              Also make it a top story
            </label>
            {lead ? (
              <select
                aria-label="How long it leads"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as LeadExpiry)}
                className="h-8 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-xs"
              >
                {LEAD_EXPIRIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setDeclining(true)}>
              <X className="h-3.5 w-3.5" /> Decline
            </Button>
            <Button size="sm" loading={busy === 'approve'} onClick={() => void decide('approve')}>
              <Check className="h-3.5 w-3.5" /> Publish credited to {organisation}
            </Button>
          </div>
        </div>
      )}

      {failure ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {failure}
        </p>
      ) : null}
    </Panel>
  );
}
