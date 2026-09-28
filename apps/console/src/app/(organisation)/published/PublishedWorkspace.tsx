'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Megaphone, Send } from 'lucide-react';
import {
  CATEGORY_META,
  NEWS_SECTION_LABEL,
  formatCount,
  formatExactCapture,
  formatPlace,
  type OrganisationAccount,
  type Incident,
} from '@dawuro/core';
import { Badge, Button, Panel, useToast } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { mediaHref } from '@/lib/mediaHref';

/**
 * Reports released under this organisation's name, and withdrawing one.
 *
 * Every row here is already on the public feed, credited to the organisation —
 * the list is read from the public record. Publishing itself now goes through
 * the editor (`POST /org/incidents/{id}/publish` creates a request, it does not
 * publish), so this screen no longer offers a "Release publicly" button that
 * only changed a badge.
 *
 * Withdrawing is real: it removes the report from the public feed and keeps the
 * licence. It asks for a reason first, because taking down footage a citizen
 * filmed is a decision somebody may need to account for.
 */
export function PublishedWorkspace({
  licensed,
  organisation,
}: {
  licensed: Incident[];
  organisation: OrganisationAccount;
}) {
  const router = useRouter();
  const toast = useToast();
  const [withdrawn, setWithdrawn] = useState<Set<string>>(new Set());
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  /** Only marked withdrawn once the service has taken it down. */
  const withdraw = async (incidentId: string) => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/org/incidents/${encodeURIComponent(incidentId)}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const raw = await res.text();
      let answer: { error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok) {
        setFailure({
          id: incidentId,
          message: answer?.error ?? `It could not be withdrawn — the service answered ${res.status}.`,
        });
        return;
      }
      setWithdrawn((prev) => new Set(prev).add(incidentId));
      toast.success('Withdrawn from the feed', 'It is no longer public. Your licence stands.');
      setWithdrawing(null);
      setReason('');
      router.refresh();
    } catch {
      setFailure({
        id: incidentId,
        message: 'The console could not reach its own server. The report is still public.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-7">
        <Panel className="flex flex-wrap items-start gap-3 p-4">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-muted">
            These reports are on the public feed, credited to {organisation.name}. Withdrawing one
            takes it off the feed; you keep the licence. To publish another, open a report you
            licensed in your inbox and send it to the editor.
          </p>
          <Link
            href="/inbox"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-text-on-dark transition hover:opacity-90"
          >
            <Send className="h-3.5 w-3.5" /> Send a report to the editor
          </Link>
        </Panel>

        {licensed.length === 0 ? (
          <Panel className="p-10 text-center">
            <p className="text-sm font-medium">Nothing released yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Reports appear here once an editor publishes them under your name.
            </p>
          </Panel>
        ) : (
          licensed.map((incident) => {
            const live = !withdrawn.has(incident.id);
            const meta = CATEGORY_META[incident.category];
            const open = withdrawing === incident.id;

            return (
              <Panel key={incident.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-pill"
                    style={{ backgroundColor: meta?.hue }}
                  />
                  <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {meta?.label ?? incident.category}
                  </span>
                  {live ? <Badge tone="success">Live to the public</Badge> : <Badge>Withdrawn</Badge>}
                  {live ? (
                    <span className="ml-auto text-2xs text-text-faint">
                      {formatCount(incident.counts.reactions)} reactions
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-relaxed">{incident.description}</p>

                <MediaFrame
                  className="mt-3"
                  posterUrl={mediaHref(incident.id)}
                  {...(incident.media.kind === 'video' ? { videoUrl: mediaHref(incident.id) } : {})}
                  alt={incident.description}
                  when={formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision)}
                  where={formatPlace(incident.location)}
                  isVideo={incident.media.kind === 'video'}
                  byteSize={incident.media.byteSize}
                />

                {open ? (
                  <div className="mt-3 rounded-md border border-danger/25 bg-danger-wash/25 p-3.5">
                    <label htmlFor={`withdraw-${incident.id}`} className="text-xs font-medium">
                      Why are you withdrawing it?
                    </label>
                    <p className="mt-0.5 text-2xs text-text-muted">
                      Kept with the report&rsquo;s history. Readers stop seeing it straight away.
                    </p>
                    <textarea
                      id={`withdraw-${incident.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="The reporter asked for it to be taken down."
                      className="mt-2 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-sm"
                    />
                    {failure?.id === incident.id ? (
                      <p role="alert" className="mt-2 text-xs text-danger">
                        {failure.message}
                      </p>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setWithdrawing(null);
                          setReason('');
                          setFailure(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        disabled={reason.trim().length < 4}
                        onClick={() => void withdraw(incident.id)}
                      >
                        Withdraw report
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline/[0.07] pt-3">
                  <p className="flex items-center gap-2 text-xs text-text-muted">
                    {live ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-success" />
                        Credited to {organisation.name} · {NEWS_SECTION_LABEL[incident.section]}
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-text-faint" />
                        Off the public feed. You still hold the licence.
                      </>
                    )}
                  </p>
                  {live && !open ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setWithdrawing(incident.id);
                        setReason('');
                        setFailure(null);
                      }}
                    >
                      Withdraw from public
                    </Button>
                  ) : null}
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}
