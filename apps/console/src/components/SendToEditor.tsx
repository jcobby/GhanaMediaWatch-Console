'use client';

import { useState } from 'react';
import { Check, Send, ShieldAlert } from 'lucide-react';
import {
  NEWS_SECTIONS,
  NEWS_SECTION_LABEL,
  verificationMeta,
  type NewsSection,
  type VerificationState,
} from '@dawuro/core';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Asking the editor to publish a licensed report under this organisation's name.
 *
 * The organisation chooses the desk it thinks the story belongs on and can add a
 * note; the editor makes the call. Nothing here publishes — the confirmation says
 * it is waiting for a decision, because that is the truth.
 *
 * **A report that cannot be published does not get the form.** Licensing and
 * publishing are gated on different things: `integrity_passed` is licensable and
 * not publishable, so an organisation could buy a report, fill in a desk and a
 * note, press send, and be told "Report cannot be published." by the service —
 * after the work, with no way to have known. The rule is in `@dawuro/core` and
 * was always readable here; the panel just never read it.
 */
export function SendToEditor({
  incidentId,
  section,
  verification,
}: {
  incidentId: string;
  section: NewsSection | null | undefined;
  /** The report's verification state. Decides whether any of this is offered. */
  verification: VerificationState | null | undefined;
}) {
  const [desk, setDesk] = useState<NewsSection>(section ?? 'ghana');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/org/incidents/${encodeURIComponent(incidentId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: desk, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFailure(answer?.error ?? `It could not be sent — the service answered ${res.status}.`);
        return;
      }
      setSent(true);
    } catch {
      setFailure('The console could not reach its own server. Nothing was sent.');
    } finally {
      setBusy(false);
    }
  }

  /*
   * Through the accessor, never the record directly: this value comes off the
   * wire, and an unrecognised state must fall to "not publishable" rather than
   * crash or, worse, be treated as publishable.
   */
  const meta = verificationMeta(verification as VerificationState);

  if (!meta.publishable) {
    return (
      <div className="rounded-md border border-hairline/[0.07] bg-canvas-soft p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" strokeWidth={2} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Not ready to publish</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              An editor has to verify this before it can run on the public feed, and it is still
              marked <span className="font-medium text-text-secondary">{meta.label}</span>.{' '}
              {meta.meaning}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              You have licensed it, so the footage is yours to use. What is missing is the
              editorial check on whether what it shows is true — which is the thing publishing
              under your name would be asserting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-success/25 bg-success-wash/40 p-4">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
        <p className="text-xs leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Sent to the editor.</span> Waiting for a
          decision. If it is published it appears on your Published page, credited to you.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-hairline/[0.07] bg-canvas-soft p-4">
      <h3 className="text-sm font-semibold">Publish under your name</h3>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        An editor checks it, then publishes it credited to you — or tells you why not.
      </p>

      <p className="mt-3 text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">Desk</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {NEWS_SECTIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setDesk(value)}
            aria-pressed={desk === value}
            className={cn(
              'rounded-pill border px-3 py-1.5 text-xs transition',
              desk === value
                ? 'border-accent bg-accent-wash text-accent'
                : 'border-hairline/12 text-text-muted hover:border-accent/30',
            )}
          >
            {NEWS_SECTION_LABEL[value]}
          </button>
        ))}
      </div>

      <label htmlFor={`editor-note-${incidentId}`} className="mt-3 block text-xs font-medium">
        Note to the editor <span className="font-normal text-text-faint">(optional)</span>
      </label>
      <textarea
        id={`editor-note-${incidentId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="We have confirmed this with the district office."
        className="mt-1 w-full rounded-sm border border-hairline/15 bg-canvas px-3 py-2 text-sm"
      />

      {failure ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {failure}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={busy} onClick={() => void send()}>
          <Send className="h-3.5 w-3.5" /> Send to the editor
        </Button>
      </div>
    </div>
  );
}
