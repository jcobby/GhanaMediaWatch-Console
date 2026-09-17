'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Upholding or refusing one request, for real.
 *
 * This replaces a simulated control that settled into "Upheld" after a timer
 * and told the platform nothing. On a statutory request under Act 843 that is
 * the worst version of the bug: somebody asked for footage of themselves to be
 * taken down, an officer pressed the button, and the only record of it was a
 * React state variable that a reload erased.
 *
 * **A reason is required for both answers.** Upholding needs one as much as
 * refusing does — the decision is kept permanently and has to be accountable
 * afterwards, and "why" is the part nobody can reconstruct later.
 */
export function TakedownDecision({
  takedownId,
  published,
}: {
  takedownId: string;
  /** Already licensed and published — the hardest case, and it is said out loud. */
  published: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<'accepted' | 'rejected' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-2xs font-medium text-success">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        {done === 'accepted' ? 'Upheld' : 'Refused'}
      </span>
    );
  }

  const send = async () => {
    if (!open) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/platform/takedowns/${encodeURIComponent(takedownId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: open, note: note.trim() }),
      });
      const raw = await res.text();
      let answer: { error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok) {
        setFailure(answer?.error ?? `That could not be sent — the service answered ${res.status}.`);
        return;
      }
      setDone(open);
      setOpen(null);
      setNote('');
      router.refresh();
    } catch {
      setFailure('The console could not reach its own server. Nothing was decided.');
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <span className="inline-flex flex-col items-end gap-1.5">
        <span className="text-2xs text-text-muted">
          {open === 'accepted'
            ? published
              ? 'Already published — withdraw anyway. Why?'
              : 'Remove the report. Why?'
            : 'Record a refusal. Why?'}
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Reason for the decision"
          placeholder={
            open === 'accepted' ? 'Subject identifiable and did not consent' : 'Public interest'
          }
          className="h-8 w-64 rounded-sm border border-hairline/15 bg-canvas-soft px-2.5 text-xs"
        />
        {failure ? (
          <span role="alert" className="max-w-64 text-2xs leading-relaxed text-danger">
            {failure}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              setNote('');
              setFailure(null);
            }}
            className="rounded-xs px-1.5 py-0.5 text-2xs text-text-muted hover:bg-canvas-raise"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={note.trim().length < 4 || busy}
            onClick={() => void send()}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-2xs font-medium transition',
              note.trim().length < 4 || busy
                ? 'cursor-not-allowed border-hairline/10 text-text-faint/60'
                : 'border-danger/30 text-danger hover:bg-danger-wash',
            )}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : null}
            {busy ? 'Sending…' : open === 'accepted' ? 'Uphold' : 'Refuse'}
          </button>
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setOpen('accepted')}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-accent bg-accent px-2.5 py-1 text-2xs font-medium text-text-on-dark transition hover:opacity-90"
      >
        Uphold
      </button>
      <button
        type="button"
        onClick={() => setOpen('rejected')}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-hairline/15 px-2.5 py-1 text-2xs font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent"
      >
        Refuse
      </button>
    </span>
  );
}
